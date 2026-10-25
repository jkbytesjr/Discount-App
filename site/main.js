(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (id) { return document.getElementById(id); };

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

  /* ---------- 1+2. story: a side-scrolling parallax street ---------- */
  var CAM_MAX = 5200, WALKER_X = 500, SWITCH = 2900;
  var SHOPS = [
    { x: 900, name: 'Restaurant', off: '10%' },
    { x: 1700, name: 'Supermarket', off: '5%' },
    { x: 2500, name: 'Spa', off: '15%' },
    { x: 3700, name: 'Restaurant', off: '10%', n: 'Restaurant ahead: 10% off', b: 'On your BCI card, 80 m away' },
    { x: 4500, name: 'Supermarket', off: '5%', n: 'Supermarket nearby: 5% off', b: 'Paying with M-Pesa, 60 m away' },
    { x: 5300, name: 'Spa', off: '15%', n: 'Spa on your left: 15% off', b: 'On your Absa card, 90 m away' }
  ];
  var street = $('street'), L = {}, shopEls = [], legs = {};

  function buildStreet() {
    var defs = el('defs', {}, street);
    var g = el('linearGradient', { id: 'awn', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    el('stop', { offset: 0, 'stop-color': '#ff2d9b' }, g);
    el('stop', { offset: 1, 'stop-color': '#7b3cff' }, g);
    var r = rng(42);

    L.far = el('g', {}, street);
    for (var x = 0, w; x < 2400; x += w + 10 + r() * 30) {
      w = 70 + r() * 80;
      var h = 90 + r() * 150;
      el('rect', { x: x, y: 440 - h, width: w, height: h, 'class': 'sk-far' }, L.far);
    }
    L.mid = el('g', {}, street);
    for (x = 0; x < 4000; x += w + 20 + r() * 50) {
      w = 110 + r() * 90;
      h = 140 + r() * 150;
      el('rect', { x: x, y: 470 - h, width: w, height: h, rx: 6, 'class': 'sk-mid' }, L.mid);
      for (var wy = 470 - h + 18; wy < 440; wy += 34)
        for (var wx = x + 14; wx < x + w - 20; wx += 30)
          if (r() > 0.45) el('rect', { x: wx, y: wy, width: 14, height: 18, rx: 2, 'class': 'win' }, L.mid);
    }
    L.ground = el('g', {}, street);
    el('rect', { x: -200, y: 470, width: 7000, height: 100, 'class': 's-road' }, L.ground);
    el('line', { x1: -200, y1: 525, x2: 6800, y2: 525, 'class': 's-dash' }, L.ground);
    for (x = 200; x < 6600; x += 450) {
      el('path', { d: 'M' + x + ' 470 V 330 q 0 -16 24 -16', 'class': 'lamp' }, L.ground);
      el('circle', { cx: x + 24, cy: 322, r: 7, 'class': 'lamp-g' }, L.ground);
    }
    SHOPS.forEach(function (s, i) {
      var sg = el('g', { 'class': 'shop-g' }, L.ground);
      if (i >= 3) el('circle', { cx: s.x, cy: 430, r: 200, 'class': 'zone' }, sg);
      el('rect', { x: s.x - 80, y: 350, width: 160, height: 120, rx: 10, 'class': 'body' }, sg);
      el('path', { d: 'M' + (s.x - 92) + ' 362 L' + (s.x - 70) + ' 326 H' + (s.x + 70) + ' L' + (s.x + 92) + ' 362 Z', 'class': 'awn' }, sg);
      el('text', { x: s.x, y: 412 }, sg).textContent = s.name;
      el('circle', { cx: s.x + 72, cy: 340, r: 25, 'class': 'tagc' }, sg);
      el('text', { x: s.x + 72, y: 346, 'class': 'tagt' }, sg).textContent = s.off;
      if (i < 3) el('text', { x: s.x, y: 310, 'class': 'missx' }, sg).textContent = 'missed';
      shopEls.push(sg);
    });
    // walker
    var w = el('g', { transform: 'translate(' + WALKER_X + ' 505)' }, street);
    el('circle', { cx: 0, cy: -70, r: 70, 'class': 'wk-glow' }, w);
    legs.a = el('line', { x1: 0, y1: -48, x2: 0, y2: 0, 'class': 'wk' }, w);
    legs.b = el('line', { x1: 0, y1: -48, x2: 0, y2: 0, 'class': 'wk' }, w);
    el('line', { x1: 0, y1: -48, x2: 0, y2: -100, 'class': 'wk' }, w);
    el('line', { x1: 0, y1: -90, x2: 20, y2: -74, 'class': 'wk' }, w);
    el('rect', { x: 16, y: -86, width: 11, height: 18, rx: 3, 'class': 'wk-phone' }, w);
    el('circle', { cx: 0, cy: -118, r: 14, 'class': 'wk-head' }, w);
    L.front = el('g', {}, street);
    for (x = 0; x < 9000; x += 260 + r() * 260)
      el('circle', { cx: x, cy: 400 + r() * 180, r: 22 + r() * 40, 'class': 'fg-bokeh' }, L.front);
  }

  var missedEl = $('missed'), nTitle = $('n-title'), nBody = $('n-body'), notif = $('notif');
  var chP = $('ch-problem'), chS = $('ch-solution'), bar = $('story-bar');

  function drawStory(p) {
    var cam = p * CAM_MAX, wx = WALKER_X + cam, n = 0, active = null;
    L.far.setAttribute('transform', 'translate(' + (-cam * 0.2).toFixed(1) + ' 0)');
    L.mid.setAttribute('transform', 'translate(' + (-cam * 0.5).toFixed(1) + ' 0)');
    L.ground.setAttribute('transform', 'translate(' + (-cam).toFixed(1) + ' 0)');
    L.front.setAttribute('transform', 'translate(' + (-cam * 1.6).toFixed(1) + ' 0)');
    var a = Math.sin(cam / 20) * 0.55;
    legs.a.setAttribute('x2', (Math.sin(a) * 30).toFixed(1));
    legs.b.setAttribute('x2', (-Math.sin(a) * 30).toFixed(1));
    legs.a.setAttribute('y2', (-Math.max(0, Math.cos(a + 1.6)) * 6).toFixed(1));
    legs.b.setAttribute('y2', (-Math.max(0, Math.cos(a - 1.6)) * 6).toFixed(1));
    SHOPS.forEach(function (s, i) {
      var g = shopEls[i];
      if (i < 3) {
        var passed = wx > s.x + 110;
        g.classList.toggle('missed', passed);
        if (passed) n++;
      } else {
        var hit = Math.abs(wx - s.x) < 200;
        g.classList.toggle('hit', hit);
        if (hit) active = s;
      }
    });
    missedEl.textContent = n;
    var second = cam > SWITCH;
    chP.classList.toggle('on', !second);
    chS.classList.toggle('on', second);
    notif.classList.toggle('on', !!active);
    nTitle.textContent = active ? active.n : 'Walking…';
    nBody.textContent = active ? active.b : 'Alerts appear as you come close.';
    bar.style.setProperty('--sp', p.toFixed(3));
  }

  /* ---------- 3 + 5. app walkthroughs: a strip that scrolls inside a frame ---------- */
  function walkthrough(stripId, stepsId, count, pctStep) {
    var strip = $(stripId), items = $(stepsId).children, last = -1;
    return function (p) {
      var t = clamp((p - 0.04) / 0.92, 0, 1) * (count - 1);
      var i = Math.min(count - 2, Math.floor(t)), f = t - i;
      var pos = i + smooth((f - 0.3) / 0.4);
      strip.style.transform = 'translate3d(0,' + (-pos * pctStep).toFixed(3) + '%,0)';
      var idx = Math.round(pos);
      if (idx !== last) {
        for (var k = 0; k < items.length; k++) items[k].classList.toggle('on', k === idx);
        last = idx;
      }
    };
  }

  /* ---------- scene registry ---------- */
  buildStreet();
  var drawIos = walkthrough('ios-strip', 'ios-steps', 4, 25);
  var drawWeb = walkthrough('web-strip', 'web-steps', 5, 20);
  var scenes = [
    { el: $('story'), draw: drawStory },
    { el: $('ios'), draw: drawIos },
    { el: $('web'), draw: drawWeb }
  ];
  scenes.forEach(function (s) {
    s.depth = [].slice.call(s.el.querySelectorAll('[data-depth]'));
  });
  var dev = $('developers');
  var devItems = [].slice.call(dev.querySelectorAll('[data-speed]'));
  var marq = [].slice.call(dev.querySelectorAll('[data-x]'));
  var phones = document.querySelector('.phones');

  function frame() {
    var h = window.innerHeight;
    scenes.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      var p = clamp(-r.top / (r.height - h), 0, 1);
      s.draw(p);
      s.depth.forEach(function (d) {
        d.style.transform = 'translate3d(0,' + ((p - 0.5) * d.dataset.depth * 4).toFixed(1) + 'px,0)';
      });
    });
    // developers: layers drift at different speeds
    var dr = dev.getBoundingClientRect(), off = dr.top + dr.height / 2 - h / 2;
    devItems.forEach(function (d) {
      d.style.transform = 'translate3d(0,' + (-off * d.dataset.speed).toFixed(1) + 'px,0)';
    });
    marq.forEach(function (m) {
      m.style.transform = 'translate3d(' + (off * 0.7 * m.dataset.x - 300).toFixed(1) + 'px,0,0)';
    });
    var max = document.documentElement.scrollHeight - h;
    root.style.setProperty('--page', max > 0 ? Math.min(1, window.scrollY / max) : 0);
    if (phones) {
      var pr = phones.getBoundingClientRect(), t = (pr.top + pr.height / 2 - h / 2) / h;
      phones.style.setProperty('--py1', (t * 50).toFixed(1) + 'px');
      phones.style.setProperty('--py2', (t * -30).toFixed(1) + 'px');
      phones.style.setProperty('--py3', (t * 70).toFixed(1) + 'px');
    }
  }

  if (reduce) {
    drawStory(4000 / CAM_MAX);
    missedEl.textContent = '3';
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

  /* ---------- reveal on scroll ---------- */
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (i) { io.observe(i); });
  } else {
    items.forEach(function (i) { i.classList.add('in'); });
  }

  /* ---------- alert preference demo ---------- */
  var DESC = {
    mine: 'You only hear about discounts your own cards and wallets unlock.',
    banks: 'Your cards plus the banks you choose, in case you are thinking of switching.',
    all: 'Every offer near you, whichever card or wallet it needs.'
  };
  var chips = document.querySelectorAll('.chip');
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      chips.forEach(function (o) { var on = o === c; o.classList.toggle('on', on); o.setAttribute('aria-pressed', on); });
      $('mode-desc').textContent = DESC[c.dataset.mode];
    });
  });
  var quiet = $('quiet');
  quiet.addEventListener('change', function () {
    $('quiet-state').textContent = quiet.checked ? 'on, no alerts overnight' : 'off';
  });
})();
