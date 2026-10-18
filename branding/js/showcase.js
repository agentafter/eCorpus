/*
 * Huaka Digital — vitrina pública (templates/showcase.hbs).
 *
 * - Escenario: cada sección ([data-sc-section]) tiene su pieza en el fondo
 *   ([data-sc-layer]). Con el scroll, la de la sección que entra aparece
 *   acercándose y la que se va se desvanece creciendo, como pasar de largo.
 * - Tarjetas ([data-sc-fade]): aparecen al entrar en pantalla y se desvanecen al
 *   salir por arriba, al ritmo del scroll.
 * - Títulos ([data-sc-words]): entran palabra por palabra al llegar a la sección.
 * - "Ver en 3D": abre el visor de la pieza dentro de la portada.
 * - "Ver otra pieza": cambia la pieza de la portada sin recargar, con las de
 *   #sc-hero-pool.
 * Con "reducir movimiento" solo hay fundidos, sin desplazamientos ni cambios de
 * tamaño. Sin script, todo se ve y los dos botones son enlaces normales: las
 * clases que esconden las pone este archivo.
 */
(function () {
  "use strict";

  var still = window.matchMedia("(prefers-reduced-motion: reduce)");
  var root = document.documentElement;
  var nav = document.getElementById("main-navbar");

  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
  function ease(v) { return v * v * (3 - 2 * v); }

  /* ---- Escenario ---- */
  var layers = {};
  Array.prototype.forEach.call(document.querySelectorAll("[data-sc-layer]"), function (el) {
    layers[el.getAttribute("data-sc-layer")] = el;
  });
  var sections = Array.prototype.filter.call(document.querySelectorAll("[data-sc-section]"), function (el) {
    return layers[el.getAttribute("data-sc-section")];
  });
  var cards = Array.prototype.slice.call(document.querySelectorAll("[data-sc-fade]"));

  var queued = false;
  function paint() {
    queued = false;
    var vh = window.innerHeight;
    var top = nav ? Math.max(0, nav.getBoundingClientRect().bottom) : 0;

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

    cards.forEach(function (card) {
      var box = card.getBoundingClientRect();
      if (box.bottom < -vh || box.top > 2 * vh) return;
      // Entra en el último 22 % de la pantalla y sale en el primer 16 % bajo la barra
      var enter = ease(clamp((vh - box.top) / (vh * 0.22), 0, 1));
      var leave = ease(clamp((box.bottom - top) / (vh * 0.16), 0, 1));
      card.style.setProperty("--sc-fo", Math.min(enter, leave).toFixed(3));
      card.style.setProperty("--sc-fy", still.matches ? "0px" : ((1 - enter) * 28 - (1 - leave) * 14).toFixed(1) + "px");
    });
  }
  function queue() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(paint);
  }
  if (sections.length || cards.length) {
    if (sections.length) root.classList.add("sc-staged");
    root.classList.add("sc-faded");
    paint();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    // Los <details> de Colecciones cambian de alto al abrirse
    document.addEventListener("toggle", queue, true);
  }

  /* ---- "Ver en 3D" ---- */
  var rotate = document.querySelector("[data-sc-rotate]");
  var hero = rotate && rotate.closest(".sc-hero");
  var stage = hero && hero.querySelector("[data-sc-stage]");
  var openLabel = rotate ? rotate.textContent : "";
  function closeViewer() {
    var frame = stage && stage.querySelector("iframe");
    if (!frame) return;
    frame.remove();
    hero.classList.remove("is-live");
    rotate.textContent = openLabel;
  }
  if (rotate) {
    var closeLabel = rotate.getAttribute("data-sc-close-label") || openLabel;
    rotate.addEventListener("click", function (e) {
      if (!stage || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      if (stage.querySelector("iframe")) return closeViewer();
      var frame = document.createElement("iframe");
      frame.src = rotate.getAttribute("data-sc-rotate");
      frame.title = hero.querySelector("[data-sc-hero=title]").textContent;
      frame.allow = "fullscreen; xr-spatial-tracking";
      frame.allowFullscreen = true;
      stage.appendChild(frame);
      hero.classList.add("is-live");
      rotate.textContent = closeLabel;
    });
  }

  /* ---- "Ver otra pieza" ---- */
  var next = document.querySelector("[data-sc-next]");
  var poolData = document.getElementById("sc-hero-pool");
  if (next && poolData && rotate) {
    var pool = [];
    try { pool = JSON.parse(poolData.textContent); } catch (e) { pool = []; }
    var card = hero.querySelector("[data-sc-card]");
    var heroImg = layers.hero && layers.hero.querySelector("img");
    // La pieza actual, tal como la dejó el servidor, vuelve a la lista al cambiarla
    var current = {
      name: card.getAttribute("data-sc-current"),
      title: card.querySelector("[data-sc-hero=title]").textContent,
      collection: card.querySelector("[data-sc-hero=collection]").textContent || null,
      date: card.querySelector("[data-sc-hero=date]").textContent,
      viewUri: rotate.getAttribute("data-sc-rotate"),
      image: heroImg ? { src: heroImg.getAttribute("src"), srcset: heroImg.getAttribute("srcset") } : null,
    };
    function show(piece) {
      // Una pieza sin captura no tiene foto: se apaga la del escenario y la ficha va al centro
      hero.classList.toggle("sc-hero--bare", !piece.image);
      if (layers.hero) layers.hero.classList.toggle("is-empty", !piece.image);
      card.querySelector("[data-sc-hero=title]").textContent = piece.title;
      var collection = card.querySelector("[data-sc-hero=collection]");
      collection.textContent = piece.collection || "";
      collection.parentNode.hidden = !piece.collection;
      card.querySelector("[data-sc-hero=date]").textContent = piece.date;
      card.setAttribute("data-sc-current", piece.name);
      rotate.href = piece.viewUri;
      rotate.setAttribute("data-sc-rotate", piece.viewUri);
      if (heroImg && piece.image) {
        if (piece.image.src) {
          heroImg.src = piece.image.src;
          heroImg.srcset = piece.image.srcset;
        } else {
          heroImg.srcset = piece.image.low + " 640w, " + piece.image.medium + " 1280w, " + piece.image.high + " 2560w";
          heroImg.src = piece.image.medium;
        }
      }
    }
    next.addEventListener("click", function (e) {
      if (!pool.length || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      closeViewer();
      var piece = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      pool.push(current);
      // Si cambia de "con foto" a "sin foto" (o al revés), la ficha cambia de lugar: se funde entera
      var moves = !piece.image !== !current.image;
      current = piece;
      root.classList.add("sc-swapping");
      if (moves) root.classList.add("sc-swapping-card");
      window.setTimeout(function () {
        show(piece);
        var reveal = function () { root.classList.remove("sc-swapping", "sc-swapping-card"); };
        if (heroImg && piece.image && !heroImg.complete) {
          heroImg.addEventListener("load", reveal, { once: true });
          heroImg.addEventListener("error", reveal, { once: true });
        } else {
          reveal();
        }
      }, still.matches ? 0 : 260);
    });
  }

  /* ---- Títulos palabra por palabra ---- */
  if (!("IntersectionObserver" in window)) return;
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
  // Un cuadro de espera: así también entran los títulos que ya están a la vista al cargar
  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(function () {
      titles.forEach(function (el) { wordObserver.observe(el); });
    });
  });
})();
