/*
 * Huaka Digital — vitrina pública (templates/showcase.hbs).
 *
 * - "Girar en 3D": abre el visor de la pieza dentro de la portada; sin script, el
 *   botón es un enlace normal al visor.
 * - Entradas: las partes de cada sección suben al entrar en pantalla. Lo que ya
 *   está a la vista al cargar no se oculta nunca (ver .sc-pending en showcase.css).
 */
(function () {
  "use strict";

  var rotate = document.querySelector("[data-sc-rotate]");
  if (rotate) {
    var hero = rotate.closest(".sc-hero");
    var stage = hero && hero.querySelector("[data-sc-stage]");
    var openLabel = rotate.textContent;
    var closeLabel = rotate.getAttribute("data-sc-close-label") || openLabel;
    rotate.addEventListener("click", function (e) {
      if (!stage || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      var frame = stage.querySelector("iframe");
      if (frame) {
        frame.remove();
        hero.classList.remove("is-live");
        rotate.textContent = openLabel;
        return;
      }
      frame = document.createElement("iframe");
      frame.src = rotate.getAttribute("data-sc-rotate");
      frame.title = hero.querySelector(".sc-facts dd") ? hero.querySelector(".sc-facts dd").textContent : openLabel;
      frame.allow = "fullscreen; xr-spatial-tracking";
      frame.allowFullscreen = true;
      stage.appendChild(frame);
      hero.classList.add("is-live");
      rotate.textContent = closeLabel;
      stage.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }

  var parts = Array.prototype.slice.call(document.querySelectorAll("[data-sc-reveal]"));
  if (!("IntersectionObserver" in window) || !parts.length) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.remove("sc-pending");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px" });

  var counters = new Map();
  parts.forEach(function (el) {
    var group = el.closest("section") || document.body;
    var i = counters.get(group) || 0;
    counters.set(group, i + 1);
    var box = el.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) return; //already visible: leave it alone
    el.style.setProperty("--sc-i", String(Math.min(i, 8)));
    el.classList.add("sc-reveal", "sc-pending");
    observer.observe(el);
  });
})();
