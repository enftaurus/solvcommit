// SolvCommit Main-World Interceptor (Manifest V3 - Page JS Context)
// Intercepts submit requests directly in the page execution context and notifies content script.
(() => {
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const input = args[0];
      const url = new URL(typeof input === 'string' ? input : (input && input.url ? input.url : ''), location.origin);
      if (/^\/problems\/[^/]+\/submit\/?$/.test(url.pathname)) {
        res.clone().json().then((d) => {
          if (d && d.submission_id) {
            window.postMessage({ type: 'SOLVCOMMIT_SUBMISSION_DETECTED', submissionId: String(d.submission_id) }, location.origin);
          }
        }).catch(() => {});
      }
    } catch (_) {}
    return res;
  };
})();
