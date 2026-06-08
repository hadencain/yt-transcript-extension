# YT Transcript Chrome Extension — Design Spec
_2026-06-07_

## Purpose

A Chrome extension that adds a "Download Transcript" option to the three-dot menu on every video card in YouTube search results (`/results?search_query=...`). Downloads the transcript as a clean `.txt` file — no timestamps, no speaker labels, no markup — intended for AI consumption.

---

## Files

| File | Role |
|------|------|
| `manifest.json` | Extension config — content script registration, permissions |
| `content.js` | All logic — menu injection, transcript fetch, download, toast |
| `toast.css` | Toast notification styling |

No background service worker. No external dependencies. No bundler required.

---

## manifest.json

- Manifest V3
- `content_scripts` targeting `https://www.youtube.com/results*`
- `host_permissions`: `https://www.youtube.com/*`
- `permissions`: `["downloads"]`
- `web_accessible_resources`: `["toast.css"]`

---

## Content Script — Menu Injection

A `MutationObserver` watches the search results container for newly rendered `ytd-video-renderer` elements (handles initial load and infinite scroll).

For each card:
1. Locate the three-dot `yt-icon-button` within the card
2. Attach a one-time click listener
3. On click, use a short-lived `MutationObserver` on the card to detect when YouTube renders its dropdown (`ytd-menu-popup-renderer`) into the DOM, then append a "Download Transcript" `<yt-formatted-string>` item styled to match existing menu items
4. Attach a click handler to that item that triggers the transcript fetch flow

---

## Transcript Fetch Flow

1. **Get videoId** — read from the thumbnail anchor's `href` on the card (`/watch?v=<id>`)
2. **Get player response** — fetch `https://www.youtube.com/watch?v=<videoId>`, extract `ytInitialPlayerResponse` JSON from the embedded `<script>` tag in the response HTML
3. **Get caption track URL** — read `captions.playerCaptionsTracklistRenderer.captionTracks[0].baseUrl` from the player response. If missing or empty → show toast, abort.
4. **Fetch timedtext XML** — GET the caption track URL. Response is XML with `<text start="..." dur="...">` elements.
5. **Clean the text** — extract inner text from each `<text>` element, decode HTML entities (`&amp;`, `&#39;`, etc.), strip any remaining tags (e.g. `<font>`), join all lines with a single space, normalize whitespace.
6. **Download** — call `chrome.downloads.download({ url: dataUrl, filename: '<sanitized-title>.txt' })` where `dataUrl` is a `data:text/plain` URI of the cleaned text. Filename is taken from the card's title element, sanitized (strip characters invalid in filenames).

---

## Error Handling

| Condition | Behavior |
|-----------|----------|
| No caption tracks in player response | Toast: "No transcript available" |
| Caption track URL fetch fails | Toast: "No transcript available" |
| Video title unavailable | Fallback filename: `transcript-<videoId>.txt` |

---

## Toast Notification

- Fixed-position div injected into `document.body`
- Position: bottom-right, `z-index` above YouTube UI
- Message: "No transcript available"
- Auto-dismiss: CSS fade-out animation, 3s duration, removed from DOM on `animationend`
- One toast at a time — if already visible, replace it

---

## Constraints & Notes

- Uses YouTube's undocumented `timedtext` API via `ytInitialPlayerResponse`. Stable across years but not guaranteed — breakage would manifest as missing `captionTracks` in the player response.
- The extension only targets `captionTracks[0]` (default/auto-generated or first available). Does not implement language selection.
- No auto-language fallback — if the first track is not English, the user gets whatever YouTube's default is.
- MutationObserver must be disconnected per-card after injection to avoid double-injecting on YouTube's internal navigation.

---

## Out of Scope

- Language selection UI
- Bulk download (multiple videos at once)
- Any page other than `/results?search_query=...`
- Popup or options page
