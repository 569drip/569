/* ============================================================
   V.VI.IX — site behaviour
   No dependencies. Everything degrades without JS.
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    // No IntersectionObserver, or user prefers less motion: show everything now.
    if (!("IntersectionObserver" in window) || reduceMotion.matches) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.05 });

    items.forEach(function (el, i) {
      // Stagger within a group, capped so long grids don't crawl.
      var group = el.closest("[data-stagger]");
      if (group) {
        var peers = Array.prototype.slice.call(group.querySelectorAll(".reveal"));
        var idx = peers.indexOf(el);
        el.style.setProperty("--reveal-delay", Math.min(idx, 8) * 55 + "ms");
      }
      io.observe(el);
    });
  }

  /* ---------- Sticky header shadow ---------- */
  function initHeader() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    var ticking = false;
    function update() {
      header.classList.toggle("is-stuck", window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  /* ---------- Mobile nav ---------- */
  function initNav() {
    var toggle = document.querySelector("[data-nav-toggle]");
    var panel = document.getElementById("mobile-nav");
    if (!toggle || !panel) return;

    function setOpen(open) {
      toggle.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
      document.body.style.overflow = open ? "hidden" : "";
      if (open) {
        var first = panel.querySelector("a, button");
        if (first) first.focus();
      }
    }

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    panel.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* ---------- Blur / reveal on explicit pieces ---------- */
  function initVeil() {
    document.querySelectorAll("[data-veil]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var media = btn.closest(".card-media");
        if (!media) return;
        media.classList.remove("is-veiled");
        media.classList.add("is-unveiled");
        // Move focus onward so the revealed art isn't hidden behind a dead control.
        var link = media.closest("a") || media.parentElement.querySelector("a");
        if (link) link.focus();
      });
    });
  }

  /* ---------- Pressed-state groups (size / colour) ---------- */
  function initToggleGroups() {
    document.querySelectorAll("[data-toggle-group]").forEach(function (group) {
      var input = document.getElementById(group.dataset.toggleGroup);
      group.addEventListener("click", function (e) {
        var btn = e.target.closest("[aria-pressed]");
        if (!btn || btn.disabled) return;
        group.querySelectorAll("[aria-pressed]").forEach(function (b) {
          b.setAttribute("aria-pressed", "false");
        });
        btn.setAttribute("aria-pressed", "true");
        if (input) input.value = btn.dataset.value || btn.textContent.trim();
      });
    });
  }

  /* ---------- Custom-art price estimator ---------- */
  function initEstimator() {
    var form = document.querySelector("[data-estimator]");
    if (!form) return;

    // The estimate panel sits outside the form element, so scope to the document.
    var out = document.querySelector("[data-estimate]");
    var note = document.querySelector("[data-estimate-note]");

    function recalc() {
      var checked = form.querySelector("[name=garment]:checked");
      var base = Number((checked && checked.dataset.base) || 0);
      var subjects = Number(form.querySelector("[name=subjects]").value || 1);
      var rush = form.querySelector("[name=rush]").checked;

      var art = 20 + (subjects - 1) * 25;      // +$20 base, +$25 per extra subject
      var total = base + art + (rush ? 35 : 0);

      if (out) out.textContent = "$" + total;
      if (note) {
        note.textContent = "$" + base + " garment + $" + art + " art"
          + (rush ? " + $35 rush" : "")
          + " · proof in " + (rush ? "48 hours" : "5–7 days");
      }
    }

    form.addEventListener("change", recalc);
    form.addEventListener("input", recalc);
    recalc();
  }

  /* ---------- Newsletter ---------- */
  function initSignup() {
    document.querySelectorAll("[data-signup]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = form.querySelector("input[type=email]");
        var status = form.querySelector("[data-signup-status]");
        if (!email || !status) return;

        if (!email.value || !email.checkValidity()) {
          email.setAttribute("aria-invalid", "true");
          status.dataset.state = "error";
          status.textContent = "That email doesn't look right. Try again.";
          email.focus();
          return;
        }
        email.removeAttribute("aria-invalid");
        status.dataset.state = "ok";
        status.textContent = "You're on the list. We only email when a drop lands.";
        form.reset();
      });
    });
  }

  /* ---------- Year ---------- */
  function initYear() {
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  function boot() {
    initReveal();
    initHeader();
    initNav();
    initVeil();
    initToggleGroups();
    initEstimator();
    initSignup();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
