/* em-revision shared script */

/* ── KaTeX auto-render ── */
document.addEventListener("DOMContentLoaded", function () {
  // Render all math
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

  // ── Active nav link ──
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".topbar-nav a").forEach(a => {
    if (a.getAttribute("href") === current) a.classList.add("active");
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
