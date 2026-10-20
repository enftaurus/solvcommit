// SolvCommit Portal Bridge Content Script
// Listens for SOLVCOMMIT_PAIR postMessage from the web portal,
// forwards it to the background service worker, and returns SOLVCOMMIT_PAIR_RESULT.

(function () {
  const extAPI = typeof browser !== "undefined" ? browser : chrome;
  console.log("[SolvCommit Portal Bridge] Initialized on", location.href);

  // Announce bridge readiness to web page
  try {
    window.postMessage({ type: "SOLVCOMMIT_BRIDGE_READY" }, location.origin);
  } catch (err) {
    // ignore
  }

  window.addEventListener("message", (e) => {
    // Only accept messages from same window and origin
    if (e.source !== window) {
      return;
    }
    if (e.origin !== location.origin && e.origin !== "") {
      return;
    }

    if (e.data?.type === "SOLVCOMMIT_PING") {
      window.postMessage({ type: "SOLVCOMMIT_PONG" }, location.origin);
      return;
    }

    if (!e.data || e.data.type !== "SOLVCOMMIT_PAIR") {
      return;
    }

    console.log("[SolvCommit Portal Bridge] Received SOLVCOMMIT_PAIR message, forwarding to background...");

    extAPI.runtime.sendMessage(
      {
        action: "PAIR_FROM_PORTAL",
        payload: e.data,
      },
      (res) => {
        const lastErr = extAPI.runtime?.lastError;
        if (lastErr) {
          console.error("[SolvCommit Portal Bridge] Background communication error:", lastErr.message);
          window.postMessage(
            {
              type: "SOLVCOMMIT_PAIR_RESULT",
              ok: false,
              error: lastErr.message,
            },
            location.origin
          );
          return;
        }

        console.log("[SolvCommit Portal Bridge] Received response from background:", res);
        window.postMessage(
          {
            type: "SOLVCOMMIT_PAIR_RESULT",
            ok: !!res?.ok,
            error: res?.error,
          },
          location.origin
        );
      }
    );
  });
})();
