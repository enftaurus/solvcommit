// LeetSync Portal Bridge Content Script
// Listens for SOLVCOMMIT_PAIR postMessage from the web portal,
// forwards it to the background service worker, and returns SOLVCOMMIT_PAIR_RESULT.

(function () {
  const extAPI = typeof browser !== "undefined" ? browser : chrome;
  console.log("[LeetSync Portal Bridge] Initialized on", location.href);

  window.addEventListener("message", (e) => {
    // Only accept messages from same window and origin
    if (e.source !== window || e.origin !== location.origin) {
      return;
    }

    if (!e.data || e.data.type !== "SOLVCOMMIT_PAIR") {
      return;
    }

    console.log("[LeetSync Portal Bridge] Received SOLVCOMMIT_PAIR message, forwarding to background...");

    extAPI.runtime.sendMessage(
      {
        action: "PAIR_FROM_PORTAL",
        payload: e.data,
      },
      (res) => {
        const lastErr = extAPI.runtime.lastError;
        if (lastErr) {
          console.error("[LeetSync Portal Bridge] Background communication error:", lastErr.message);
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

        console.log("[LeetSync Portal Bridge] Received response from background:", res);
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
