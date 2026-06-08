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

function sanitizeFilename(title) {
  return title
    .replace(/[\\/:*?"<>|]/g, '')   // strip invalid filename chars
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim()
    .slice(0, 200);                 // cap length
}

function cleanTranscriptJson(json) {
  const events = json.events || [];
  const lines = events
    .filter(e => e.segs)
    .map(e => e.segs.map(s => s.utf8 || '').join('').replace(/\n/g, ' ').trim())
    .filter(Boolean);
  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

async function fetchPlayerResponse(videoId) {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { credentials: 'include' });
  if (!res.ok) { console.log('[yt-transcript] watch page fetch failed:', res.status); return null; }
  const html = await res.text();

  const keyIdx = html.indexOf('ytInitialPlayerResponse');
  console.log('[yt-transcript] ytInitialPlayerResponse in page:', keyIdx !== -1);
  if (keyIdx === -1) return null;

  const jsonStart = html.indexOf('{', keyIdx);
  if (jsonStart === -1) return null;

  let depth = 0;
  let i = jsonStart;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) break;
  }

  try {
    const parsed = JSON.parse(html.slice(jsonStart, i + 1));
    console.log('[yt-transcript] parsed ok, captions:', !!parsed?.captions);
    return parsed;
  } catch (e) {
    console.log('[yt-transcript] JSON.parse failed:', e.message);
    return null;
  }
}

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

async function downloadTranscript(videoId, title) {
  try {
    const playerResponse = await fetchPlayerResponse(videoId);
    if (!playerResponse) {
      showToast('No transcript available');
      return;
    }

    const captionUrl = extractCaptionUrl(playerResponse);
    console.log('[yt-transcript] captionUrl:', captionUrl);
    if (!captionUrl) {
      showToast('No transcript available');
      return;
    }

    const xmlRes = await fetch(captionUrl + '&fmt=json3', { credentials: 'include' });
    console.log('[yt-transcript] timedtext fetch status:', xmlRes.status);
    if (!xmlRes.ok) {
      showToast('No transcript available');
      return;
    }

    const rawText = await xmlRes.text();
    console.log('[yt-transcript] raw response length:', rawText.length, '| preview:', rawText.slice(0, 150));
    if (!rawText) { showToast('No transcript available'); return; }
    const json = JSON.parse(rawText);
    console.log('[yt-transcript] events:', json.events?.length);
    const cleanText = cleanTranscriptJson(json);

    const filename = title
      ? `${sanitizeFilename(title)}.txt`
      : `transcript-${videoId}.txt`;

    const dataUrl = 'data:text/plain;charset=utf-8,' + encodeURIComponent(cleanText);
    chrome.downloads.download({ url: dataUrl, filename });
  } catch {
    showToast('No transcript available');
  }
}

function getVideoIdFromCard(card) {
  const anchor = card.querySelector('a#thumbnail');
  if (!anchor) return null;
  const url = new URL(anchor.href, 'https://www.youtube.com');
  return url.searchParams.get('v');
}

function getTitleFromCard(card) {
  const titleEl = card.querySelector('#video-title');
  return titleEl ? titleEl.textContent.trim() : null;
}

function injectMenuButton(card) {
  const threeDotsBtn = card.querySelector('#menu yt-icon-button');
  if (!threeDotsBtn || threeDotsBtn.dataset.ytTranscriptWired) return;
  threeDotsBtn.dataset.ytTranscriptWired = '1';

  threeDotsBtn.addEventListener('click', () => {
    const popupObserver = new MutationObserver(() => {
      const popup = document.querySelector('ytd-menu-popup-renderer tp-yt-paper-listbox');
      if (!popup) return;
      popupObserver.disconnect();

      if (popup.querySelector('#yt-transcript-btn')) return;

      const videoId = getVideoIdFromCard(card);
      const title = getTitleFromCard(card);
      if (!videoId) return;

      const existingItem = popup.querySelector('tp-yt-paper-item');
      if (!existingItem) return;

      const item = document.createElement('tp-yt-paper-item');
      item.id = 'yt-transcript-btn';
      item.style.cssText = existingItem.style.cssText;
      item.className = existingItem.className;
      const span = document.createElement('span');
      span.textContent = 'Download Transcript';
      span.style.cssText = 'flex:1; font-size:14px; padding: 0 16px;';
      item.appendChild(span);

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        downloadTranscript(videoId, title);
      });

      popup.appendChild(item);
    });

    popupObserver.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => popupObserver.disconnect(), 2000);
  }, { once: true });
}

function scanCards() {
  if (window.location.pathname.startsWith('/results')) {
    document.querySelectorAll('ytd-video-renderer').forEach(injectMenuButton);
  }
}

// Poll every 500ms — handles YouTube's unpredictable SPA rendering pipeline.
// injectMenuButton is idempotent (dataset guard), so repeated calls are safe.
setInterval(scanCards, 500);
