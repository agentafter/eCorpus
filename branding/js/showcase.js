/*
 * Huaka Digital — vitrina pública (templates/showcase.hbs).
 *
 * - Escenario: cada sección ([data-sc-section]) tiene su pieza en el fondo
 *   ([data-sc-layer]). Con el scroll, la de la sección que entra aparece
 *   acercándose y la que se va se desvanece creciendo, como pasar de largo.
 *   Con "reducir movimiento" solo se funden, sin desplazarse ni cambiar de tamaño.
 * - Títulos ([data-sc-words]): entran palabra por palabra al llegar a la sección.
 * - "Girar en 3D": abre el visor de la pieza dentro de la portada; sin script, el
 *   botón es un enlace normal al visor.
 * - Entradas ([data-sc-reveal]): las partes de cada sección suben al entrar.
 *
 * Nada queda oculto sin script: las clases que esconden las pone este archivo.
 */
(function () {
  "use strict";

  var still = window.matchMedia("(prefers-reduced-motion: reduce)");
  var root = document.documentElement;

  /* ---- Escenario ---- */
  var layers = {};
  Array.prototype.forEach.call(document.querySelectorAll("[data-sc-layer]"), function (el) {
    layers[el.getAttribute("data-sc-layer")] = el;
  });
  var sections = Array.prototype.filter.call(document.querySelectorAll("[data-sc-section]"), function (el) {
    return layers[el.getAttribute("data-sc-section")];
  });

  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

  var queued = false;
  function paint() {
    queued = false;
    var vh = window.innerHeight;
    sections.forEach(function (section) {
      var box = section.getBoundingClientRect();
      // t: -1 mientras la sección viene de abajo, 0 centrada, 1 cuando ya se fue por arriba
      var t = clamp((vh / 2 - (box.top + box.height / 2)) / (box.height / 2 + vh / 2), -1, 1);
      var style = layers[section.getAttribute("data-sc-section")].style;
      // Plena mientras |t| < 0.3 y nula desde 0.5: la pieza que se va desaparece antes de que llegue la
      // siguiente, con un instante de fondo vacío entre las dos (dos cántaros superpuestos se leen como error)
      style.setProperty("--sc-o", clamp((0.5 - Math.abs(t)) * 5, 0, 1).toFixed(3));
      style.setProperty("--sc-s", still.matches ? "1" : (1 + t * 0.09).toFixed(4));
      style.setProperty("--sc-y", still.matches ? "0" : (t * -3).toFixed(2) + "vh");
    });
  }
  function queue() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(paint);
  }
  if (sections.length) {
    root.classList.add("sc-staged");
    paint();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
  }

  /* ---- "Girar en 3D" ---- */
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
    });
  }

  if (!("IntersectionObserver" in window)) return;

  /* ---- Títulos palabra por palabra ---- */
  var titles = Array.prototype.slice.call(document.querySelectorAll("[data-sc-words]"));
  titles.forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = "";
    words.forEach(function (word, i) {
      var span = document.createElement("span");
      span.className = "sc-word";
      span.style.setProperty("--sc-w", String(i));
      span.textContent = word;
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
    el.classList.add("sc-words", "sc-words-pending");
  });
  var wordObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.remove("sc-words-pending");
      wordObserver.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -12% 0px" });
  //Un cuadro de espera: así también entran los títulos que ya están a la vista al cargar
  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(function () {
      titles.forEach(function (el) { wordObserver.observe(el); });
    });
  });

  /* ---- Entradas de las partes de cada sección ---- */
  var parts = Array.prototype.slice.call(document.querySelectorAll("[data-sc-reveal]"));
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
    if (box.top < window.innerHeight && box.bottom > 0) return; //ya a la vista: no se esconde
    el.style.setProperty("--sc-i", String(Math.min(i, 8)));
    el.classList.add("sc-reveal", "sc-pending");
    observer.observe(el);
  });
})();
