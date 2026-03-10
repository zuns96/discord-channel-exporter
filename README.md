# Discord Channel Exporter

**Chrome extension to export Discord channel messages to HTML, CSV, or PDF.**

---

## Features

- **Auto-detect channel** — Automatically detects the Discord channel you're currently viewing
- **Date range filtering** — Export only messages within a specific date range
- **Multiple export formats** — HTML (Discord dark theme), CSV (Excel-compatible), PDF (via print dialog)
- **Discord markdown support** — Bold, italic, code blocks, links, and more are preserved in HTML export
- **Rate limit handling** — Automatically waits and retries when Discord API rate limits are hit
- **Progress tracking** — Real-time progress indicator while fetching messages

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/zuns96/discord-channel-exporter.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **"Load unpacked"** and select the cloned `discord-channel-exporter` folder
5. Navigate to [discord.com](https://discord.com) and open any channel
6. Click the extension icon in the toolbar to start exporting!

## Usage

1. Open Discord in Chrome and navigate to the channel you want to export.
2. Click the Discord Channel Exporter icon in the toolbar.
3. Set the **Start Date** and **End Date** (default: last 30 days).
4. Select the export format:

   | Format | Description |
   |--------|-------------|
   | **HTML** | Discord dark theme replica with full markdown rendering |
   | **CSV** | Spreadsheet-compatible with BOM for Excel |
   | **PDF** | Opens HTML in new tab — use Ctrl+P / Cmd+P to save as PDF |

5. Click **"Export Messages"** and wait for the download.

## How It Works

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Content Script  │────▶│  Background  │────▶│  Discord API    │
│                  │     │  Service     │     │  v10            │
│ • Channel ID     │     │  Worker      │     │                 │
│ • Auth token     │     │              │     │ GET /channels/  │
│ • Channel name   │     │ • Pagination │     │   {id}/messages │
└──────────────────┘     │ • Formatting │     └─────────────────┘
                         │ • Export     │
                         └──────┬───────┘
                                │
                     ┌──────────┼──────────┐
                     ▼          ▼          ▼
                   HTML        CSV        PDF
```

1. **Content Script** extracts the channel ID from the page URL and the auth token from `localStorage`.
2. **Background Service Worker** calls the Discord REST API (v10) with pagination to fetch all messages in the specified date range. It uses [Snowflake IDs](https://discord.com/developers/docs/reference#snowflakes) for efficient date-based cursor pagination.
3. Messages are formatted into the selected output format and downloaded via `chrome.downloads` API (or opened in a new tab for PDF).

## Project Structure

```
discord-channel-exporter/
├── manifest.json   # Chrome Extension Manifest V3
├── background.js   # Service worker: API calls, message fetching, format conversion
├── content.js      # Content script: channel detection, token extraction
├── popup.html      # Extension popup UI (Discord dark theme)
├── popup.js        # Popup interaction logic
├── icons/          # Extension icons (16/48/128px)
├── LICENSE         # MIT License
└── README.md
```

## Limitations

- This extension uses your Discord **user token** from the browser session. Using user tokens for automation is against [Discord's Terms of Service](https://discord.com/terms). Use at your own risk.
- Very large exports (100,000+ messages) may hit browser memory limits due to base64 encoding for the download. Consider narrowing the date range for large channels.
- PDF export opens the HTML in a new tab and triggers the browser's print dialog. You need to manually select "Save as PDF" in the print options.

## License

[MIT License](LICENSE)

---

# Discord Channel Exporter (한국어)

**현재 보고 있는 Discord 채널의 메시지를 HTML, CSV, PDF로 내보내는 크롬 확장 프로그램입니다.**

---

## 기능

- **채널 자동 감지** — 현재 보고 있는 Discord 채널을 자동으로 감지합니다
- **날짜 범위 필터링** — 시작일과 종료일을 지정하여 해당 기간의 메시지만 추출합니다
- **다양한 내보내기 포맷** — HTML (Discord 다크 테마), CSV (Excel 호환), PDF (인쇄 다이얼로그)
- **Discord 마크다운 지원** — 볼드, 이탤릭, 코드 블록, 링크 등이 HTML에서 그대로 유지됩니다
- **Rate limit 자동 처리** — Discord API 제한에 걸리면 자동으로 대기 후 재시도합니다
- **진행률 표시** — 메시지 수집 중 실시간 진행 상황을 표시합니다

## 설치 방법

1. 이 저장소를 클론합니다:
   ```bash
   git clone https://github.com/zuns96/discord-channel-exporter.git
   ```
2. Chrome을 열고 `chrome://extensions/`로 이동합니다.
3. 우측 상단의 **개발자 모드**를 활성화합니다.
4. **"압축해제된 확장 프로그램을 로드합니다"** 를 클릭하고 클론한 폴더를 선택합니다.
5. [discord.com](https://discord.com)에서 아무 채널이나 엽니다.
6. 툴바의 확장 프로그램 아이콘을 클릭하면 바로 사용할 수 있습니다!

## 사용법

1. Chrome에서 Discord를 열고 내보내려는 채널로 이동합니다.
2. 툴바에서 Discord Channel Exporter 아이콘을 클릭합니다.
3. **시작일**과 **종료일**을 설정합니다 (기본값: 최근 30일).
4. 내보내기 포맷을 선택합니다:

   | 포맷 | 설명 |
   |------|------|
   | **HTML** | Discord 다크 테마 그대로 재현, 마크다운 완전 지원 |
   | **CSV** | Excel 호환 스프레드시트 (BOM 포함) |
   | **PDF** | 새 탭에서 HTML 열기 → Ctrl+P / Cmd+P로 PDF 저장 |

5. **"Export Messages"** 를 클릭하고 다운로드를 기다립니다.

## 동작 방식

1. **Content Script**가 페이지 URL에서 채널 ID를, `localStorage`에서 인증 토큰을 추출합니다.
2. **Background Service Worker**가 Discord REST API (v10)를 호출하여 지정된 기간의 메시지를 페이지네이션으로 수집합니다. [Snowflake ID](https://discord.com/developers/docs/reference#snowflakes)를 사용하여 날짜 기반 커서 페이지네이션을 수행합니다.
3. 메시지를 선택한 포맷으로 변환한 뒤 `chrome.downloads` API로 다운로드합니다 (PDF는 새 탭에서 열림).

## 제한 사항

- 이 확장은 브라우저 세션의 Discord **사용자 토큰**을 사용합니다. 사용자 토큰을 자동화에 사용하는 것은 [Discord 서비스 약관](https://discord.com/terms)에 위배될 수 있습니다. 본인 책임 하에 사용하세요.
- 매우 큰 내보내기 (10만 메시지 이상)는 다운로드 시 base64 인코딩으로 인해 브라우저 메모리 제한에 걸릴 수 있습니다. 대규모 채널은 날짜 범위를 좁혀서 사용하세요.
- PDF 내보내기는 HTML을 새 탭에서 열고 인쇄 다이얼로그를 표시합니다. 인쇄 옵션에서 "PDF로 저장"을 직접 선택해야 합니다.

## 라이선스

[MIT License](LICENSE)
