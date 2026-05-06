/* em-revision shared script */

function setMeta(name, content) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.name = name; document.head.appendChild(el); }
  el.content = content;
}

/* ── Meta tags ── */
setMeta("description", document.title);
setMeta("author", "EM L2 Révisions");

/* ── Chapter color ── */
import('/em-revisions/scripts/config.js').then(({ QUIZZES, CHAPTERS }) => {
  const file = location.pathname.split('/').pop().replace('.html', '');
  const prefix = (file.match(/^(td\d|ch\d)/) || [])[0];
  const entry = prefix && (QUIZZES[prefix] || CHAPTERS[prefix]);
  if (!entry) return;
  const color = `var(${entry.css})`;
  document.documentElement.style.setProperty('--ch-color', color);
  function apply() {
    const el = document.querySelector('.ch-title');
    if (el) el.style.color = color;
    const hex = getComputedStyle(document.documentElement).getPropertyValue(entry.css).trim();
    if (hex) setMeta('theme-color', hex);
  }
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', apply)
    : apply();
});

/* ── KaTeX auto-render ── */
document.addEventListener("DOMContentLoaded", function () {
  renderMathInElement(document.body, {
    delimiters: [
      { left: "$$",  right: "$$",  display: true  },
      { left: "\\[", right: "\\]", display: true  },
      { left: "$",   right: "$",   display: false },
      { left: "\\(", right: "\\)", display: false }
    ],
    throwOnError: false,
    strict: false
  });

  // ── Back-to-top button ──
  const btt = document.getElementById("btt");
  if (btt) {
    window.addEventListener("scroll", () => {
      btt.classList.toggle("visible", window.scrollY > 320);
    });
    btt.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }
});
