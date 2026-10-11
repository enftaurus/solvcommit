// LeetSync Background Service Worker (Manifest V3)
// Manages authentication tokens, offline submission queue, periodic retry, and backfill.

importScripts("queue.js");

const API_BASE_URL = "http://localhost:8080";
const storageAdapter = {
  get: (key) => new Promise((resolve) => chrome.storage.local.get(key, resolve)),
  set: (obj) => new Promise((resolve) => chrome.storage.local.set(obj, resolve))
};

const queue = new OfflineQueue(storageAdapter);

// Initialize Alarms on Install / Startup
chrome.runtime.onInstalled.addListener(() => {
  console.log("[LeetSync] Extension installed/updated.");
  // Setup alarm for queue drainage and periodic backfill (every 2 minutes)
  chrome.alarms.create("leetsync_queue_drain", { periodInMinutes: 2 });
});

// Periodic Alarm Handler
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "leetsync_queue_drain") {
    await processOfflineQueue();
  }
});

// LeetSync API Client
const apiClient = {
  async getAuthHeaders() {
    const data = await storageAdapter.get(["access_token", "device_id"]);
    if (!data.access_token) {
      throw new Error("Device is not paired; missing access token");
    }
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${data.access_token}`
    };
  },

  async submit(item) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/api/v1/sync/submissions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        submission_id: String(item.submission_id),
        problem_slug: item.problem_slug,
        problem_title: item.problem_title,
        language: item.language,
        code: item.code,
        status: item.status,
        submitted_at: item.submitted_at || new Date().toISOString()
      })
    });

    if (res.ok) {
      return await res.json();
    }

    const text = await res.text();
    const err = new Error(`API submission failed (${res.status}): ${text}`);
    err.status = res.status;
    err.isPermanent = (res.status === 422 || res.status === 400);
    throw err;
  },

  async getMissingSubmissions(submissionIDs) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/api/v1/sync/backfill`, {
      method: "POST",
      headers,
      body: JSON.stringify({ submission_ids: submissionIDs.map(String) })
    });

    if (!res.ok) {
      throw new Error(`Backfill query failed (${res.status})`);
    }

    const data = await res.json();
    return data.missing_submission_ids || [];
  }
};

// Queue Drainage Worker
async function processOfflineQueue() {
  try {
    const authData = await storageAdapter.get(["access_token"]);
    if (!authData.access_token) {
      return; // Device not yet paired
    }
    const result = await queue.process(apiClient);
    if (result.processed > 0 || result.failed > 0) {
      console.log("[LeetSync] Queue run completed:", result);
    }
  } catch (err) {
    console.warn("[LeetSync] Error draining offline queue:", err.message);
  }
}

// Runtime Message Dispatcher
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ENQUEUE_SUBMISSION") {
    (async () => {
      try {
        const item = await queue.enqueue(request.payload);
        // Attempt immediate submission
        await processOfflineQueue();
        sendResponse({ success: true, item });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep channel open for async response
  }

  if (request.action === "GET_QUEUE_STATUS") {
    (async () => {
      const items = await queue.getItems();
      const auth = await storageAdapter.get(["device_id", "access_token"]);
      sendResponse({
        isPaired: !!auth.access_token,
        deviceID: auth.device_id || null,
        pendingCount: items.length,
        items
      });
    })();
    return true;
  }

  if (request.action === "PAIR_DEVICE") {
    (async () => {
      const { deviceID, accessToken, refreshToken } = request;
      await storageAdapter.set({
        device_id: deviceID,
        access_token: accessToken,
        refresh_token: refreshToken,
        paired_at: new Date().toISOString()
      });
      sendResponse({ success: true });
    })();
    return true;
  }
});
