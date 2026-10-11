// LeetSync Phase 0 Spike - Content Script
// Runs inside the user's active session on leetcode.com/problems/*

console.log("[LeetSync Spike] Content script injected on", window.location.pathname);

// Language extension mapping
const LANGUAGE_EXTENSIONS = {
  python: "py",
  python3: "py",
  golang: "go",
  java: "java",
  cpp: "cpp",
  c: "c",
  csharp: "cs",
  javascript: "js",
  typescript: "ts",
  rust: "rs",
  ruby: "rb",
  swift: "swift",
  kotlin: "kt",
  scala: "scala",
  php: "php"
};

// GraphQL Query extracting submission code, language, status, and question details
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

// Helper: read cookie from document.cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

// Perform in-session fetch to LeetCode GraphQL
async function fetchSubmissionDetails(submissionId, includeCsrfHeader = true) {
  // Parse submissionId as BigInt string or integer
  const idInt = parseInt(submissionId, 10);
  const csrftoken = getCookie("csrftoken");

  const headers = {
    "Content-Type": "application/json"
  };

  if (includeCsrfHeader && csrftoken) {
    headers["x-csrftoken"] = csrftoken;
  }

  const payload = {
    query: SUBMISSION_DETAILS_QUERY,
    variables: {
      submissionId: idInt
    },
    operationName: "submissionDetails"
  };

  const startTime = performance.now();
  const response = await fetch("/graphql/", {
    method: "POST",
    headers: headers,
    credentials: "include", // Attaches session cookies automatically
    body: JSON.stringify(payload)
  });
  const durationMs = Math.round(performance.now() - startTime);

  const status = response.status;
  const json = await response.json();

  return {
    httpStatus: status,
    durationMs,
    csrfIncluded: includeCsrfHeader,
    csrfTokenPresent: !!csrftoken,
    data: json
  };
}

// Test GitHub commit directly to a test repo using a GitHub Personal Access Token (or App token)
async function commitToGitHub(githubToken, repoOwner, repoName, submission) {
  const titleSlug = submission.question.titleSlug || "unknown-problem";
  const langName = submission.lang.name.toLowerCase();
  const ext = LANGUAGE_EXTENSIONS[langName] || "txt";
  const submissionIdStr = String(submission.id || submission.submissionId);
  const path = `${titleSlug}/submission-${submissionIdStr}.${ext}`;

  const message = `feat: sync accepted ${submission.question.title || titleSlug} submission (${submissionIdStr})`;
  const contentBase64 = btoa(unescape(encodeURIComponent(submission.code)));

  const url = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}`;

  // 1. Check if file already exists
  let existingSha = null;
  const getRes = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${githubToken}`,
      "Accept": "application/vnd.github+json"
    }
  });

  if (getRes.status === 200) {
    const existingData = await getRes.json();
    existingSha = existingData.sha;
  }

  // 2. Commit file
  const putBody = {
    message: message,
    content: contentBase64
  };
  if (existingSha) {
    putBody.sha = existingSha;
  }

  const putRes = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${githubToken}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(putBody)
  });

  const putJson = await putRes.json();
  return {
    status: putRes.status,
    path: path,
    result: putJson
  };
}

// Create on-page interactive testing panel
function createSpikeUI() {
  if (document.getElementById("leetsync-spike-panel")) return;

  const panel = document.createElement("div");
  panel.id = "leetsync-spike-panel";
  panel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 440px;
    max-height: 520px;
    background: #1e1e24;
    color: #e0e0e0;
    border: 2px solid #ffa116;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;

  panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 10px;">
      <strong style="color: #ffa116; font-size: 13px;">⚡ LeetSync Phase 0 Spike Probe</strong>
      <button id="ls-spike-close" style="background: none; border: none; color: #888; cursor: pointer; font-size: 16px;">✕</button>
    </div>
    
    <div style="margin-bottom: 8px;">
      <label style="display: block; font-weight: 600; margin-bottom: 4px;">Submission ID (64-bit int):</label>
      <input id="ls-sub-id" type="text" placeholder="e.g. 2138016677" style="width: 100%; box-sizing: border-box; background: #2a2a32; border: 1px solid #444; color: #fff; padding: 6px; border-radius: 4px;" />
    </div>

    <div style="display: flex; gap: 6px; margin-bottom: 10px;">
      <button id="ls-btn-csrf" style="flex: 1; background: #2cbb5d; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-weight: 600;">Fetch (with CSRF)</button>
      <button id="ls-btn-no-csrf" style="flex: 1; background: #4a4a58; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer;">Fetch (no CSRF)</button>
    </div>

    <div style="border-top: 1px solid #333; padding-top: 8px; margin-bottom: 8px;">
      <label style="display: block; font-weight: 600; margin-bottom: 4px;">GitHub Push Test (Optional):</label>
      <div style="display: flex; gap: 4px; margin-bottom: 4px;">
        <input id="ls-gh-owner" type="text" placeholder="Owner" style="flex: 1; background: #2a2a32; border: 1px solid #444; color: #fff; padding: 4px; border-radius: 4px;" />
        <input id="ls-gh-repo" type="text" placeholder="Repo" style="flex: 1; background: #2a2a32; border: 1px solid #444; color: #fff; padding: 4px; border-radius: 4px;" />
      </div>
      <input id="ls-gh-token" type="password" placeholder="GitHub Personal Access Token" style="width: 100%; box-sizing: border-box; background: #2a2a32; border: 1px solid #444; color: #fff; padding: 4px; border-radius: 4px; margin-bottom: 4px;" />
      <button id="ls-btn-gh-commit" style="width: 100%; background: #0077b6; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-weight: 600;">Commit Code to GitHub Repo</button>
    </div>

    <div id="ls-output" style="flex: 1; background: #121214; border: 1px solid #333; border-radius: 4px; padding: 8px; overflow-y: auto; font-family: monospace; font-size: 11px; white-space: pre-wrap; color: #a0ffa0; min-height: 120px;">
Ready. Enter a submission ID or submit code to auto-detect.
    </div>
  `;

  document.body.appendChild(panel);

  // Restore saved GitHub credentials from storage if present
  chrome.storage.local.get(["ghOwner", "ghRepo", "ghToken"], (res) => {
    if (res.ghOwner) document.getElementById("ls-gh-owner").value = res.ghOwner;
    if (res.ghRepo) document.getElementById("ls-gh-repo").value = res.ghRepo;
    if (res.ghToken) document.getElementById("ls-gh-token").value = res.ghToken;
  });

  const output = document.getElementById("ls-output");
  const log = (msg) => {
    output.innerText += `\n${msg}`;
    output.scrollTop = output.scrollHeight;
  };

  document.getElementById("ls-spike-close").addEventListener("click", () => {
    panel.style.display = "none";
  });

  let lastFetchedSubmission = null;

  async function handleFetch(includeCsrf) {
    const subId = document.getElementById("ls-sub-id").value.trim();
    if (!subId) {
      log("❌ Please enter a submission ID.");
      return;
    }
    log(`⏳ Fetching submission ${subId} (x-csrftoken header: ${includeCsrf})...`);
    try {
      const res = await fetchSubmissionDetails(subId, includeCsrf);
      log(`HTTP ${res.httpStatus} (${res.durationMs}ms)`);
      if (res.data.errors) {
        log(`❌ GraphQL Errors:\n${JSON.stringify(res.data.errors, null, 2)}`);
        return;
      }
      const details = res.data?.data?.submissionDetails;
      if (!details) {
        log(`⚠️ No submissionDetails found for ID ${subId}`);
        return;
      }

      lastFetchedSubmission = details;
      lastFetchedSubmission.submissionId = subId;

      log(`✅ Status: ${details.statusDisplay}`);
      log(`✅ Language: ${details.lang?.name} (${details.lang?.verboseName})`);
      log(`✅ Problem Title: ${details.question?.title}`);
      log(`✅ Problem Slug: ${details.question?.titleSlug}`);
      log(`✅ Code Length: ${details.code?.length} chars`);
      log(`Preview:\n${details.code?.slice(0, 140)}...\n`);
    } catch (err) {
      log(`❌ Network / Fetch Error: ${err.message}`);
    }
  }

  document.getElementById("ls-btn-csrf").addEventListener("click", () => handleFetch(true));
  document.getElementById("ls-btn-no-csrf").addEventListener("click", () => handleFetch(false));

  document.getElementById("ls-btn-gh-commit").addEventListener("click", async () => {
    if (!lastFetchedSubmission) {
      log("❌ Fetch a submission first before committing.");
      return;
    }
    const owner = document.getElementById("ls-gh-owner").value.trim();
    const repo = document.getElementById("ls-gh-repo").value.trim();
    const token = document.getElementById("ls-gh-token").value.trim();

    if (!owner || !repo || !token) {
      log("❌ Provide GitHub Owner, Repo, and Token.");
      return;
    }

    // Persist for convenience
    chrome.storage.local.set({ ghOwner: owner, ghRepo: repo, ghToken: token });

    log(`⏳ Committing to ${owner}/${repo}...`);
    try {
      const res = await commitToGitHub(token, owner, repo, lastFetchedSubmission);
      if (res.status === 200 || res.status === 201) {
        log(`🎉 Commit succeeded! HTTP ${res.status}`);
        log(`File: ${res.path}`);
        log(`Commit SHA: ${res.result.commit?.sha}`);
      } else {
        log(`❌ GitHub Commit Failed: HTTP ${res.status}\n${JSON.stringify(res.result, null, 2)}`);
      }
    } catch (err) {
      log(`❌ Error committing to GitHub: ${err.message}`);
    }
  });
}

// Automatically detect accepted submission on the page
function observeSubmissionResults() {
  const observer = new MutationObserver(() => {
    // Check URL or DOM for submission outcome
    // On LeetCode problem pages, submission details link often contains /submissions/detail/<id>/
    const submissionLinks = document.querySelectorAll("a[href*='/submissions/detail/']");
    submissionLinks.forEach((link) => {
      const match = link.href.match(/\/submissions\/detail\/(\d+)\//);
      if (match && match[1]) {
        const detectedId = match[1];
        const input = document.getElementById("ls-sub-id");
        if (input && !input.value) {
          input.value = detectedId;
          const output = document.getElementById("ls-output");
          if (output) output.innerText += `\n💡 Detected submission ID from page: ${detectedId}`;
        }
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// Initialize spike UI
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    createSpikeUI();
    observeSubmissionResults();
  });
} else {
  createSpikeUI();
  observeSubmissionResults();
}
