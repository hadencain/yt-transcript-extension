# YT Transcript Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that injects a "Download Transcript" item into YouTube search result three-dot menus, fetching and saving clean `.txt` transcripts via YouTube's internal timedtext API.

**Architecture:** A single content script runs on `youtube.com/results*` pages. A `MutationObserver` watches for video cards and patches their three-dot dropdown menus. On click, the script fetches the video's watch page, extracts `ytInitialPlayerResponse`, pulls the caption track URL, fetches+cleans the timedtext XML, and triggers a browser download.

**Tech Stack:** Vanilla JS (ES2020), Chrome Extension Manifest V3, `chrome.downloads` API, CSS animations. No bundler, no dependencies.

---

## File Map

| File | Responsibility |
|------|----------------|
| `manifest.json` | Extension config — permissions, content script registration |
| `content.js` | All logic: observer, menu injection, transcript fetch, download, toast |
| `toast.css` | Toast animation and layout styles |
| `_scratch-test.js` | Node.js scratch file for testing pure utility functions (not shipped) |

---

### Task 1: Scaffold the extension

**Files:**
- Create: `manifest.json`
- Create: `content.js` (empty entry point)
- Create: `toast.css` (empty)

- [ ] **Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "YT Transcript Downloader",
  "version": "1.0.0",
  "description": "Download transcripts from YouTube search results",
  "permissions": ["downloads"],
  "host_permissions": ["https://www.youtube.com/*"],
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/results*"],
      "js": ["content.js"],
      "css": ["toast.css"],
      "run_at": "document_idle"
    }
  ]
}
```

Note: no `web_accessible_resources` needed — `toast.css` is injected directly via `content_scripts.css`, not loaded programmatically.

- [ ] **Step 2: Create content.js with a smoke-test log**

```js
console.log('[yt-transcript] content script loaded');
```

- [ ] **Step 3: Create toast.css (empty for now)**

```css
/* toast styles — added in Task 2 */
```

- [ ] **Step 4: Load the extension in Chrome and verify**

1. Open `chrome://extensions`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked" → select the `src/YT_transcript` folder
4. Navigate to `https://www.youtube.com/results?search_query=test`
5. Open DevTools → Console
6. Expected: `[yt-transcript] content script loaded`

- [ ] **Step 5: Commit**

```bash
git add manifest.json content.js toast.css
git commit -m "feat: scaffold YT transcript chrome extension"
```

---

### Task 2: Toast notification

**Files:**
- Modify: `toast.css`
- Modify: `content.js`

- [ ] **Step 1: Write toast.css**

```css
#yt-transcript-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #212121;
  color: #fff;
  font-family: 'Roboto', sans-serif;
  font-size: 14px;
  padding: 12px 20px;
  border-radius: 4px;
  z-index: 99999;
  opacity: 1;
  animation: yt-toast-fade 3s forwards;
  pointer-events: none;
}

@keyframes yt-toast-fade {
  0%   { opacity: 1; }
  70%  { opacity: 1; }
  100% { opacity: 0; }
}
```

- [ ] **Step 2: Write showToast() in content.js**

Replace the contents of `content.js` with:

```js
console.log('[yt-transcript] content script loaded');

function showToast(message) {
  const existing = document.getElementById('yt-transcript-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'yt-transcript-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  toast.addEventListener('animationend', () => toast.remove());
}
```

- [ ] **Step 3: Manually test toast**

1. Reload the extension at `chrome://extensions` (click the refresh icon on the card)
2. Go to `https://www.youtube.com/results?search_query=test`
3. Open DevTools console and run: `showToast('No transcript available')`
4. Expected: dark toast appears bottom-right, fades out after ~3s, disappears from DOM

- [ ] **Step 4: Commit**

```bash
git add content.js toast.css
git commit -m "feat: add toast notification"
```

---

### Task 3: Transcript utility functions

**Files:**
- Modify: `content.js`
- Create: `_scratch-test.js` (Node.js — not shipped)

These are the two pure functions that can be validated without a browser.

- [ ] **Step 1: Write sanitizeFilename() in content.js**

Append to `content.js`:

```js
function sanitizeFilename(title) {
  return title
    .replace(/[\\/:*?"<>|]/g, '')   // strip invalid filename chars
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim()
    .slice(0, 200);                 // cap length
}
```

- [ ] **Step 2: Write cleanTranscriptXml() in content.js**

Append to `content.js`:

```js
function cleanTranscriptXml(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  const textNodes = Array.from(doc.querySelectorAll('text'));

  const lines = textNodes.map(node => {
    let text = node.textContent;
    // decode common HTML entities not handled by textContent
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    // strip any inline tags (e.g. <font color="...">)
    text = text.replace(/<[^>]+>/g, '');
    return text.trim();
  });

  return lines.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 3: Write _scratch-test.js to verify both functions in Node**

```js
// _scratch-test.js — run with: node _scratch-test.js

// --- sanitizeFilename tests ---
function sanitizeFilename(title) {
  return title
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

console.assert(sanitizeFilename('Hello: World?') === 'Hello World', 'strips : and ?');
console.assert(sanitizeFilename('  spaced  ') === 'spaced', 'trims whitespace');
console.assert(sanitizeFilename('a'.repeat(300)).length === 200, 'caps at 200');

// --- cleanTranscriptXml tests ---
// DOMParser not available in Node — test the entity decode + tag strip logic directly
function decodeAndStrip(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .trim();
}

console.assert(decodeAndStrip('Hello &amp; world') === 'Hello & world', 'decodes &amp;');
console.assert(decodeAndStrip("it&#39;s") === "it's", "decodes &#39;");
console.assert(decodeAndStrip('<font color="red">text</font>') === 'text', 'strips font tags');

console.log('all assertions passed');
```

- [ ] **Step 4: Run the scratch tests**

```bash
node _scratch-test.js
```

Expected output:
```
all assertions passed
```

- [ ] **Step 5: Commit**

```bash
git add content.js _scratch-test.js
git commit -m "feat: add transcript utility functions"
```

---

### Task 4: Transcript fetch flow

**Files:**
- Modify: `content.js`

- [ ] **Step 1: Write fetchPlayerResponse()**

Append to `content.js`:

```js
async function fetchPlayerResponse(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
  if (!res.ok) return null;
  const html = await res.text();

  const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:var\s|const\s|let\s|<\/script>)/s);
  if (!match) return null;

  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Write extractCaptionUrl()**

Append to `content.js`:

```js
function extractCaptionUrl(playerResponse) {
  try {
    const tracks = playerResponse
      .captions
      .playerCaptionsTracklistRenderer
      .captionTracks;
    if (!tracks || tracks.length === 0) return null;
    return tracks[0].baseUrl;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Write downloadTranscript()**

Append to `content.js`:

```js
async function downloadTranscript(videoId, title) {
  const playerResponse = await fetchPlayerResponse(videoId);
  if (!playerResponse) {
    showToast('No transcript available');
    return;
  }

  const captionUrl = extractCaptionUrl(playerResponse);
  if (!captionUrl) {
    showToast('No transcript available');
    return;
  }

  const xmlRes = await fetch(captionUrl);
  if (!xmlRes.ok) {
    showToast('No transcript available');
    return;
  }

  const xmlText = await xmlRes.text();
  const cleanText = cleanTranscriptXml(xmlText);

  const filename = title
    ? `${sanitizeFilename(title)}.txt`
    : `transcript-${videoId}.txt`;

  const dataUrl = 'data:text/plain;charset=utf-8,' + encodeURIComponent(cleanText);
  chrome.downloads.download({ url: dataUrl, filename });
}
```

- [ ] **Step 4: Manually test fetch flow in DevTools**

1. Reload the extension
2. Go to `https://www.youtube.com/results?search_query=test`
3. In DevTools console, find a video ID from the page (inspect any thumbnail href) and run:

```js
downloadTranscript('dQw4w9WgXcQ', 'Test Video')
```

4. Expected: a `.txt` file downloads with clean transcript text. If the video has no captions, expected: toast appears.

- [ ] **Step 5: Commit**

```bash
git add content.js
git commit -m "feat: add transcript fetch and download flow"
```

---

### Task 5: MutationObserver and menu injection

**Files:**
- Modify: `content.js`

- [ ] **Step 1: Write getVideoIdFromCard()**

Append to `content.js`:

```js
function getVideoIdFromCard(card) {
  const anchor = card.querySelector('a#thumbnail');
  if (!anchor) return null;
  const url = new URL(anchor.href, 'https://www.youtube.com');
  return url.searchParams.get('v');
}
```

- [ ] **Step 2: Write getTitleFromCard()**

Append to `content.js`:

```js
function getTitleFromCard(card) {
  const titleEl = card.querySelector('#video-title');
  return titleEl ? titleEl.textContent.trim() : null;
}
```

- [ ] **Step 3: Write injectMenuButton()**

Append to `content.js`:

```js
function injectMenuButton(card) {
  const threeDotsBtn = card.querySelector('#menu yt-icon-button');
  if (!threeDotsBtn || threeDotsBtn.dataset.ytTranscriptWired) return;
  threeDotsBtn.dataset.ytTranscriptWired = '1';

  threeDotsBtn.addEventListener('click', () => {
    // Wait for YouTube to render the dropdown popup
    const popupObserver = new MutationObserver(() => {
      const popup = document.querySelector('ytd-menu-popup-renderer tp-yt-paper-listbox');
      if (!popup) return;
      popupObserver.disconnect();

      // Avoid double-injection
      if (popup.querySelector('#yt-transcript-btn')) return;

      const videoId = getVideoIdFromCard(card);
      const title = getTitleFromCard(card);
      if (!videoId) return;

      // Clone an existing menu item for consistent styling
      const existingItem = popup.querySelector('ytd-menu-service-item-renderer');
      if (!existingItem) return;

      const item = existingItem.cloneNode(true);
      item.id = 'yt-transcript-btn';
      const label = item.querySelector('yt-formatted-string');
      if (label) label.textContent = 'Download Transcript';

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close the popup
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        downloadTranscript(videoId, title);
      });

      popup.appendChild(item);
    });

    popupObserver.observe(document.body, { childList: true, subtree: true });

    // Disconnect after 2s if popup never appears
    setTimeout(() => popupObserver.disconnect(), 2000);
  }, { once: true });
}
```

- [ ] **Step 4: Write the top-level MutationObserver**

Append to `content.js`:

```js
function observeSearchResults() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.tagName === 'YTD-VIDEO-RENDERER') {
          injectMenuButton(node);
        }
        // Also catch cards inside added containers
        node.querySelectorAll?.('ytd-video-renderer').forEach(injectMenuButton);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Handle cards already in DOM on load
  document.querySelectorAll('ytd-video-renderer').forEach(injectMenuButton);
}

observeSearchResults();
```

- [ ] **Step 5: Reload and test end-to-end**

1. Reload the extension at `chrome://extensions`
2. Go to `https://www.youtube.com/results?search_query=rick+astley`
3. Click the three-dot menu on any video card
4. Expected: "Download Transcript" appears as the last item in the dropdown
5. Click it
6. Expected: the dropdown closes and a `.txt` file downloads named after the video title
7. Find a video with no captions (shorts, unlisted auto-captions off) and repeat
8. Expected: toast notification "No transcript available"

- [ ] **Step 6: Test infinite scroll**

1. Scroll to the bottom of search results until new cards load
2. Click three-dot on a newly loaded card
3. Expected: "Download Transcript" option appears — confirms observer handles dynamic content

- [ ] **Step 7: Commit**

```bash
git add content.js
git commit -m "feat: inject Download Transcript into YouTube search result menus"
```

---

### Task 6: Cleanup and edge cases

**Files:**
- Modify: `content.js`

- [ ] **Step 1: Guard against YouTube SPA navigation re-running the observer**

YouTube is a SPA — navigating between pages does not reload the content script. Add a guard at the top of `observeSearchResults()` so the observer is only created once:

Replace the `observeSearchResults()` function with:

```js
let _observerActive = false;

function observeSearchResults() {
  if (_observerActive) return;
  _observerActive = true;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.tagName === 'YTD-VIDEO-RENDERER') {
          injectMenuButton(node);
        }
        node.querySelectorAll?.('ytd-video-renderer').forEach(injectMenuButton);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll('ytd-video-renderer').forEach(injectMenuButton);
}

observeSearchResults();
```

- [ ] **Step 2: Verify no double-injection on back/forward navigation**

1. Search for something, click a video, press Back
2. Click a three-dot menu
3. Expected: exactly one "Download Transcript" item — not two

- [ ] **Step 3: Remove _scratch-test.js from extension folder**

The scratch test file should not be loaded by Chrome. Either move it outside the extension directory or confirm it's not listed in `manifest.json` (it isn't — content scripts are explicit, so it won't load automatically). Leave it in place.

- [ ] **Step 4: Final commit**

```bash
git add content.js
git commit -m "fix: guard against duplicate observer on SPA navigation"
```
