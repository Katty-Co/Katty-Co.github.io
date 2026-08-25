/* Katty & Co. — interactivity for the static site.
   Replaces the design-time React runtime. No dependencies, no CDN. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- mobile menu ---------------- */
  (function () {
    var btn = $('[data-menu-btn]'), menu = $('#kc-menu');
    if (!btn || !menu) return;
    function setOpen(open) {
      if (open) menu.removeAttribute('hidden'); else menu.setAttribute('hidden', '');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function (e) { e.preventDefault(); setOpen(menu.hasAttribute('hidden')); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hasAttribute('hidden')) { setOpen(false); btn.focus(); }
    });
    // never leave the menu stranded open when we cross back to desktop
    var mq = window.matchMedia('(min-width: 881px)');
    var onMq = function () { if (mq.matches) setOpen(false); };
    mq.addEventListener ? mq.addEventListener('change', onMq) : mq.addListener(onMq);
  })();

  /* ---------------- googly eyes (home) ---------------- */
  (function () {
    var eyes = $('[data-eyes]'), pl = $('[data-pupil="l"]'), pr = $('[data-pupil="r"]');
    if (!eyes || !pl || !pr) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(hover: none)').matches) return;
    var raf = null, mx = 0, my = 0;
    function apply() {
      raf = null;
      var r = eyes.getBoundingClientRect();
      if (!r.width) return;
      var dx = mx - (r.left + r.width / 2), dy = my - (r.top + r.height / 2);
      var d = Math.hypot(dx, dy) || 1;
      var k = Math.min(1, d / 380) * 13;
      var t = 'translate(' + (dx / d * k).toFixed(1) + 'px,' + (dy / d * k).toFixed(1) + 'px)';
      pl.style.transform = t; pr.style.transform = t;
    }
    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (raf === null) raf = requestAnimationFrame(apply);
    }, { passive: true });
  })();

  /* ---------------- pack flip cards ---------------- */
  $$('[data-flip]').forEach(function (card) {
    function toggle() {
      var on = card.getAttribute('aria-pressed') === 'true';
      card.setAttribute('aria-pressed', on ? 'false' : 'true');
      card.style.transform = on ? 'none' : 'rotateY(180deg)';
    }
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });

  /* ---------------- chip groups ---------------- */
  var CHIP_COLORS = { 'Boarding': '#F7BE45', 'Day care': '#5CC3C9', 'Drop-ins': '#B79BE6', 'Walks': '#F4795B' };
  function chipGroup(kind, onPick) {
    var chips = $$('[data-chip="' + kind + '"]');
    if (!chips.length) return null;
    var idle = kind === 'count' ? '#FFF4E4' : (document.body.getAttribute('data-chip-idle') || '#FFFCF6');
    function select(val) {
      chips.forEach(function (c) {
        var on = c.getAttribute('data-val') === val;
        c.style.background = on ? (kind === 'count' ? '#5CC3C9' : (CHIP_COLORS[val] || '#F7BE45')) : idle;
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var hidden = $('#f-' + (kind === 'count' ? 'pet_count' : 'service'));
      if (hidden) hidden.value = val;
      if (onPick) onPick(val);
    }
    chips.forEach(function (c) {
      c.setAttribute('aria-pressed', 'false');
      c.addEventListener('click', function (e) { e.preventDefault(); select(c.getAttribute('data-val')); });
    });
    var initial = ($('#f-' + (kind === 'count' ? 'pet_count' : 'service')) || {}).value || chips[0].getAttribute('data-val');
    select(initial);
    return select;
  }

  /* ---------------- review stars ---------------- */
  (function () {
    var stars = $$('[data-star]');
    if (!stars.length) return;
    function set(n) {
      stars.forEach(function (s) {
        var v = Number(s.getAttribute('data-star'));
        s.textContent = v <= n ? '★' : '☆';
        s.style.color = v <= n ? '#F4795B' : '#2B1D18';
        s.setAttribute('aria-pressed', v === n ? 'true' : 'false');
      });
      var h = $('#f-rating'); if (h) h.value = String(n);
    }
    stars.forEach(function (s) {
      s.addEventListener('click', function (e) { e.preventDefault(); set(Number(s.getAttribute('data-star'))); });
    });
    set(Number(($('#f-rating') || {}).value || 5));
  })();

  /* ---------------- booking: pet count drives which blocks show ---------------- */
  var CAP_IN_HOME = "Heads up — boarding and day care happen in our one-bedroom apartment, so we cap those at two pets per family. For three or more, drop-in visits at your place or group walks are the way to go.";
  var CAP_OUT = "No cap on walks or drop-in visits at your own place — tell me about the whole crew and I'll sort the timing.";

  (function () {
    var b1 = $('[data-pet-block="1"]'), b2 = $('[data-pet-block="2"]');
    var crew = $('[data-crew-block]'), note = $('[data-cap-note]');
    if (!b1 && !crew) { chipGroup('service'); return; }
    var count = '1', service = 'Boarding';

    function show(el, on) {
      if (!el) return;
      if (on) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
      // don't submit fields the visitor can't see
      $$('input,select,textarea', el).forEach(function (f) { f.disabled = !on; });
    }
    function render() {
      var many = count === '3+';
      show(b1, !many);
      show(b2, count === '2');
      show(crew, many);
      var lg1 = $('[data-pet-legend="1"]');
      if (lg1) lg1.textContent = count === '2' ? 'Pet 1' : 'Your pet';
      if (note) {
        if (many) {
          var inHome = service === 'Boarding' || service === 'Day care';
          note.textContent = inHome ? CAP_IN_HOME : CAP_OUT;
          note.style.background = inHome ? '#F7BE45' : '#FFF4E4';
          note.removeAttribute('hidden');
        } else note.setAttribute('hidden', '');
      }
    }
    chipGroup('count', function (v) { count = v; render(); });
    chipGroup('service', function (v) { service = v; render(); });
    render();
  })();

  /* ---------------- forms → Formspree ---------------- */
  $$('form[action*="formspree.io"]').forEach(function (form) {
    var panel = document.querySelector('[data-sent-panel]');
    var err = document.createElement('p');
    err.hidden = true;
    err.setAttribute('role', 'alert');
    err.style.cssText = 'margin:14px 0 0;padding:14px 16px;border:3px solid #2B1D18;border-radius:16px;background:#F4795B;color:#FFFCF6;font-weight:700;';
    form.appendChild(err);

    function fail(msg) {
      err.textContent = msg;
      err.hidden = false;
      err.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var btn = form.querySelector('button[type="submit"]');
      var label = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      }).then(function (res) {
        if (!res.ok) return res.json().then(function (d) { throw new Error((d.errors || []).map(function (x) { return x.message; }).join(', ') || 'Something went wrong.'); });
        // personalise the thank-you where the design asked for a name
        if (panel) {
          var nm = (form.querySelector('[name="name"]') || {}).value || '';
          nm = String(nm).trim().split(' ')[0] || 'there';
          panel.innerHTML = panel.innerHTML.replace(/__NAME__/g, nm);
          form.hidden = true;
          panel.hidden = false;
          panel.focus();
          panel.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } else {
          form.hidden = true;
        }
      }).catch(function (e2) {
        fail(e2.message + " — you can also email alefajbel@gmail.com directly.");
      }).then(function () {
        if (btn) { btn.disabled = false; btn.textContent = label; }
      });
    });
  });

  /* ---------------- "send another" resets the form ---------------- */
  $$('[data-sent-reset]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      var panel = document.querySelector('[data-sent-panel]');
      var form = document.querySelector('form[action*="formspree.io"]');
      if (panel) panel.hidden = true;
      if (form) { form.reset(); form.hidden = false; form.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    });
  });
})();
