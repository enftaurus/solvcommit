// LeetSync Popup Controller

document.addEventListener("DOMContentLoaded", async () => {
  const statusBadge = document.getElementById("statusBadge");
  const deviceIdVal = document.getElementById("deviceIdVal");
  const queueCountVal = document.getElementById("queueCountVal");
  const healthVal = document.getElementById("healthVal");
  const openDashboardBtn = document.getElementById("openDashboardBtn");

  // Query background for status
  chrome.runtime.sendMessage({ action: "GET_QUEUE_STATUS" }, (res) => {
    if (res && res.isPaired) {
      statusBadge.textContent = "Paired";
      statusBadge.className = "status-badge badge-paired";
      deviceIdVal.textContent = res.deviceID ? res.deviceID.slice(0, 8) + "..." : "Active";
      queueCountVal.textContent = res.pendingCount;
    } else {
      statusBadge.textContent = "Unpaired";
      statusBadge.className = "status-badge badge-unpaired";
      deviceIdVal.textContent = "Not Paired";
      queueCountVal.textContent = res?.pendingCount || 0;
    }
  });

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

  openDashboardBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:8080" });
  });
});
