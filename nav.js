/* Shared navigation HTML — injected by each page */
(function () {
  const nav = [
    { href: "index.html", label: "Accueil" },
    { href: "ch1.html", label: "CM1 · Maths" },
    { href: "ch2.html", label: "CM2 · Électrostatique" },
    { href: "ch3.html", label: "CM3 · Charges en mouvement" },
    { href: "ch4.html", label: "CM4 · Magnétostatique" },
    { href: "ch5.html", label: "CM5 · Induction" },
    { href: "quizzes.html", label: "🎯 Quizzes" },
  ];

  const bar = document.getElementById("topbar");
  if (!bar) return;

  const current = location.pathname.split("/").pop() || "index.html";
  const linkHTML = nav.map(n =>
    `<a href="${n.href}"${n.href === current ? ' class="active"' : ""}>${n.label}</a>`
  ).join("");

  bar.innerHTML = `
    <a class="topbar-brand" href="index.html">⚡ EM L2</a>
    <button class="nav-arrow nav-arrow-left" aria-label="Défiler à gauche">&#8249;</button>
    <nav class="topbar-nav">${linkHTML}</nav>
    <button class="nav-arrow nav-arrow-right" aria-label="Défiler à droite">&#8250;</button>
    <button class="nav-burger" aria-label="Menu" aria-expanded="false">&#9776;</button>
  `;

  /* Overlay for burger menu */
  const overlay = document.createElement("div");
  overlay.className = "nav-overlay";
  overlay.innerHTML = `
    <div class="nav-overlay-panel">
      <div class="nav-overlay-header">
        <span class="nav-overlay-brand">⚡ EM L2</span>
        <button class="nav-overlay-close" aria-label="Fermer">&#10005;</button>
      </div>
      ${linkHTML}
    </div>
  `;
  document.body.appendChild(overlay);

  const burger = bar.querySelector(".nav-burger");

  function openMenu() {
    overlay.classList.add("open");
    burger.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }
  function closeMenu() {
    overlay.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  burger.addEventListener("click", openMenu);
  overlay.addEventListener("click", e => { if (e.target === overlay) closeMenu(); });
  overlay.querySelector(".nav-overlay-close").addEventListener("click", closeMenu);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeMenu(); });

  /* Scroll arrows */
  const navEl = bar.querySelector(".topbar-nav");
  bar.querySelector(".nav-arrow-left").addEventListener("click", () => {
    navEl.scrollBy({ left: -180, behavior: "smooth" });
  });
  bar.querySelector(".nav-arrow-right").addEventListener("click", () => {
    navEl.scrollBy({ left: 180, behavior: "smooth" });
  });
})();
