// Content script: extracts Discord auth token and channel info from the page

(function () {
  "use strict";

  // Extract token from Discord's webpack modules
  function extractToken() {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    const result =
      iframe.contentWindow?.localStorage?.getItem("token") ??
      localStorage.getItem("token");

    iframe.remove();

    if (result) {
      // Token is stored as a JSON string with quotes
      return result.replace(/^"|"$/g, "");
    }

    return null;
  }

  // Parse channel ID from current URL
  // Discord URL format: https://discord.com/channels/{guildId}/{channelId}
  function parseChannelFromUrl() {
    const match = window.location.pathname.match(
      /\/channels\/(\d+|@me)\/(\d+)/
    );
    if (!match) return null;

    return {
      guildId: match[1] === "@me" ? null : match[1],
      channelId: match[2],
      isDM: match[1] === "@me",
    };
  }

  // Get channel name from DOM
  function getChannelName() {
    // Try the header title
    const headerEl = document.querySelector(
      'h1[class*="title"], [class*="channelName"] h1, [class*="title-"] [class*="lineClamp"]'
    );
    if (headerEl) return headerEl.textContent.trim();

    // Fallback: selected channel in sidebar
    const selected = document.querySelector(
      '[class*="selected"] [class*="channelName"], [class*="modeSelected"] [class*="name"]'
    );
    if (selected) return selected.textContent.trim();

    return null;
  }

  // Get guild (server) name from DOM
  function getGuildName() {
    const el = document.querySelector(
      'h1[class*="guildName"], [class*="name-"][class*="overflow"]'
    );
    if (el) return el.textContent.trim();

    // Fallback: header
    const header = document.querySelector('[class*="guildHeader"] span');
    if (header) return header.textContent.trim();

    return null;
  }

  // Listen for requests from popup/background
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "GET_CHANNEL_INFO") {
      const channel = parseChannelFromUrl();
      if (!channel) {
        sendResponse({ error: "Discord 채널 페이지가 아닙니다." });
        return;
      }

      const token = extractToken();
      if (!token) {
        sendResponse({
          error:
            "Discord 토큰을 감지할 수 없습니다. Discord에 로그인되어 있는지 확인하세요.",
        });
        return;
      }

      sendResponse({
        token,
        channelId: channel.channelId,
        guildId: channel.guildId,
        isDM: channel.isDM,
        channelName: getChannelName() || `channel-${channel.channelId}`,
        guildName: channel.isDM ? "DM" : getGuildName() || "Unknown Server",
      });
    }

    // Return true to keep the message channel open for async response
    return true;
  });
})();
