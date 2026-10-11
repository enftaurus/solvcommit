// LeetSync Phase 0 Spike - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log("[LeetSync Spike] Installed Phase 0 Capture Spike extension");
});

// Listener to assist content script with cookie retrieval or background fetch if requested
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getCookies") {
    chrome.cookies.get({ url: "https://leetcode.com", name: "csrftoken" }, (cookie) => {
      sendResponse({ csrftoken: cookie ? cookie.value : null });
    });
    return true; // Keep channel open for async response
  }
});
