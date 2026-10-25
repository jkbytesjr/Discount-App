(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  var PATH = 'M30 330 C 190 330, 230 210, 400 215 S 620 110, 772 92';
  var SHOPS = [
    { f: 0.2, side: -1, name: 'Restaurant', off: '10%', n: 'Restaurant ahead: 10% off', b: 'On your BCI card, 80 m away' },
    { f: 0.5, side: 1, name: 'Supermarket', off: '5%', n: 'Supermarket nearby: 5% off', b: 'Paying with M-Pesa, 60 m away' },
    { f: 0.8, side: -1, name: 'Spa', off: '15%', n: 'Spa on your left: 15% off', b: 'On your Absa card, 90 m away' }
  ];

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function buildMap(svg, withRings) {
    var road = el('path', { d: PATH, 'class': 'road' }, svg);
    el('path', { d: PATH, 'class': 'road-line' }, svg);
    var len = road.getTotalLength();
    var shops = SHOPS.map(function (s) {
      var pt = road.getPointAtLength(len * s.f);
      var cx = pt.x, cy = pt.y + s.side * 78;
      var g = el('g', { 'class': 'shop' }, svg);
      if (withRings) el('circle', { cx: pt.x, cy: pt.y + s.side * 30, r: 78, 'class': 'ring' }, g);
      el('rect', { x: cx - 52, y: cy - 24, width: 104, height: 48 }, g);
      el('text', { x: cx, y: cy + 4 }, g).textContent = s.name;
      var tx = cx + 44, ty = cy - 24;
      el('circle', { cx: tx, cy: ty, r: 20, 'class': 'tag' }, g);
      el('text', { x: tx, y: ty + 4, 'class': 'tagtxt' }, g).textContent = s.off;
      var x = el('text', { x: cx, y: cy - 36, 'class': 'miss-x', opacity: 0 }, g);
      x.textContent = withRings ? '' : 'missed';
      return { g: g, pt: pt, miss: x, s: s };
    });
    var halo = el('circle', { r: 20, 'class': 'walker-halo' }, svg);
    var w = el('circle', { r: 9, 'class': 'walker' }, svg);
    return { road: road, len: len, shops: shops, halo: halo, w: w };
  }

  function place(m, p) {
    var pt = m.road.getPointAtLength(m.len * p);
    m.w.setAttribute('cx', pt.x); m.w.setAttribute('cy', pt.y);
    m.halo.setAttribute('cx', pt.x); m.halo.setAttribute('cy', pt.y);
    return pt;
  }

  var P = buildMap(document.getElementById('svg-problem'), false);
  var S = buildMap(document.getElementById('svg-solution'), true);
  var missedEl = document.getElementById('missed');
  var nTitle = document.getElementById('n-title');
  var nBody = document.getElementById('n-body');
  var notif = document.querySelector('.notif');

  function drawProblem(p) {
    var pos = 0.02 + p * 0.96, n = 0;
    place(P, pos);
    P.shops.forEach(function (o) {
      var passed = pos > o.s.f + 0.04;
      o.g.classList.toggle('missed', passed);
      o.miss.setAttribute('opacity', passed ? 1 : 0);
      if (passed) n++;
    });
    missedEl.textContent = n;
  }

  function drawSolution(p) {
    var pos = 0.02 + p * 0.96, active = null;
    var pt = place(S, pos);
    S.shops.forEach(function (o) {
      var d = Math.hypot(pt.x - o.pt.x, pt.y - (o.pt.y + o.s.side * 30));
      var hit = d < 78;
      o.g.classList.toggle('hit', hit);
      if (hit) active = o.s;
    });
    notif.classList.toggle('on', !!active);
    if (active) { nTitle.textContent = active.n; nBody.textContent = active.b; }
    else { nTitle.textContent = 'Walking…'; nBody.textContent = 'Alerts appear as you come close.'; }
  }

  var scenes = [
    { el: document.getElementById('problem'), draw: drawProblem },
    { el: document.getElementById('solution'), draw: drawSolution }
  ];

  function frame() {
    var h = window.innerHeight;
    scenes.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      var p = Math.min(1, Math.max(0, -r.top / (r.height - h)));
      s.draw(p);
    });
    var max = document.documentElement.scrollHeight - h;
    root.style.setProperty('--page', max > 0 ? Math.min(1, window.scrollY / max) : 0);
    // gentle parallax on the phone mock-ups
    var ph = document.querySelector('.phones');
    if (ph) {
      var pr = ph.getBoundingClientRect(), t = (pr.top + pr.height / 2 - h / 2) / h;
      ph.style.setProperty('--py1', (t * 50).toFixed(1) + 'px');
      ph.style.setProperty('--py2', (t * -30).toFixed(1) + 'px');
      ph.style.setProperty('--py3', (t * 70).toFixed(1) + 'px');
    }
  }

  if (reduce) {
    // static end states, no scroll-driven motion
    drawProblem(1); drawSolution(0.56);
    root.style.setProperty('--page', 0);
  } else {
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { frame(); ticking = false; });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    frame();
  }

  // reveal on scroll
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (i) { io.observe(i); });
  } else {
    items.forEach(function (i) { i.classList.add('in'); });
  }

  // alert preference demo
  var DESC = {
    mine: 'You only hear about discounts your own cards and wallets unlock.',
    banks: 'Your cards plus the banks you choose, in case you are thinking of switching.',
    all: 'Every offer near you, whichever card or wallet it needs.'
  };
  var chips = document.querySelectorAll('.chip');
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      chips.forEach(function (o) { var on = o === c; o.classList.toggle('on', on); o.setAttribute('aria-pressed', on); });
      document.getElementById('mode-desc').textContent = DESC[c.dataset.mode];
    });
  });
  var quiet = document.getElementById('quiet');
  quiet.addEventListener('change', function () {
    document.getElementById('quiet-state').textContent = quiet.checked ? 'on, no alerts overnight' : 'off';
  });
})();
