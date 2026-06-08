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
