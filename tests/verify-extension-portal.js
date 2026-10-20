const { chromium } = require("playwright");
const http = require("http");
const path = require("path");
const fs = require("fs");

async function main() {
  console.log("=== SolvCommit Extension & Web Portal Linking Verification ===");

  const extPath = path.resolve(__dirname, "../extension");
  const userDataDir = path.resolve(__dirname, "../.playwright-test-user-data");

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  // 1. Create a lightweight local HTTP server running at port 8080 serving a test /connect-extension page
  const testState = "playwright-uuid-" + Date.now();
  let serverReceived = null;

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost:8080");

    if (url.pathname === "/connect-extension") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Connect Extension Test</title></head>
        <body>
          <h1>SolvCommit Connect Extension Test</h1>
          <div id="status">Connecting...</div>
          <script>
            const state = "${testState}";
            const payload = {
              type: "SOLVCOMMIT_PAIR",
              state: state,
              deviceID: "dev_playwright_test",
              accessToken: "acc_token_playwright",
              refreshToken: "ref_token_playwright"
            };

            window.addEventListener("message", (e) => {
              console.log("[Page] Received message:", e.data);
              if (e.data && e.data.type === "SOLVCOMMIT_PAIR_RESULT") {
                document.getElementById("status").textContent = e.data.ok ? "PAIRED_SUCCESS" : "PAIRED_FAILED: " + e.data.error;
                window.__pairResult = e.data;
              }
            });

            // Periodically post SOLVCOMMIT_PAIR until result is received
            const timer = setInterval(() => {
              if (window.__pairResult) {
                clearInterval(timer);
                return;
              }
              console.log("[Page] Posting SOLVCOMMIT_PAIR message...");
              window.postMessage(payload, window.location.origin);
            }, 300);
          </script>
        </body>
        </html>
      `);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(8080, "127.0.0.1", resolve));
  console.log("Test HTTP server listening on http://127.0.0.1:8080");

  try {
    // 2. Launch browser with extension loaded
    console.log("Launching Chromium with SolvCommit extension loaded from:", extPath);
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        "--headless=new",
        `--disable-extensions-except=${extPath}`,
        `--load-extension=${extPath}`,
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });

    // 3. Find background worker or wait for extension to load
    let backgroundWorker = context.serviceWorkers()[0];
    if (!backgroundWorker) {
      backgroundWorker = await context.waitForEvent("serviceworker", { timeout: 7000 }).catch(() => null);
    }
    console.log("Background Service Worker active:", !!backgroundWorker);

    // Pre-populate extension storage with the valid pair_state (simulating clicking 'Log in' in popup)
    if (backgroundWorker) {
      await backgroundWorker.evaluate(async (state) => {
        const extAPI = typeof browser !== "undefined" ? browser : chrome;
        await extAPI.storage.local.set({
          pair_state: state,
          pair_state_exp: Date.now() + 10 * 60 * 1000,
        });
        console.log("[Worker] Pre-populated pair_state:", state);
      }, testState);
    }

    // 4. Navigate page to http://localhost:8080/connect-extension?state=...
    const page = await context.newPage();
    page.on("console", (msg) => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));

    const targetUrl = `http://localhost:8080/connect-extension?state=${encodeURIComponent(testState)}`;
    console.log("Navigating page to:", targetUrl);
    await page.goto(targetUrl);

    // 5. Wait for the page status element to indicate success
    console.log("Waiting for pairing handshake completion...");
    await page.waitForFunction(
      () => {
        const el = document.getElementById("status");
        return el && el.textContent.startsWith("PAIRED_");
      },
      { timeout: 10000 }
    );

    const finalStatus = await page.$eval("#status", (el) => el.textContent);
    console.log("Final pairing result on page:", finalStatus);

    if (finalStatus === "PAIRED_SUCCESS") {
      console.log(" SUCCESS: SolvCommit extension content script was injected, captured pairing message, forwarded to background, and returned success to the web page!");
    } else {
      throw new Error("Pairing failed: " + finalStatus);
    }

    // 6. Verify credentials in extension storage
    if (backgroundWorker) {
      const stored = await backgroundWorker.evaluate(async () => {
        const extAPI = typeof browser !== "undefined" ? browser : chrome;
        return await new Promise((resolve) => extAPI.storage.local.get(null, resolve));
      });
      console.log("Extension storage contents after pairing:", {
        device_id: stored.device_id,
        access_token: stored.access_token ? "***" : null,
        refresh_token: stored.refresh_token ? "***" : null,
        paired_at: stored.paired_at,
        pair_state: stored.pair_state,
      });

      if (stored.device_id !== "dev_playwright_test") {
        throw new Error("device_id not found in extension storage!");
      }
      if (stored.pair_state !== null) {
        throw new Error("pair_state was not cleaned up after pairing!");
      }
      console.log(" Storage check PASSED: credentials saved and pair_state cleaned up!");
    }

    await context.close();
  } finally {
    server.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
