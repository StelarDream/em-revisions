export function _el(sel) { return document.querySelector(sel); }

export function _renderMath(el) {
  if (window.renderMathInElement) {
    renderMathInElement(el, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false }
      ],
      throwOnError: false
    });
  }
}

export function _inlineMd(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="qz-md-code">$1</code>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>');
}

// Any string starting with "md:" is parsed as markdown+KaTeX.
// All other strings pass through as raw HTML (backward-compatible).
export function _md(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('md:')) return raw;
  let s = raw.slice(3).trim();

  // Stash math so markdown transforms don't touch it
  const stash = [];
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => { stash.push(`$$${m}$$`); return `\x00M${stash.length - 1}\x00`; });
  s = s.replace(/\$([^\$\n]+?)\$/g, (_, m) => { stash.push(`$${m}$`); return `\x00M${stash.length - 1}\x00`; });

  const lines = s.split('\n');
  const chunks = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];

    if (/^---+$/.test(l.trim())) { chunks.push('<hr>'); i++; continue; }

    const hm = l.match(/^(#{1,4})\s+(.*)/);
    if (hm) { chunks.push(`<h${hm[1].length + 2} class="qz-md-h">${_inlineMd(hm[2])}</h${hm[1].length + 2}>`); i++; continue; }

    if (/^[-*]\s/.test(l)) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i]))
        items.push(`<li>${_inlineMd(lines[i++].replace(/^[-*]\s/, ''))}</li>`);
      chunks.push(`<ul class="qz-md-ul">${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+\.\s/.test(l)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i]))
        items.push(`<li>${_inlineMd(lines[i++].replace(/^\d+\.\s/, ''))}</li>`);
      chunks.push(`<ol class="qz-md-ol">${items.join('')}</ol>`);
      continue;
    }

    if (l.trim() === '') { chunks.push('\x00BR\x00'); i++; continue; }
    chunks.push(_inlineMd(l)); i++;
  }

  let html = '';
  let para = [];
  for (const c of chunks) {
    if (c === '\x00BR\x00') {
      if (para.length) { html += `<p class="qz-md-p">${para.join(' ')}</p>`; para = []; }
    } else if (c.startsWith('<')) {
      if (para.length) { html += `<p class="qz-md-p">${para.join(' ')}</p>`; para = []; }
      html += c;
    } else {
      para.push(c);
    }
  }
  if (para.length) html += `<p class="qz-md-p">${para.join(' ')}</p>`;

  html = html.replace(/\x00M(\d+)\x00/g, (_, idx) => stash[+idx]);
  return html;
}

export function _renderField(el, value) {
  el.innerHTML = _md(value || '');
  _renderMath(el);
}
