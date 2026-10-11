// LeetSync Content Script (Manifest V3)
// Captures accepted submissions in the user's active session on leetcode.com/problems/*
// Never exposes LeetCode credentials outside the browser (D-04).

console.log("[LeetSync] Content script active on", window.location.pathname);

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

// Handle detected submission ID
async function handleSubmissionCaptured(submissionId) {
  try {
    const details = await fetchSubmissionDetails(submissionId);
    if (!details) {
      console.warn("[LeetSync] Could not fetch details for submission:", submissionId);
      return;
    }

    // Strict Rule: Only Accepted submissions (D-10)
    if (details.statusDisplay !== "Accepted") {
      console.log("[LeetSync] Submission is not accepted (status:", details.statusDisplay, "). Skipping.");
      return;
    }

    const payload = {
      submission_id: String(submissionId),
      problem_slug: details.question?.titleSlug || extractProblemSlugFromUrl(),
      problem_title: details.question?.title || details.question?.titleSlug,
      language: details.lang?.name || "python3",
      code: details.code,
      status: "Accepted",
      submitted_at: new Date(details.timestamp * 1000).toISOString()
    };

    console.log("[LeetSync] Enqueueing accepted submission:", payload.submission_id, payload.problem_slug);

    chrome.runtime.sendMessage({
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
  if (event.source !== window) return;
  if (event.data && event.data.type === "LEETSYNC_SUBMISSION_DETECTED") {
    handleSubmissionCaptured(event.data.submissionId);
  }
});
