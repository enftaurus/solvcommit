// LeetSync Popup Controller (Cross-browser: Chrome & Firefox)

document.addEventListener("DOMContentLoaded", async () => {
  const extAPI = typeof browser !== "undefined" ? browser : chrome;
  const statusBadge = document.getElementById("statusBadge");
  const deviceIdVal = document.getElementById("deviceIdVal");
  const queueCountVal = document.getElementById("queueCountVal");
  const healthVal = document.getElementById("healthVal");
  const openDashboardBtn = document.getElementById("openDashboardBtn");

  const pairContainer = document.getElementById("pairContainer");
  const togglePairBtn = document.getElementById("togglePairBtn");
  const pairForm = document.getElementById("pairForm");
  const pairInput = document.getElementById("pairInput");
  const submitPairBtn = document.getElementById("submitPairBtn");
  const pairError = document.getElementById("pairError");

  function refreshStatus() {
    extAPI.runtime.sendMessage({ action: "GET_QUEUE_STATUS" }, (res) => {
      if (res && res.isPaired) {
        statusBadge.textContent = "Paired";
        statusBadge.className = "status-badge badge-paired";
        deviceIdVal.textContent = res.deviceID ? res.deviceID.slice(0, 8) + "..." : "Active";
        queueCountVal.textContent = res.pendingCount;
        if (togglePairBtn) togglePairBtn.textContent = "Re-pair Device";
      } else {
        statusBadge.textContent = "Unpaired";
        statusBadge.className = "status-badge badge-unpaired";
        deviceIdVal.textContent = "Not Paired";
        queueCountVal.textContent = res?.pendingCount || 0;
        if (togglePairBtn) togglePairBtn.textContent = "Pair With Dashboard";
      }
    });
  }

  refreshStatus();

  // Probe backend liveness
  try {
    const probe = await fetch("http://localhost:8080/api/v1/health/live");
    if (probe.ok) {
      healthVal.textContent = "Online";
      healthVal.style.color = "#34d399";
    } else {
      healthVal.textContent = "Error (" + probe.status + ")";
      healthVal.style.color = "#f87171";
    }
  } catch (e) {
    healthVal.textContent = "Offline";
    healthVal.style.color = "#f87171";
  }

  // Toggle pairing form
  if (togglePairBtn && pairForm) {
    togglePairBtn.addEventListener("click", () => {
      const isVisible = pairForm.style.display === "block";
      pairForm.style.display = isVisible ? "none" : "block";
    });
  }

  // Submit pairing code
  if (submitPairBtn && pairInput) {
    submitPairBtn.addEventListener("click", () => {
      const rawText = pairInput.value.trim();
      pairError.style.display = "none";

      if (!rawText) {
        pairError.textContent = "Please paste the pairing code";
        pairError.style.display = "block";
        return;
      }

      try {
        const parsed = JSON.parse(rawText);
        const deviceID = parsed.deviceID || parsed.device_id;
        const accessToken = parsed.accessToken || parsed.access_token;
        const refreshToken = parsed.refreshToken || parsed.refresh_token;

        if (!deviceID || !accessToken || !refreshToken) {
          throw new Error("Missing deviceID, accessToken, or refreshToken in JSON");
        }

        extAPI.runtime.sendMessage(
          {
            action: "PAIR_DEVICE",
            deviceID,
            accessToken,
            refreshToken,
          },
          (res) => {
            if (res && res.success) {
              pairForm.style.display = "none";
              pairInput.value = "";
              refreshStatus();
            } else {
              pairError.textContent = "Pairing failed: " + (res?.error || "Unknown error");
              pairError.style.display = "block";
            }
          }
        );
      } catch (err) {
        pairError.textContent = "Invalid pairing payload format";
        pairError.style.display = "block";
      }
    });
  }

  openDashboardBtn.addEventListener("click", () => {
    extAPI.tabs.create({ url: "http://localhost:8080" });
  });
});
