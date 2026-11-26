// SolvCommit shared configuration
const FRONTEND_URL = "https://solvcommit.eterno.software";
const API_BASE_URL = "https://api.solvcommit.eterno.software";
const WEB_BASE = FRONTEND_URL;

if (typeof self !== "undefined") {
  self.FRONTEND_URL = FRONTEND_URL;
  self.API_BASE_URL = API_BASE_URL;
  self.WEB_BASE = WEB_BASE;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { FRONTEND_URL, API_BASE_URL, WEB_BASE };
}
