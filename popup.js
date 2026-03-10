// Popup script: UI logic for the export popup

let channelInfo = null;
let selectedFormat = "html";

// DOM elements
const mainContent = document.getElementById("main-content");
const notDiscord = document.getElementById("not-discord");
const serverNameEl = document.getElementById("server-name");
const channelNameEl = document.getElementById("channel-name");
const dateAfterEl = document.getElementById("date-after");
const dateBeforeEl = document.getElementById("date-before");
const exportBtn = document.getElementById("export-btn");
const statusEl = document.getElementById("status");
const progressBar = document.getElementById("progress-bar");
const progressFill = document.getElementById("progress-fill");

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  // Restore saved settings or use defaults (last 30 days, html)
  const saved = await chrome.storage.local.get(["afterDate", "beforeDate", "format"]);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  dateBeforeEl.value = saved.beforeDate || now.toISOString().slice(0, 10);
  dateAfterEl.value = saved.afterDate || thirtyDaysAgo.toISOString().slice(0, 10);

  // Restore format selection
  if (saved.format) {
    selectedFormat = saved.format;
    document.querySelectorAll(".format-btn").forEach((b) => {
      b.classList.toggle("selected", b.dataset.format === saved.format);
    });
  }

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url?.includes("discord.com/channels/")) {
    notDiscord.style.display = "block";
    return;
  }

  // Request channel info from content script
  try {
    chrome.tabs.sendMessage(tab.id, { type: "GET_CHANNEL_INFO" }, (resp) => {
      if (chrome.runtime.lastError || !resp || resp.error) {
        notDiscord.style.display = "block";
        if (resp?.error) {
          notDiscord.querySelector("p").textContent = resp.error;
        }
        return;
      }

      channelInfo = resp;
      serverNameEl.textContent = resp.guildName;
      channelNameEl.textContent = resp.channelName;
      mainContent.style.display = "block";
    });
  } catch {
    notDiscord.style.display = "block";
  }
});

// Save date settings on change
dateAfterEl.addEventListener("change", () => {
  chrome.storage.local.set({ afterDate: dateAfterEl.value });
});
dateBeforeEl.addEventListener("change", () => {
  chrome.storage.local.set({ beforeDate: dateBeforeEl.value });
});

// Format button selection
document.querySelectorAll(".format-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".format-btn")
      .forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedFormat = btn.dataset.format;
    chrome.storage.local.set({ format: selectedFormat });
  });
});

// Export button
exportBtn.addEventListener("click", async () => {
  if (!channelInfo) return;

  exportBtn.disabled = true;
  exportBtn.textContent = "Exporting...";
  statusEl.className = "status info";
  statusEl.textContent = "Fetching messages...";
  progressBar.classList.add("active");
  progressFill.style.width = "10%";

  chrome.runtime.sendMessage({
    type: "EXPORT_MESSAGES",
    token: channelInfo.token,
    channelId: channelInfo.channelId,
    channelName: channelInfo.channelName,
    guildName: channelInfo.guildName,
    format: selectedFormat,
    afterDate: dateAfterEl.value || null,
    beforeDate: dateBeforeEl.value || null,
  });
});

// Listen for progress updates from background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "EXPORT_PROGRESS") {
    const d = msg.data;
    if (d.type === "progress") {
      statusEl.className = "status info";
      statusEl.textContent = `${d.fetched.toLocaleString()}개 메시지 수집 중... (page ${d.page})`;
      // Animate progress bar (we don't know total, so pulse)
      progressFill.style.width = `${Math.min(90, 10 + d.page * 5)}%`;
    } else if (d.type === "rate_limit") {
      statusEl.className = "status info";
      statusEl.textContent = `Rate limit - ${(d.waitMs / 1000).toFixed(1)}초 대기 중... (${d.fetched}개 수집됨)`;
    }
  }

  if (msg.type === "EXPORT_DONE") {
    exportBtn.disabled = false;
    exportBtn.textContent = "Export Messages";
    progressBar.classList.remove("active");

    if (msg.data.error) {
      statusEl.className = "status error";
      statusEl.textContent = msg.data.error;
    } else {
      statusEl.className = "status success";
      statusEl.textContent = `${msg.data.count.toLocaleString()}개 메시지 내보내기 완료!`;
      progressFill.style.width = "100%";
    }
  }
});
