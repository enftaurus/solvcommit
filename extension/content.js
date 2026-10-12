// LeetSync Content Script (Manifest V3)
// Captures accepted submissions in the user's active session on leetcode.com/problems/*
// Never exposes LeetCode credentials outside the browser (D-04).

console.log("[LeetSync] Content script active on", window.location.pathname);

// Inject main-world interceptor directly into page DOM (ensures execution in Firefox & Chrome)
(() => {
  const script = document.createElement("script");
  script.textContent = `
    (() => {
      const origFetch = window.fetch;
      window.fetch = async function (...args) {
        const res = await origFetch.apply(this, args);
        try {
          const input = args[0];
          const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
          if (urlStr.includes('/submit')) {
            res.clone().json().then((d) => {
              if (d && (d.submission_id || d.submissionId)) {
                const subId = String(d.submission_id || d.submissionId);
                console.log('[LeetSync] Detected submit response, submission_id:', subId);
                window.postMessage({ type: 'LEETSYNC_SUBMISSION_DETECTED', submissionId: subId }, '*');
              }
            }).catch(() => {});
          }
        } catch (_) {}
        return res;
      };
      console.log('[LeetSync] Page submit fetch hook installed successfully.');
    })();
  `;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
})();

const SUBMISSION_DETAILS_QUERY = `
query submissionDetails($submissionId: Int!) {
  submissionDetails(submissionId: $submissionId) {
    runtime
    runtimeDisplay
    memory
    memoryDisplay
    code
    timestamp
    statusCode
    statusDisplay
    lang {
      name
      verboseName
    }
    question {
      questionId
      titleSlug
      title
    }
  }
}
`;

function getCsrfToken() {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; csrftoken=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

// Fetch submission details inside the user's active session
async function fetchSubmissionDetails(submissionId) {
  const idInt = parseInt(submissionId, 10);
  const csrftoken = getCsrfToken();

  const headers = {
    "Content-Type": "application/json"
  };
  if (csrftoken) {
    headers["x-csrftoken"] = csrftoken;
  }

  const response = await fetch("/graphql/", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({
      query: SUBMISSION_DETAILS_QUERY,
      variables: { submissionId: idInt },
      operationName: "submissionDetails"
    })
  });

  if (!response.ok) {
    throw new Error(`GraphQL query failed with status ${response.status}`);
  }

  const json = await response.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0].message);
  }

  return json.data?.submissionDetails;
}

async function waitForFinalDetails(id) {
  for (let i = 0; i < 20; i++) {
    try {
      const d = await fetchSubmissionDetails(id);
      if (d) {
        console.log(`[LeetSync] Poll attempt ${i + 1}: statusDisplay="${d.statusDisplay}", statusCode=${d.statusCode}, hasCode=${!!d.code}`);
        // If still judging, queued, started, or temporary internal error during early judge spinup
        const isJudging = !d.code || !d.statusDisplay || /pending|judging|started|internal error/i.test(d.statusDisplay);
        if (!isJudging) {
          return d;
        }
      }
    } catch (e) {
      console.warn("[LeetSync] Polling submission details attempt failed:", e.message);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

// Handle detected submission ID
async function handleSubmissionCaptured(submissionId) {
  try {
    const details = await waitForFinalDetails(submissionId);
    if (!details) {
      console.warn("[LeetSync] Could not fetch final details for submission:", submissionId);
      return;
    }

    console.log("[LeetSync] Final submission details received:", {
      statusDisplay: details.statusDisplay,
      statusCode: details.statusCode,
      lang: details.lang?.name,
      slug: details.question?.titleSlug
    });

    const isAccepted =
      (typeof details.statusDisplay === "string" && details.statusDisplay.trim().toLowerCase() === "accepted") ||
      details.statusCode === 10;

    // Strict Rule: Only Accepted submissions (D-10)
    if (!isAccepted) {
      console.log("[LeetSync] Submission is not accepted (status:", details.statusDisplay, "code:", details.statusCode, "). Skipping.");
      return;
    }

    const problemSlug = details.question?.titleSlug || extractProblemSlugFromUrl();
    const problemTitle = details.question?.title || details.question?.titleSlug || problemSlug;
    const lang = details.lang?.name;
    if (!lang) {
      console.warn("[LeetSync] Missing language in submission details, skipping");
      return;
    }

    const payload = {
      submission_id: String(submissionId),
      problem_slug: problemSlug,
      problem_title: problemTitle,
      language: lang,
      code: details.code,
      status: "Accepted",
      submitted_at: new Date(details.timestamp * 1000).toISOString()
    };

    console.log("[LeetSync] Enqueueing accepted submission:", payload.submission_id, payload.problem_slug);

    const extAPI = typeof browser !== "undefined" ? browser : chrome;
    extAPI.runtime.sendMessage({
      action: "ENQUEUE_SUBMISSION",
      payload
    }, (res) => {
      if (res && res.success) {
        console.log("[LeetSync] Submission enqueued successfully.");
      } else {
        console.warn("[LeetSync] Failed to enqueue submission:", res?.error);
      }
    });
  } catch (err) {
    console.error("[LeetSync] Failed to capture submission:", err);
  }
}

function extractProblemSlugFromUrl() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const probIdx = parts.indexOf("problems");
  if (probIdx >= 0 && parts.length > probIdx + 1) {
    return parts[probIdx + 1];
  }
  return "unknown-problem";
}

// Listen for custom dispatch or DOM submission responses
window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "LEETSYNC_SUBMISSION_DETECTED" && event.data.submissionId) {
    console.log("[LeetSync] Message received in content script:", event.data.submissionId);
    handleSubmissionCaptured(event.data.submissionId);
  }
});
