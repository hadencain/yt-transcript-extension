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
