// LeetSync Background Service Worker (Manifest V3 - Cross-browser: Chrome & Firefox)
// Manages authentication tokens, offline submission queue, periodic retry, and backfill.

if (typeof importScripts === "function") {
  if (typeof WEB_BASE === "undefined") {
    try { importScripts("config.js"); } catch (e) {}
  }
  if (typeof OfflineQueue === "undefined") {
    try { importScripts("queue.js"); } catch (e) {}
  }
}

const extAPI = typeof browser !== "undefined" ? browser : chrome;
const API_BASE_URL = typeof WEB_BASE !== "undefined" ? WEB_BASE : "http://localhost:8080";

const storageAdapter = {
  get: (key) => new Promise((resolve) => extAPI.storage.local.get(key, resolve)),
  set: (obj) => new Promise((resolve) => extAPI.storage.local.set(obj, resolve))
};

const queue = new OfflineQueue(storageAdapter);

// Initialize Alarms on Install / Startup
extAPI.runtime.onInstalled.addListener(() => {
  console.log("[LeetSync] Extension installed/updated (cross-browser Chrome & Firefox).");
  // Setup alarm for queue drainage and periodic backfill (every 2 minutes)
  extAPI.alarms.create("leetsync_queue_drain", { periodInMinutes: 2 });
});

// Periodic Alarm Handler
extAPI.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "leetsync_queue_drain") {
    await processOfflineQueue();
  }
});

let refreshing = null;

async function refreshAccessToken() {
  const { device_id, refresh_token } = await storageAdapter.get(['device_id', 'refresh_token']);
  if (!device_id || !refresh_token) throw new Error('not paired');
  const res = await fetch(`${API_BASE_URL}/api/v1/devices/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id, refresh_token })
  });
  if (res.status === 401 || res.status === 403) {
    await storageAdapter.set({ access_token: null, refresh_token: null }); // revoked: show Unpaired
    throw new Error('device revoked');
  }
  if (!res.ok) throw new Error(`refresh failed (${res.status})`);
  const d = await res.json();
  await storageAdapter.set({ access_token: d.access_token, refresh_token: d.refresh_token });
  return d.access_token;
}

function refreshOnce() {
  refreshing = refreshing || refreshAccessToken().finally(() => { refreshing = null; });
  return refreshing;
}

async function authedFetch(url, init = {}) {
  const send = async () => {
    const { access_token } = await storageAdapter.get(['access_token']);
    if (!access_token) throw new Error('Device is not paired');
    return fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
        Authorization: `Bearer ${access_token}`
      }
    });
  };
  let res = await send();
  if (res.status === 401) {
    await refreshOnce();
    res = await send();
  }
  return res;
}

// LeetSync API Client
const apiClient = {
  async submit(item) {
    const res = await authedFetch(`${API_BASE_URL}/api/v1/sync/submissions`, {
      method: "POST",
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
    // Issue 19: Only 400 (malformed) and 422 (unprocessable) are permanent client rejects.
    // 401/403 are handled by refresh/reauth; 5xx and 429 are transient.
    err.isPermanent = (res.status === 400 || res.status === 422);
    throw err;
  },

  async getMissingSubmissions(submissionIDs) {
    const res = await authedFetch(`${API_BASE_URL}/api/v1/sync/backfill`, {
      method: "POST",
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
extAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
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

  if (request.action === "PAIR_FROM_PORTAL") {
    (async () => {
      try {
        const payload = request.payload || {};
        const senderUrl = sender.url || "";
        let senderOrigin = "";
        try {
          senderOrigin = new URL(senderUrl).origin;
        } catch (e) {
          console.warn("[LeetSync Background] Invalid sender URL:", senderUrl);
          return sendResponse({ ok: false, error: "invalid sender url" });
        }

        const expectedOrigin = new URL(API_BASE_URL).origin;
        const isAllowedOrigin =
          senderOrigin === expectedOrigin ||
          senderOrigin === "http://localhost:8080" ||
          senderOrigin === "http://127.0.0.1:8080" ||
          senderOrigin === "http://localhost:3000";

        if (!isAllowedOrigin) {
          console.warn("[LeetSync Background] Origin mismatch. Sender:", senderOrigin, "Expected:", expectedOrigin);
          return sendResponse({ ok: false, error: "origin mismatch" });
        }

        const stored = await storageAdapter.get(["pair_state", "pair_state_exp"]);
        console.log("[LeetSync Background] PAIR_FROM_PORTAL received. State payload:", payload.state, "Stored state:", stored.pair_state);

        if (!stored.pair_state || stored.pair_state !== payload.state) {
          return sendResponse({ ok: false, error: "state mismatch or missing" });
        }

        if (!stored.pair_state_exp || stored.pair_state_exp < Date.now()) {
          return sendResponse({ ok: false, error: "pairing state expired" });
        }

        const deviceID = payload.deviceID || payload.device_id;
        const accessToken = payload.accessToken || payload.access_token;
        const refreshToken = payload.refreshToken || payload.refresh_token;

        if (!deviceID || !accessToken || !refreshToken) {
          return sendResponse({ ok: false, error: "missing pairing credentials" });
        }

        await storageAdapter.set({
          device_id: deviceID,
          access_token: accessToken,
          refresh_token: refreshToken,
          paired_at: new Date().toISOString(),
          pair_state: null,
          pair_state_exp: null
        });

        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }
});
