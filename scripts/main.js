/* em-revision shared script */

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
