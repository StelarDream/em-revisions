/* Shared navigation HTML — injected by each page */
(function () {
  const nav = [
    { href: "", label: "Accueil" },
    { href: "lessons/ch1.html", label: "CM1 · Maths" },
    { href: "lessons/ch2.html", label: "CM2 · Électrostatique" },
    { href: "lessons/ch3.html", label: "CM3 · Charges en mouvement" },
    { href: "lessons/ch4.html", label: "CM4 · Magnétostatique" },
    { href: "lessons/ch5.html", label: "CM5 · Induction" },
    { href: "lessons/ch6.html", label: "CM6 · Maxwell" },
    { href: "quizzes/", label: "🎯 Quizzes" },
  ];

  const bar = document.getElementById("topbar");
  if (!bar) return;

  const norm = p => p.endsWith("/index.html") ? p.slice(0, -10) : p;
  const resolved = href => new URL(href || ".", document.baseURI).pathname;
  const isActive = href =>
    norm(location.pathname) === norm(resolved(href)) ||
    (href.endsWith("/") && href !== "" && location.pathname.startsWith(resolved(href)));

  const linkHTML = nav
    .map(n => `<a href="${n.href}"${isActive(n.href) ? ' class="active"' : ""}>${n.label}</a>`)
    .join("");

  bar.innerHTML = `
    <a class="topbar-brand" href="">⚡ EM L2</a>
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
  bar.querySelector(".nav-arrow-left").addEventListener("click", () => navEl.scrollBy({ left: -180, behavior: "smooth" }));
  bar.querySelector(".nav-arrow-right").addEventListener("click", () => navEl.scrollBy({ left: 180, behavior: "smooth" }));
})();
