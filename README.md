# Discord Channel Exporter

**Chrome extension to export Discord channel messages to HTML, CSV, or PDF.**

**현재 보고 있는 Discord 채널의 메시지를 HTML, CSV, PDF로 내보내는 크롬 확장 프로그램입니다.**

---

## Features / 기능

- **Auto-detect channel** — Automatically detects the Discord channel you're currently viewing
- **채널 자동 감지** — 현재 보고 있는 Discord 채널을 자동으로 감지합니다

- **Date range filtering** — Export only messages within a specific date range
- **날짜 범위 필터링** — 시작일과 종료일을 지정하여 해당 기간의 메시지만 추출합니다

- **Multiple export formats** — HTML (Discord dark theme), CSV (Excel-compatible), PDF (via print dialog)
- **다양한 내보내기 포맷** — HTML (Discord 다크 테마), CSV (Excel 호환), PDF (인쇄 다이얼로그)

- **Discord markdown support** — Bold, italic, code blocks, links, and more are preserved in HTML export
- **Discord 마크다운 지원** — 볼드, 이탤릭, 코드 블록, 링크 등이 HTML에서 그대로 유지됩니다

- **Rate limit handling** — Automatically waits and retries when Discord API rate limits are hit
- **Rate limit 자동 처리** — Discord API 제한에 걸리면 자동으로 대기 후 재시도합니다

- **Progress tracking** — Real-time progress indicator while fetching messages
- **진행률 표시** — 메시지 수집 중 실시간 진행 상황을 표시합니다

## Screenshots / 스크린샷

| Popup UI | HTML Export |
|----------|-------------|
| Discord-styled dark theme popup with date picker and format selection | Exported HTML replicates Discord's look and feel |

## Installation / 설치 방법

### From source / 소스에서 설치

1. Clone this repository / 이 저장소를 클론합니다:
   ```bash
   git clone https://github.com/zuns96/discord-channel-exporter.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

   Chrome을 열고 `chrome://extensions/`로 이동합니다.

3. Enable **Developer mode** (toggle in the top-right corner)

   우측 상단의 **개발자 모드**를 활성화합니다.

4. Click **"Load unpacked"** and select the cloned `discord-channel-exporter` folder

   **"압축해제된 확장 프로그램을 로드합니다"** 를 클릭하고 클론한 폴더를 선택합니다.

5. Navigate to [discord.com](https://discord.com) and open any channel

   [discord.com](https://discord.com)에서 아무 채널이나 엽니다.

6. Click the extension icon in the toolbar to start exporting!

   툴바의 확장 프로그램 아이콘을 클릭하면 바로 사용할 수 있습니다!

## Usage / 사용법

1. Open Discord in Chrome and navigate to the channel you want to export.

   Chrome에서 Discord를 열고 내보내려는 채널로 이동합니다.

2. Click the Discord Channel Exporter icon in the toolbar.

   툴바에서 Discord Channel Exporter 아이콘을 클릭합니다.

3. Set the **Start Date** and **End Date** (default: last 30 days).

   **시작일**과 **종료일**을 설정합니다 (기본값: 최근 30일).

4. Select the export format:

   내보내기 포맷을 선택합니다:

   | Format | Description / 설명 |
   |--------|-------------------|
   | **HTML** | Discord dark theme replica with full markdown rendering / Discord 다크 테마 그대로 재현, 마크다운 완전 지원 |
   | **CSV** | Spreadsheet-compatible with BOM for Excel / Excel 호환 스프레드시트 (BOM 포함) |
   | **PDF** | Opens HTML in new tab → use Ctrl+P / Cmd+P to save as PDF / 새 탭에서 HTML 열기 → Ctrl+P로 PDF 저장 |

5. Click **"Export Messages"** and wait for the download.

   **"Export Messages"** 를 클릭하고 다운로드를 기다립니다.

## How It Works / 동작 방식

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Content Script │────▶│  Background  │────▶│  Discord API    │
│                 │     │  Service     │     │  v10            │
│ • Channel ID    │     │  Worker      │     │                 │
│ • Auth token    │     │              │     │ GET /channels/  │
│ • Channel name  │     │ • Pagination │     │   {id}/messages │
└─────────────────┘     │ • Formatting │     └─────────────────┘
                        │ • Export     │
                        └──────┬───────┘
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
                  HTML        CSV        PDF
```

1. **Content Script** extracts the channel ID from the page URL and the auth token from `localStorage`.

   **Content Script**가 페이지 URL에서 채널 ID를, `localStorage`에서 인증 토큰을 추출합니다.

2. **Background Service Worker** calls the Discord REST API (v10) with pagination to fetch all messages in the specified date range. It uses [Snowflake IDs](https://discord.com/developers/docs/reference#snowflakes) for efficient date-based cursor pagination.

   **Background Service Worker**가 Discord REST API (v10)를 호출하여 지정된 기간의 메시지를 페이지네이션으로 수집합니다. [Snowflake ID](https://discord.com/developers/docs/reference#snowflakes)를 사용하여 날짜 기반 커서 페이지네이션을 수행합니다.

3. Messages are formatted into the selected output format and downloaded via `chrome.downloads` API (or opened in a new tab for PDF).

   메시지를 선택한 포맷으로 변환한 뒤 `chrome.downloads` API로 다운로드합니다 (PDF는 새 탭에서 열림).

## Project Structure / 프로젝트 구조

```
discord-channel-exporter/
├── manifest.json   # Chrome Extension Manifest V3
├── background.js   # Service worker: API calls, message fetching, format conversion
│                   # 서비스 워커: API 호출, 메시지 수집, 포맷 변환
├── content.js      # Content script: channel detection, token extraction
│                   # 콘텐츠 스크립트: 채널 감지, 토큰 추출
├── popup.html      # Extension popup UI (Discord dark theme)
│                   # 팝업 UI (Discord 다크 테마)
├── popup.js        # Popup interaction logic
│                   # 팝업 인터랙션 로직
├── icons/          # Extension icons (16/48/128px)
├── LICENSE         # MIT License
└── README.md
```

## Limitations / 제한 사항

- This extension uses your Discord **user token** from the browser session. Using user tokens for automation is against [Discord's Terms of Service](https://discord.com/terms). Use at your own risk.

  이 확장은 브라우저 세션의 Discord **사용자 토큰**을 사용합니다. 사용자 토큰을 자동화에 사용하는 것은 [Discord 서비스 약관](https://discord.com/terms)에 위배될 수 있습니다. 본인 책임 하에 사용하세요.

- Very large exports (100,000+ messages) may hit browser memory limits due to base64 encoding for the download. Consider narrowing the date range for large channels.

  매우 큰 내보내기 (10만 메시지 이상)는 다운로드 시 base64 인코딩으로 인해 브라우저 메모리 제한에 걸릴 수 있습니다. 대규모 채널은 날짜 범위를 좁혀서 사용하세요.

- PDF export opens the HTML in a new tab and triggers the browser's print dialog. You need to manually select "Save as PDF" in the print options.

  PDF 내보내기는 HTML을 새 탭에서 열고 인쇄 다이얼로그를 표시합니다. 인쇄 옵션에서 "PDF로 저장"을 직접 선택해야 합니다.

## License / 라이선스

[MIT License](LICENSE)
