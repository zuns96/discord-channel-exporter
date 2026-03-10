// Background service worker: handles Discord API calls and export logic

const DISCORD_API = "https://discord.com/api/v10";
const MESSAGES_PER_REQUEST = 100;

// Fetch messages from Discord API with pagination
async function fetchMessages(token, channelId, after, before, onProgress) {
  const headers = {
    Authorization: token,
    "Content-Type": "application/json",
  };

  const allMessages = [];
  let cursor = after ? snowflakeFromDate(after) : null;
  const beforeSnowflake = before ? snowflakeFromDate(before, true) : null;
  let page = 0;

  while (true) {
    const params = new URLSearchParams({ limit: String(MESSAGES_PER_REQUEST) });
    if (cursor) params.set("after", cursor);

    const url = `${DISCORD_API}/channels/${channelId}/messages?${params}`;
    const resp = await fetch(url, { headers });

    if (resp.status === 429) {
      const retryData = await resp.json();
      const waitMs = (retryData.retry_after || 1) * 1000;
      onProgress?.({
        type: "rate_limit",
        waitMs,
        fetched: allMessages.length,
      });
      await sleep(waitMs);
      continue;
    }

    if (!resp.ok) {
      const errorBody = await resp.text();
      throw new Error(`Discord API error ${resp.status}: ${errorBody}`);
    }

    const batch = await resp.json();
    if (batch.length === 0) break;

    // API returns newest-first when using 'after', so reverse for chronological
    batch.sort((a, b) => a.id.localeCompare(b.id));

    for (const msg of batch) {
      // Filter by end date
      if (beforeSnowflake && msg.id > beforeSnowflake) {
        return allMessages;
      }
      allMessages.push(msg);
    }

    page++;
    onProgress?.({ type: "progress", fetched: allMessages.length, page });

    // Move cursor to last message ID
    cursor = batch[batch.length - 1].id;

    // If we got fewer than the limit, we've reached the end
    if (batch.length < MESSAGES_PER_REQUEST) break;

    // Small delay to be nice to the API
    await sleep(200);
  }

  return allMessages;
}

// Discord Snowflake ID utilities
// Snowflake = (timestamp_ms - DISCORD_EPOCH) << 22
const DISCORD_EPOCH = 1420070400000n;

function snowflakeFromDate(dateStr, endOfDay = false) {
  const date = new Date(dateStr);
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  const ms = BigInt(date.getTime());
  return String((ms - DISCORD_EPOCH) << 22n);
}

function dateFromSnowflake(snowflake) {
  const ms = (BigInt(snowflake) >> 22n) + DISCORD_EPOCH;
  return new Date(Number(ms));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Format message for export
function formatMessage(msg) {
  const timestamp = new Date(msg.timestamp);
  const author = msg.author?.global_name || msg.author?.username || "Unknown";
  const authorTag = msg.author?.username || "unknown";

  let content = msg.content || "";

  // Attachments
  const attachments = (msg.attachments || [])
    .map((a) => `[Attachment: ${a.filename} - ${a.url}]`)
    .join("\n");

  // Embeds
  const embeds = (msg.embeds || [])
    .map((e) => {
      const parts = [];
      if (e.title) parts.push(`[Embed: ${e.title}]`);
      if (e.description) parts.push(e.description);
      if (e.url) parts.push(e.url);
      return parts.join(" ");
    })
    .join("\n");

  // Stickers
  const stickers = (msg.sticker_items || [])
    .map((s) => `[Sticker: ${s.name}]`)
    .join(" ");

  // Reactions
  const reactions = (msg.reactions || [])
    .map(
      (r) => `${r.emoji?.name || "?"}(${r.count})`
    )
    .join(" ");

  return {
    id: msg.id,
    timestamp,
    author,
    authorTag,
    authorId: msg.author?.id,
    avatarUrl: msg.author?.avatar
      ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png?size=64`
      : null,
    content,
    attachments,
    embeds,
    stickers,
    reactions,
    isPinned: msg.pinned || false,
    isReply: !!msg.referenced_message,
    replyTo: msg.referenced_message?.author?.username || null,
    replyContent: msg.referenced_message?.content?.substring(0, 100) || null,
    type: msg.type,
  };
}

// Export to CSV
function exportToCsv(messages, channelName) {
  const formatted = messages.map(formatMessage);
  const headers = [
    "Timestamp",
    "Author",
    "AuthorTag",
    "Content",
    "Attachments",
    "Embeds",
    "Reactions",
    "Pinned",
    "MessageID",
  ];

  const escCsv = (val) => {
    const str = String(val ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = formatted.map((m) =>
    [
      m.timestamp.toISOString(),
      m.author,
      m.authorTag,
      m.content,
      m.attachments,
      m.embeds,
      m.reactions,
      m.isPinned,
      m.id,
    ]
      .map(escCsv)
      .join(",")
  );

  // BOM for Excel UTF-8 compatibility
  return "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
}

// Export to HTML
function exportToHtml(messages, channelName, guildName) {
  const formatted = messages.map(formatMessage);

  const escHtml = (str) =>
    String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  // Convert Discord markdown to HTML (basic)
  const mdToHtml = (text) => {
    if (!text) return "";
    let html = escHtml(text);
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Italic
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/_(.+?)_/g, "<em>$1</em>");
    // Underline
    html = html.replace(/__(.+?)__/g, "<u>$1</u>");
    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, "<s>$1</s>");
    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Code block
    html = html.replace(
      /```(\w*)\n?([\s\S]*?)```/g,
      '<pre><code class="lang-$1">$2</code></pre>'
    );
    // Links
    html = html.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank">$1</a>'
    );
    // Newlines
    html = html.replace(/\n/g, "<br>");
    return html;
  };

  const messageHtml = formatted
    .map((m) => {
      const replyHtml = m.isReply
        ? `<div class="reply"><span class="reply-icon">&#8617;</span> <span class="reply-author">@${escHtml(m.replyTo)}</span> <span class="reply-content">${escHtml(m.replyContent)}</span></div>`
        : "";

      const attachHtml = m.attachments
        ? `<div class="attachments">${escHtml(m.attachments)}</div>`
        : "";

      const embedHtml = m.embeds
        ? `<div class="embeds">${mdToHtml(m.embeds)}</div>`
        : "";

      const reactHtml = m.reactions
        ? `<div class="reactions">${escHtml(m.reactions)}</div>`
        : "";

      const pinnedClass = m.isPinned ? " pinned" : "";

      const timeStr = m.timestamp.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      return `
      <div class="message${pinnedClass}">
        ${replyHtml}
        <div class="message-header">
          ${m.avatarUrl ? `<img class="avatar" src="${m.avatarUrl}" alt="">` : '<div class="avatar placeholder"></div>'}
          <span class="author">${escHtml(m.author)}</span>
          <span class="timestamp">${timeStr}</span>
          ${m.isPinned ? '<span class="pin-badge">&#128204; Pinned</span>' : ""}
        </div>
        <div class="message-content">${mdToHtml(m.content)}</div>
        ${attachHtml}
        ${embedHtml}
        ${reactHtml}
      </div>`;
    })
    .join("\n");

  const dateRange =
    formatted.length > 0
      ? `${formatted[0].timestamp.toLocaleDateString("ko-KR")} ~ ${formatted[formatted.length - 1].timestamp.toLocaleDateString("ko-KR")}`
      : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${escHtml(guildName)} - #${escHtml(channelName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #313338;
    color: #dbdee1;
    line-height: 1.5;
  }
  .export-header {
    background: #2b2d31;
    padding: 20px 24px;
    border-bottom: 1px solid #1e1f22;
  }
  .export-header h1 {
    font-size: 18px;
    color: #f2f3f5;
  }
  .export-header .meta {
    font-size: 13px;
    color: #949ba4;
    margin-top: 4px;
  }
  .messages { padding: 16px 0; }
  .message {
    padding: 4px 24px;
    display: flex;
    flex-direction: column;
  }
  .message:hover { background: #2e3035; }
  .message.pinned { border-left: 3px solid #f0b232; padding-left: 21px; }
  .message-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 2px;
  }
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .avatar.placeholder {
    background: #5865f2;
  }
  .author {
    font-weight: 600;
    color: #f2f3f5;
    font-size: 15px;
  }
  .timestamp {
    font-size: 12px;
    color: #949ba4;
  }
  .pin-badge {
    font-size: 11px;
    color: #f0b232;
    margin-left: 4px;
  }
  .message-content {
    margin-left: 48px;
    font-size: 15px;
    word-wrap: break-word;
    white-space: pre-wrap;
  }
  .message-content code {
    background: #1e1f22;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Consolas', monospace;
    font-size: 14px;
  }
  .message-content pre {
    background: #1e1f22;
    padding: 12px;
    border-radius: 8px;
    margin: 4px 0;
    overflow-x: auto;
  }
  .message-content pre code {
    padding: 0;
    background: none;
  }
  .message-content strong { color: #f2f3f5; }
  .message-content a { color: #00a8fc; text-decoration: none; }
  .message-content a:hover { text-decoration: underline; }
  .reply {
    margin-left: 48px;
    font-size: 13px;
    color: #949ba4;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .reply-author { color: #b5bac1; font-weight: 500; }
  .reply-content {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 400px;
  }
  .attachments, .embeds {
    margin-left: 48px;
    font-size: 13px;
    color: #949ba4;
    margin-top: 4px;
  }
  .reactions {
    margin-left: 48px;
    font-size: 13px;
    color: #b5bac1;
    margin-top: 4px;
  }
  .separator {
    text-align: center;
    padding: 8px 0;
    font-size: 12px;
    color: #949ba4;
    position: relative;
  }
  .separator::before {
    content: '';
    position: absolute;
    left: 24px;
    right: 24px;
    top: 50%;
    height: 1px;
    background: #3f4147;
  }
  .separator span {
    background: #313338;
    padding: 0 12px;
    position: relative;
  }
  .footer {
    text-align: center;
    padding: 16px;
    font-size: 12px;
    color: #949ba4;
    border-top: 1px solid #3f4147;
  }
</style>
</head>
<body>
<div class="export-header">
  <h1>${escHtml(guildName)} &gt; #${escHtml(channelName)}</h1>
  <div class="meta">${formatted.length.toLocaleString()}개 메시지 | ${dateRange}</div>
  <div class="meta">Exported by Discord Channel Exporter</div>
</div>
<div class="messages">
${messageHtml}
</div>
<div class="footer">
  Discord Channel Exporter &mdash; ${new Date().toLocaleString("ko-KR")} 내보내기
</div>
</body>
</html>`;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "EXPORT_MESSAGES") {
    handleExport(msg, sendResponse);
    return true; // async
  }
});

async function handleExport({
  token,
  channelId,
  channelName,
  guildName,
  format,
  afterDate,
  beforeDate,
}) {
  try {
    // Notify popup that export started
    chrome.runtime.sendMessage({
      type: "EXPORT_PROGRESS",
      data: { type: "started" },
    });

    const messages = await fetchMessages(
      token,
      channelId,
      afterDate || null,
      beforeDate || null,
      (progress) => {
        chrome.runtime.sendMessage({
          type: "EXPORT_PROGRESS",
          data: progress,
        });
      }
    );

    if (messages.length === 0) {
      chrome.runtime.sendMessage({
        type: "EXPORT_DONE",
        data: { error: "해당 기간에 메시지가 없습니다." },
      });
      return;
    }

    let content, mimeType, extension;

    if (format === "csv") {
      content = exportToCsv(messages, channelName);
      mimeType = "text/csv;charset=utf-8";
      extension = "csv";
    } else if (format === "html") {
      content = exportToHtml(messages, channelName, guildName);
      mimeType = "text/html;charset=utf-8";
      extension = "html";
    } else if (format === "pdf") {
      // Generate HTML and open in new tab with "Save as PDF" button
      content = exportToHtml(messages, channelName, guildName);
      mimeType = "text/html;charset=utf-8";
      extension = "html";
    }

    // Sanitize filename: remove characters not allowed in filenames
    const safeName = `${guildName}-${channelName}`
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, "_")
      .substring(0, 100);
    const filename = `${safeName}-${new Date().toISOString().slice(0, 10)}.${extension}`;

    if (format === "pdf") {
      // For PDF: inject "Save as PDF" button and print styles, open in new tab
      const pdfButton = `
<style>
  #pdf-save-btn {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 99999;
    background: #5865f2;
    color: #fff;
    border: none;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
  }
  #pdf-save-btn:hover { background: #4752c4; }
  @media print {
    #pdf-save-btn { display: none !important; }
    body { background: #fff !important; color: #000 !important; }
    .export-header { background: #f5f5f5 !important; border-bottom-color: #ddd !important; }
    .export-header h1 { color: #000 !important; }
    .export-header .meta { color: #555 !important; }
    .messages { padding: 8px 0 !important; }
    .message:hover { background: transparent !important; }
    .message.pinned { border-left-color: #f0b232 !important; }
    .message-header .author { color: #000 !important; }
    .message-header .timestamp { color: #555 !important; }
    .message-content { color: #000 !important; }
    .message-content strong { color: #000 !important; }
    .message-content code { background: #eee !important; color: #000 !important; }
    .message-content pre { background: #f5f5f5 !important; }
    .message-content a { color: #0066cc !important; }
    .reply, .attachments, .embeds { color: #555 !important; }
    .reactions { color: #333 !important; }
    .separator::before { background: #ddd !important; }
    .separator span { background: #fff !important; color: #555 !important; }
    .footer { color: #555 !important; border-top-color: #ddd !important; }
  }
  @page { margin: 1cm; }
</style>
<button id="pdf-save-btn" onclick="this.style.display='none';window.print();">PDF로 저장</button>`;
      content = content.replace("</body>", pdfButton + "\n</body>");

      const encoder = new TextEncoder();
      const bytes = encoder.encode(content);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const dataUrl = `data:text/html;charset=utf-8;base64,${base64}`;
      chrome.tabs.create({ url: dataUrl, active: true });
    } else {
      // For HTML/CSV: direct download
      const encoder = new TextEncoder();
      const bytes = encoder.encode(content);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      const dataUrl = `data:${mimeType};base64,${base64}`;
      chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: true,
      });
    }

    chrome.runtime.sendMessage({
      type: "EXPORT_DONE",
      data: { success: true, count: messages.length, filename },
    });
  } catch (err) {
    chrome.runtime.sendMessage({
      type: "EXPORT_DONE",
      data: { error: err.message },
    });
  }
}
