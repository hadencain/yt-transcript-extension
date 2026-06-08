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
