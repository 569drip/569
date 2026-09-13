/* ============================================================
   V.VI.IX — drop controller
   ------------------------------------------------------------
   Reads assets/data/drop.json (edited through Pages CMS) and drives
   every piece of drop-specific wording and state on the site, so a
   new drop is a settings change, not a code change.

   States
     coming-soon  no date shown, products hidden
     countdown    live timer; flips to "live" by itself at launch time
     live         products on sale
     sold-out     set by hand, or derived when every product is unavailable

   Page hooks
     data-drop-text="key"        wording from copy (state variants: key_live,
                                 key_sold_out, key_countdown, key_coming_soon,
                                 key_waiting = coming-soon or countdown)
     data-drop-show="live ..."   element visible only in the listed states
     data-drop-cta[="short"]     link whose label + href follow the state
     data-drop-countdown         timer renders here
     <title data-drop-title>     templated document title

   Tokens in wording
     {drop} {number} {next} {upcoming} {run} {pieces} {launch}

   Owner preview (never affects real visitors)
     ?drop_preview=countdown|live|sold-out|coming-soon
     ?drop_launch_in=90          fake countdown that goes live in 90s
   ============================================================ */
(function () {
  "use strict";

  var SRC = "assets/data/drop.json";
  var CACHE = "vviix.drop.v1";
  var STATES = ["coming-soon", "countdown", "live", "sold-out"];

  /* Defaults double as the fallback wording if a field is left empty in the CMS.
     Status defaults to "live" deliberately: if drop.json can't be read, Fourthwall
     visibility is still the real gate, so showing whatever is published there is
     the least harmful failure. */
  var DEFAULTS = {
    drop: { number: 1, name: "", status: "live", launch_date: "", timezone: "", collection: "all", run_size: null },
    copy: {
      drop_name: "{drop}",
      eyebrow_coming_soon: "{drop} — coming soon",
      eyebrow_countdown: "{drop} — {launch}",
      eyebrow_live: "{drop} — live now",
      eyebrow_sold_out: "{drop} — sold out",
      cta_live: "Shop {drop}",
      cta_waiting: "Get notified",
      cta_sold_out: "Get told about {next}",
      spec_run: "{run}",
      featured_heading: "The first six",
      newsletter_title: "{upcoming} is\nalready drawn.",
      newsletter_body: "We email when a run goes live and when it sells out. That's the whole newsletter.",
      shop_heading_coming_soon: "{drop} isn't\nlive yet.",
      shop_heading_countdown: "{drop} is\nalmost here.",
      shop_intro_waiting: "Nothing to buy yet. Get on the list and you'll hear the second it drops.",
      shop_intro_live: "{pieces} pieces. When they're gone they're gone — we don't reprint a joke.",
      shop_intro_sold_out: "Every piece is gone. We don't reprint a joke — {next} is already drawn.",
      sold_out_message: "{drop} is sold out.",
      live_empty: "Pieces are landing any second. This page checks again on its own.",
      holding_heading_live: "In the meantime,\nthere's {drop}",
      holding_heading_waiting: "In the meantime,\n{drop} is on its way",
      holding_heading_sold_out: "{drop} is gone.\n{next} is already drawn",
      holding_body_live: "{pieces} pieces that already say the quiet part. When they're gone they're gone.",
      holding_body_waiting: "Designed, finished, and not live yet. Get on the list and you'll hear first.",
      holding_body_sold_out: "Every piece sold. Get on the list and you'll hear about {next} first.",
      principle_run: "{run}, then it's retired. You will not see your shirt on six people at the same party."
    },
    site: { announcement: "" }
  };

  var params = new URLSearchParams(location.search);
  var previewState = STATES.indexOf(params.get("drop_preview")) >= 0 ? params.get("drop_preview") : "";
  var previewing = !!previewState || params.has("drop_launch_in");

  var cfg = merge(DEFAULTS, null);
  var launchTs = NaN;
  var counts = null;       // { total, available } reported by fourthwall.js
  var current = "";        // last painted state
  var listeners = [];
  var timer = 0;

  /* ---------- helpers ---------- */
  function merge(def, data) {
    var out = {};
    Object.keys(def).forEach(function (sec) {
      out[sec] = {};
      Object.keys(def[sec]).forEach(function (k) { out[sec][k] = def[sec][k]; });
      var src = data && data[sec];
      if (src && typeof src === "object") {
        Object.keys(src).forEach(function (k) {
          // An emptied CMS field falls back to the default rather than blanking the page.
          if (src[k] !== null && src[k] !== undefined && src[k] !== "") out[sec][k] = src[k];
        });
      }
    });
    return out;
  }
  function each(sel, fn) { document.querySelectorAll(sel).forEach(fn); }
  function onDom(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }
  function pad(n, len) { return String(Math.max(0, Math.floor(Number(n) || 0))).padStart(len, "0"); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function lines(s) { return esc(s).split(/\r?\n/).join("<br>"); }

  /* ---------- launch time ----------
     Pages CMS saves "yyyy-MM-ddTHH:mm" with no offset. Interpret it as wall-clock
     time in the configured zone, so every visitor counts down to the same instant. */
  function tzOffset(ts, tz) {
    var p = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).formatToParts(new Date(ts)).forEach(function (x) { p[x.type] = x.value; });
    var asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return asUtc - (ts - (ts % 1000));
  }
  function parseLaunch(value, tz) {
    var s = String(value || "").trim();
    if (!s) return NaN;
    if (/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(s)) return Date.parse(s);
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
    if (!m) { console.warn("[vviix] launch_date not understood:", s); return NaN; }
    var y = +m[1], mo = +m[2] - 1, d = +m[3], h = +(m[4] || 0), mi = +(m[5] || 0), se = +(m[6] || 0);
    if (tz) {
      try {
        var wall = Date.UTC(y, mo, d, h, mi, se);
        var ts = wall - tzOffset(wall, tz);
        return wall - tzOffset(ts, tz);   // second pass settles DST boundaries
      } catch (err) {
        console.warn("[vviix] unknown timezone '" + tz + "', using the visitor's clock");
      }
    }
    return new Date(y, mo, d, h, mi, se).getTime();
  }
  function formatLaunch(ts) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", timeZoneName: "short"
      }).format(new Date(ts));
    } catch (err) { return new Date(ts).toLocaleString(); }
  }

  /* ---------- state ---------- */
  function baseState() {
    if (previewState) return previewState;
    var s = STATES.indexOf(cfg.drop.status) >= 0 ? cfg.drop.status : "live";
    if (s === "countdown") {
      if (!isFinite(launchTs)) return "coming-soon";
      if (Date.now() >= launchTs) return "live";
    }
    return s;
  }
  function state() {
    var s = baseState();
    if (!previewState && s === "live" && counts && counts.total > 0 && counts.available === 0) return "sold-out";
    return s;
  }

  function vars() {
    var n = Number(cfg.drop.number) || 1;
    var name = String(cfg.drop.name || "").trim() || "Drop " + pad(n, 3);
    var next = "Drop " + pad(n + 1, 3);
    var s = state();
    var run = Number(cfg.drop.run_size);
    return {
      drop: name,
      number: pad(n, 3),
      next: next,
      upcoming: s === "live" || s === "sold-out" ? next : name,
      run: run > 0 ? new Intl.NumberFormat().format(run) + " pieces" : "Limited run",
      pieces: counts && counts.total > 0 ? String(counts.total) : null,
      launch: isFinite(launchTs) ? formatLaunch(launchTs) : null
    };
  }

  function lookup(key) {
    var s = state().replace("-", "_");
    var tries = [key + "_" + s];
    if (s === "coming_soon" || s === "countdown") tries.push(key + "_waiting");
    tries.push(key);
    for (var i = 0; i < tries.length; i++) {
      var v = cfg.copy[tries[i]];
      if (typeof v === "string" && v.trim()) return v;
    }
    return null;
  }

  /* Returns null when a needed value isn't known yet (e.g. {pieces} before
     Fourthwall answers) so the page keeps its fallback text instead of "  pieces". */
  function fill(tpl, v) {
    if (tpl == null) return null;
    var missing = false;
    var out = String(tpl).replace(/\{(\w+)\}/g, function (m, k) {
      if (!Object.prototype.hasOwnProperty.call(v, k)) return m;   // typo stays visible
      if (v[k] == null) { missing = true; return ""; }
      return v[k];
    });
    return missing ? null : out;
  }

  /* ---------- painting ---------- */
  function signupHref() {
    var t = document.getElementById("signup");
    return t && !t.closest("[hidden]") ? "#signup" : "index.html#signup";
  }

  function paintCta(el, s, v) {
    var short = el.getAttribute("data-drop-cta") === "short";
    var href, label;
    if (s === "live") {
      href = "shop.html";
      label = fill(el.getAttribute("data-live-label") || cfg.copy.cta_live, v);
    } else {
      href = signupHref();
      label = fill(s === "sold-out" && !short ? cfg.copy.cta_sold_out : cfg.copy.cta_waiting, v);
    }
    el.setAttribute("href", href);
    if (label == null) return;
    var slot = el.querySelector("[data-drop-cta-label]");
    if (slot) slot.textContent = label; else el.textContent = label;
  }

  function paintAnnouncement(v) {
    var raw = String(cfg.site.announcement || "").trim();
    var bar = document.querySelector("[data-announce]");
    if (!raw) { if (bar) bar.remove(); return; }
    var text = fill(raw, v);
    if (text == null) text = raw.replace(/\{\w+\}/g, "").trim();
    if (!bar) {
      bar = document.createElement("div");
      bar.setAttribute("data-announce", "");
      bar.setAttribute("role", "region");
      bar.setAttribute("aria-label", "Announcement");
      bar.className = "announce";
      var header = document.querySelector(".site-header");
      if (header) header.parentNode.insertBefore(bar, header); else document.body.prepend(bar);
    }
    bar.textContent = text;
  }

  function paintPreview(s) {
    if (!previewing) return;
    var chip = document.querySelector("[data-drop-preview]");
    if (!chip) {
      chip = document.createElement("a");
      chip.setAttribute("data-drop-preview", "");
      chip.className = "drop-preview";
      chip.href = location.pathname;
      document.body.appendChild(chip);
    }
    chip.textContent = "Preview · " + s.replace("-", " ") + " · exit";
  }

  function paint() {
    var s = state();
    var v = vars();
    document.documentElement.setAttribute("data-drop-state", s);

    each("[data-drop-show]", function (el) {
      el.hidden = el.getAttribute("data-drop-show").split(/\s+/).indexOf(s) < 0;
    });
    each("[data-drop-text]", function (el) {
      var out = fill(lookup(el.getAttribute("data-drop-text")), v);
      if (out != null) el.innerHTML = lines(out);
    });
    each("[data-drop-cta]", function (el) { paintCta(el, s, v); });

    var title = document.querySelector("title[data-drop-title]");
    if (title) { var t = fill(title.getAttribute("data-drop-title"), v); if (t != null) document.title = t; }
    each("meta[data-drop-content]", function (m) {
      var c = fill(m.getAttribute("data-drop-content"), v);
      if (c != null) m.setAttribute("content", c);
    });

    paintAnnouncement(v);
    paintPreview(s);
    syncCountdown(s);

    if (s !== current) {
      var prev = current;
      current = s;
      if (prev) emit(s, prev);
    }
  }

  /* ---------- countdown ---------- */
  var UNITS = [["d", "Days"], ["h", "Hours"], ["m", "Min"], ["s", "Sec"]];

  function buildCountdown(el) {
    if (el.getAttribute("data-built")) return;
    el.setAttribute("data-built", "1");
    el.innerHTML = '<div class="countdown" role="timer" aria-live="off">' +
      UNITS.map(function (u) {
        return '<div class="countdown__unit" aria-hidden="true"><span class="countdown__num" data-cd="' + u[0] +
          '">00</span><span class="countdown__lbl">' + u[1] + "</span></div>";
      }).join('<span class="countdown__sep" aria-hidden="true">:</span>') + "</div>";
  }

  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

  function tick() {
    var ms = launchTs - Date.now();
    if (ms <= 0) {
      stopTimer();
      // A preview pinned to "countdown" must not re-enter paint() forever.
      if (baseState() !== "countdown") paint();
      return;
    }
    var sec = Math.floor(ms / 1000);
    var val = { d: Math.floor(sec / 86400), h: Math.floor((sec % 86400) / 3600), m: Math.floor((sec % 3600) / 60), s: sec % 60 };
    var parts = [];
    if (val.d) parts.push(plural(val.d, "day"));
    if (val.h) parts.push(plural(val.h, "hour"));
    parts.push(val.d || val.h || val.m ? plural(val.m, "minute") : "less than a minute");
    var spoken = vars().drop + " launches in " +
      (parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0]);

    each("[data-drop-countdown]", function (el) {
      UNITS.forEach(function (u) {
        var n = el.querySelector('[data-cd="' + u[0] + '"]');
        var t = pad(val[u[0]], 2);
        if (n && n.textContent !== t) n.textContent = t;
      });
      var box = el.querySelector(".countdown");
      // Spoken label changes once a minute at most, so screen readers aren't flooded.
      if (box && box.getAttribute("aria-label") !== spoken) box.setAttribute("aria-label", spoken);
    });
  }

  function stopTimer() { if (timer) { clearInterval(timer); timer = 0; } }

  function syncCountdown(s) {
    if (s !== "countdown" || !isFinite(launchTs)) { stopTimer(); return; }
    each("[data-drop-countdown]", buildCountdown);
    tick();
    if (!timer && baseState() === "countdown") timer = setInterval(tick, 1000);
  }

  /* ---------- events + public API ---------- */
  function emit(s, prev) {
    listeners.forEach(function (fn) { try { fn(s, prev); } catch (err) { console.error(err); } });
    try { document.dispatchEvent(new CustomEvent("vviix:drop", { detail: { state: s, previous: prev } })); } catch (err) {}
  }

  function applyConfig(data) {
    cfg = merge(DEFAULTS, data);
    launchTs = parseLaunch(cfg.drop.launch_date, cfg.drop.timezone);
    if (params.has("drop_launch_in")) {
      var secs = Number(params.get("drop_launch_in"));
      if (isFinite(secs)) { cfg.drop.status = "countdown"; launchTs = Date.now() + secs * 1000; }
    }
    if (previewState === "countdown" && !(launchTs > Date.now())) {
      launchTs = Date.now() + 3 * 86400000 + 4 * 3600000;
    }
  }

  var api = {
    ready: null,
    get state() { return state(); },
    get collection() { return String(cfg.drop.collection || "").trim() || "all"; },
    get name() { return vars().drop; },
    text: function (key) { return fill(lookup(key), vars()); },
    reportProducts: function (c) {
      counts = { total: Number(c && c.total) || 0, available: Number(c && c.available) || 0 };
      onDom(paint);
    },
    on: function (fn) { if (typeof fn === "function") listeners.push(fn); },
    refresh: function () { onDom(paint); }
  };
  window.VVIIXDrop = api;

  api.ready = fetch(SRC, { cache: "no-cache", headers: { Accept: "application/json" } })
    .then(function (r) {
      if (!r.ok) throw new Error("drop.json " + r.status);
      return r.json();
    })
    .then(function (data) {
      try { localStorage.setItem(CACHE, JSON.stringify(data)); } catch (err) {}
      return data;
    })
    .catch(function (err) {
      console.error("[vviix] drop.json unavailable, using last known settings:", err.message);
      try { return JSON.parse(localStorage.getItem(CACHE) || "null"); } catch (e) { return null; }
    })
    .then(function (data) {
      applyConfig(data);
      return new Promise(function (resolve) { onDom(function () { paint(); resolve(api); }); });
    });

  // A tab left open across launch time may have had its timer throttled.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && current) paint();
  });
})();
