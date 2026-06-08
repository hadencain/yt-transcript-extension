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
