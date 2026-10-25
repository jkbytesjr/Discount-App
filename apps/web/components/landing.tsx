"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LANDING, STACK } from "@/lib/landing-content";
import { setLocaleCookie } from "@/components/i18n";
import "@/app/landing.css";

const NS = "http://www.w3.org/2000/svg";
const CAM_MAX = 5200, WALKER_X = 500, SWITCH = 2900;
const SHOP_X = [900, 1700, 2500, 3700, 4500, 5300];
const SHOP_OFF = ["10%", "5%", "15%", "10%", "5%", "15%"];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (x: number) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const rng = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/** The marketing home page (ported from docs/site): scroll-driven parallax scenes, PT/EN, links into the app. */
export function Landing({ lang, signedIn }: { lang: "pt" | "en"; signedIn: boolean }) {
  const c = LANDING[lang];
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [js, setJs] = useState(false);
  const [mode, setMode] = useState(0);
  const [quiet, setQuiet] = useState(false);
  const other = lang === "pt" ? "en" : "pt";
  const toggleLang = () => { setLocaleCookie(other === "en" ? "en" : "pt-MZ"); router.refresh(); };
  const primary = signedIn ? { href: "/dashboard", label: c.hero.dashboard } : { href: "/register", label: c.hero.create };

  useEffect(() => {
    const el = root.current; if (!el) return;
    setJs(true);
    const q = <T extends Element = HTMLElement>(sel: string) => el.querySelector(sel) as T;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const docEl = document.documentElement;
    const mk = (name: string, attrs: Record<string, string | number>, parent?: Element) => {
      const e = document.createElementNS(NS, name);
      for (const k in attrs) e.setAttribute(k, String(attrs[k]));
      if (parent) parent.appendChild(e);
      return e;
    };

    /* ---- 1+2 story street ---- */
    const street = q<SVGSVGElement>("#street"); street.innerHTML = "";
    const layers: Record<string, Element> = {}; const shopEls: Element[] = []; const legs: Record<string, Element> = {};
    const defs = mk("defs", {}, street);
    const g = mk("linearGradient", { id: "lp-awn", x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    mk("stop", { offset: 0, "stop-color": "#ff2d9b" }, g); mk("stop", { offset: 1, "stop-color": "#7b3cff" }, g);
    const r = rng(42);
    layers.far = mk("g", {}, street);
    for (let x = 0, w = 0; x < 2400; x += w + 10 + r() * 30) { w = 70 + r() * 80; const h = 90 + r() * 150; mk("rect", { x, y: 440 - h, width: w, height: h, class: "lp-sk-far" }, layers.far); }
    layers.mid = mk("g", {}, street);
    for (let x = 0, w = 0; x < 4000; x += w + 20 + r() * 50) {
      w = 110 + r() * 90; const h = 140 + r() * 150;
      mk("rect", { x, y: 470 - h, width: w, height: h, rx: 6, class: "lp-sk-mid" }, layers.mid);
      for (let wy = 470 - h + 18; wy < 440; wy += 34) for (let wx = x + 14; wx < x + w - 20; wx += 30) if (r() > 0.45) mk("rect", { x: wx, y: wy, width: 14, height: 18, rx: 2, class: "lp-win" }, layers.mid);
    }
    layers.ground = mk("g", {}, street);
    mk("rect", { x: -200, y: 470, width: 7000, height: 100, class: "lp-s-road" }, layers.ground);
    mk("line", { x1: -200, y1: 525, x2: 6800, y2: 525, class: "lp-s-dash" }, layers.ground);
    for (let x = 200; x < 6600; x += 450) { mk("path", { d: `M${x} 470 V 330 q 0 -16 24 -16`, class: "lp-lamp" }, layers.ground); mk("circle", { cx: x + 24, cy: 322, r: 7, class: "lp-lamp-g" }, layers.ground); }
    SHOP_X.forEach((x, i) => {
      const sg = mk("g", { class: "lp-shop-g" }, layers.ground);
      if (i >= 3) mk("circle", { cx: x, cy: 430, r: 200, class: "lp-zone" }, sg);
      mk("rect", { x: x - 80, y: 350, width: 160, height: 120, rx: 10, class: "lp-body" }, sg);
      mk("path", { d: `M${x - 92} 362 L${x - 70} 326 H${x + 70} L${x + 92} 362 Z`, class: "lp-awn" }, sg);
      mk("text", { x, y: 412 }, sg).textContent = c.story.shops[i % 3]!;
      mk("circle", { cx: x + 72, cy: 340, r: 25, class: "lp-tagc" }, sg);
      mk("text", { x: x + 72, y: 346, class: "lp-tagt" }, sg).textContent = SHOP_OFF[i]!;
      if (i < 3) mk("text", { x, y: 310, class: "lp-missx" }, sg).textContent = c.story.missed;
      shopEls.push(sg);
    });
    const wk = mk("g", { transform: `translate(${WALKER_X} 505)` }, street);
    mk("circle", { cx: 0, cy: -70, r: 70, class: "lp-wk-glow" }, wk);
    legs.a = mk("line", { x1: 0, y1: -48, x2: 0, y2: 0, class: "lp-wk" }, wk); legs.b = mk("line", { x1: 0, y1: -48, x2: 0, y2: 0, class: "lp-wk" }, wk);
    mk("line", { x1: 0, y1: -48, x2: 0, y2: -100, class: "lp-wk" }, wk); mk("line", { x1: 0, y1: -90, x2: 20, y2: -74, class: "lp-wk" }, wk);
    mk("rect", { x: 16, y: -86, width: 11, height: 18, rx: 3, class: "lp-wk-phone" }, wk); mk("circle", { cx: 0, cy: -118, r: 14, class: "lp-wk-head" }, wk);
    layers.front = mk("g", {}, street);
    for (let x = 0; x < 9000; x += 260 + r() * 260) mk("circle", { cx: x, cy: 400 + r() * 180, r: 22 + r() * 40, class: "lp-fg-bokeh" }, layers.front);

    const missedEl = q("#missed"), nTitle = q("#n-title"), nBody = q("#n-body"), notif = q("#notif");
    const chP = q("#ch-problem"), chS = q("#ch-solution"), bar = q("#story-bar");
    const drawStory = (p: number) => {
      const cam = p * CAM_MAX, wx = WALKER_X + cam; let n = 0; let active = -1;
      layers.far!.setAttribute("transform", `translate(${(-cam * 0.2).toFixed(1)} 0)`);
      layers.mid!.setAttribute("transform", `translate(${(-cam * 0.5).toFixed(1)} 0)`);
      layers.ground!.setAttribute("transform", `translate(${(-cam).toFixed(1)} 0)`);
      layers.front!.setAttribute("transform", `translate(${(-cam * 1.6).toFixed(1)} 0)`);
      const a = Math.sin(cam / 20) * 0.55;
      legs.a!.setAttribute("x2", (Math.sin(a) * 30).toFixed(1)); legs.b!.setAttribute("x2", (-Math.sin(a) * 30).toFixed(1));
      legs.a!.setAttribute("y2", (-Math.max(0, Math.cos(a + 1.6)) * 6).toFixed(1)); legs.b!.setAttribute("y2", (-Math.max(0, Math.cos(a - 1.6)) * 6).toFixed(1));
      SHOP_X.forEach((x, i) => {
        const sg = shopEls[i]!;
        if (i < 3) { const passed = wx > x + 110; sg.classList.toggle("lp-missed", passed); if (passed) n++; }
        else { const hit = Math.abs(wx - x) < 200; sg.classList.toggle("lp-hit", hit); if (hit) active = i - 3; }
      });
      missedEl.textContent = String(n);
      const second = cam > SWITCH;
      chP.classList.toggle("lp-on", !second); chS.classList.toggle("lp-on", second);
      notif.classList.toggle("lp-on", active >= 0);
      nTitle.textContent = active >= 0 ? c.story.alerts[active]![0] : c.story.walking;
      nBody.textContent = active >= 0 ? c.story.alerts[active]![1] : c.story.walkingBody;
      (bar as HTMLElement).style.setProperty("--sp", p.toFixed(3));
    };

    /* ---- 3 + 5 walkthrough strips ---- */
    const walkthrough = (stripId: string, stepsId: string, count: number, pctStep: number) => {
      const strip = q(stripId), items = q(stepsId).children; let last = -1;
      return (p: number) => {
        const t = clamp((p - 0.04) / 0.92, 0, 1) * (count - 1);
        const i = Math.min(count - 2, Math.floor(t)), f = t - i;
        const pos = i + smooth((f - 0.3) / 0.4);
        strip.style.transform = `translate3d(0,${(-pos * pctStep).toFixed(3)}%,0)`;
        const idx = Math.round(pos);
        if (idx !== last) { for (let k = 0; k < items.length; k++) items[k]!.classList.toggle("lp-on", k === idx); last = idx; }
      };
    };
    const scenes = [
      { el: q("#story"), draw: drawStory }, { el: q("#ios"), draw: walkthrough("#ios-strip", "#ios-steps", 4, 25) }, { el: q("#web"), draw: walkthrough("#web-strip", "#web-steps", 5, 20) },
    ].map((s) => ({ ...s, depth: [...s.el.querySelectorAll<HTMLElement>("[data-depth]")] }));
    const dev = q("#developers");
    const devItems = [...dev.querySelectorAll<HTMLElement>("[data-speed]")], marq = [...dev.querySelectorAll<HTMLElement>("[data-x]")];
    const phones = el.querySelector<HTMLElement>(".lp-phones");

    const frame = () => {
      const h = window.innerHeight;
      scenes.forEach((s) => {
        const rect = s.el.getBoundingClientRect(); const p = clamp(-rect.top / (rect.height - h), 0, 1);
        s.draw(p);
        s.depth.forEach((d) => { d.style.transform = `translate3d(0,${((p - 0.5) * Number(d.dataset.depth) * 4).toFixed(1)}px,0)`; });
      });
      const dr = dev.getBoundingClientRect(), off = dr.top + dr.height / 2 - h / 2;
      devItems.forEach((d) => { d.style.transform = `translate3d(0,${(-off * Number(d.dataset.speed)).toFixed(1)}px,0)`; });
      marq.forEach((m) => { m.style.transform = `translate3d(${(off * 0.7 * Number(m.dataset.x) - 300).toFixed(1)}px,0,0)`; });
      const max = docEl.scrollHeight - h;
      el.style.setProperty("--page", String(max > 0 ? Math.min(1, window.scrollY / max) : 0));
      if (phones) {
        const pr = phones.getBoundingClientRect(), t = (pr.top + pr.height / 2 - h / 2) / h;
        phones.style.setProperty("--py1", `${(t * 50).toFixed(1)}px`); phones.style.setProperty("--py2", `${(t * -30).toFixed(1)}px`); phones.style.setProperty("--py3", `${(t * 70).toFixed(1)}px`);
      }
    };
    let ticking = false; let onScroll: (() => void) | null = null;
    if (reduce) { drawStory(4000 / CAM_MAX); missedEl.textContent = "3"; el.style.setProperty("--page", "0"); }
    else {
      onScroll = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { frame(); ticking = false; }); };
      window.addEventListener("scroll", onScroll, { passive: true }); window.addEventListener("resize", onScroll); frame();
    }
    /* ---- reveal on scroll ---- */
    const items = el.querySelectorAll(".lp-reveal"); let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window && !reduce) {
      io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("lp-in"); io!.unobserve(e.target); } }), { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
      items.forEach((i) => io!.observe(i));
    } else items.forEach((i) => i.classList.add("lp-in"));

    return () => { if (onScroll) { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); } io?.disconnect(); };
  }, [lang]);

  const S = "/site";
  return (
    <div ref={root} className={`lp${js ? " lp-js" : ""}`} lang={lang}>
      <a className="lp-skip" href="#main">{c.skip}</a>
      <div className="lp-backdrop" aria-hidden="true"><i className="lp-bd-card lp-bd-a" /><i className="lp-bd-card lp-bd-b" /><i className="lp-bd-card lp-bd-c" /></div>
      <div className="lp-progress" aria-hidden="true"><b id="bar" /></div>

      <header className="lp-nav lp-glass">
        <a className="lp-brand" href="#top"><img src={`${S}/logo.png`} width={36} height={36} alt="" /> <span>{c.brand}</span></a>
        <nav aria-label="Main">
          <a href="#story">{c.nav.story}</a><a href="#ios">{c.nav.ios}</a><a href="#web">{c.nav.web}</a><a href="#audiences">{c.nav.business}</a><a href="#developers">{c.nav.developers}</a><a href="#guides">{c.nav.guides}</a>
        </nav>
        <button type="button" className="lp-navlang" onClick={toggleLang} lang={other}>{c.nav.lang}</button>
        <Link className="lp-btn lp-btn-sm" href={signedIn ? "/dashboard" : "/login"}>{signedIn ? c.nav.dashboard : c.nav.signIn}</Link>
      </header>

      <main id="main">
        <section className="lp-hero" id="top">
          <div className="lp-wrap lp-hero-grid">
            <div>
              <p className="lp-eyebrow lp-reveal">{c.hero.eyebrow}</p>
              <h1 className="lp-reveal lp-d1">{c.hero.h1a} <em>{c.hero.h1Em}</em><br />{c.hero.h1b}</h1>
              <p className="lp-lead lp-reveal lp-d2" dangerouslySetInnerHTML={{ __html: c.hero.lead }} />
              <div className="lp-cta lp-reveal lp-d3">
                <Link className="lp-btn" href={primary.href}>{primary.label}</Link>
                <Link className="lp-btn lp-btn-ghost" href="/map">{c.hero.map}</Link>
              </div>
              <p className="lp-note lp-reveal lp-d3"><span dangerouslySetInnerHTML={{ __html: c.hero.testflight }} /> <a href="#testflight">{c.hero.howToJoin}</a></p>
            </div>
            <div className="lp-hero-visual lp-reveal lp-d2" aria-hidden="true">
              <div className="lp-hv-card lp-c1"><span>BCI</span></div><div className="lp-hv-card lp-c2"><span>Absa</span></div><div className="lp-hv-card lp-c3"><span>M-Pesa</span></div>
              <div className="lp-hv-notif lp-glass"><img src={`${S}/logo.png`} alt="" width={34} height={34} /><div><small>{c.hero.notifSmall}</small><b>{c.hero.notifTitle}</b><span>{c.hero.notifBody}</span></div></div>
            </div>
          </div>
          <a className="lp-scroll-hint" href="#story" aria-label={c.hero.scroll}><span /></a>
        </section>

        <section className="lp-scene" id="story" aria-labelledby="problem-h">
          <div className="lp-stage lp-story-stage">
            <svg className="lp-street" id="street" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid slice" role="img" aria-label={c.story.alt} />
            <div className="lp-story-copy">
              <div className="lp-chapter lp-on" id="ch-problem"><div className="lp-copy-card">
                <p className="lp-eyebrow">{c.story.p1}</p>
                <h2 id="problem-h">{c.story.h1} <em>{c.story.hEm}</em></h2>
                <p className="lp-lead">{c.story.lead1}</p>
                <p className="lp-counter" aria-live="polite">{c.story.counter}: <b id="missed">0</b></p>
              </div></div>
              <div className="lp-chapter" id="ch-solution"><div className="lp-copy-card">
                <p className="lp-eyebrow">{c.story.p2}</p>
                <h2 id="solution-h">{c.story.h2} <em>{c.story.h2Em}</em></h2>
                <p className="lp-lead">{c.story.lead2}</p>
                <div className="lp-notif" id="notif" aria-live="polite"><img src={`${S}/logo.png`} alt="" width={34} height={34} /><div><small>{c.story.nSmall}</small><b id="n-title">{c.story.walking}</b><span id="n-body">{c.story.walkingBody}</span></div></div>
              </div></div>
            </div>
            <div className="lp-story-meter" aria-hidden="true"><i id="story-bar" /><span>{c.story.problem}</span><span>{c.story.solution}</span></div>
          </div>
        </section>

        <section className="lp-scene" id="ios" aria-labelledby="ios-h">
          <div className="lp-stage lp-split-stage">
            <div className="lp-fcards" aria-hidden="true"><i className="lp-fcard lp-f1" data-depth="-90" /><i className="lp-fcard lp-f2" data-depth="140" /><i className="lp-fcard lp-f3" data-depth="-200" /></div>
            <div className="lp-copy">
              <p className="lp-eyebrow">{c.ios.eyebrow}</p>
              <h2 id="ios-h">{c.ios.h} <em>{c.ios.hEm}</em></h2>
              <ol className="lp-steps-list" id="ios-steps">{c.ios.steps.map((s, i) => <li key={s.b} className={i === 0 ? "lp-on" : ""}><b>{s.b}</b><span>{s.s}</span></li>)}</ol>
              <p className="lp-mini">{c.ios.mini}</p>
            </div>
            <div className="lp-phone-wrap"><div className="lp-device"><div className="lp-screen"><div className="lp-strip" id="ios-strip">
              {["shot-splash", "shot-map", "shot-cards", "shot-alerts"].map((n, i) => <img key={n} src={`${S}/${n}.jpg`} width={540} height={1173} loading={i ? "lazy" : undefined} alt={c.ios.alts[i]} />)}
            </div></div></div></div>
          </div>
        </section>

        <section className="lp-block" id="personal" aria-labelledby="personal-h">
          <div className="lp-wrap lp-split">
            <div>
              <p className="lp-eyebrow lp-reveal">{c.personal.eyebrow}</p>
              <h2 id="personal-h" className="lp-reveal lp-d1">{c.personal.h} <em>{c.personal.hEm}</em></h2>
              <p className="lp-lead lp-reveal lp-d2">{c.personal.lead}</p>
              <div className="lp-chips lp-reveal lp-d2" role="group" aria-label={c.personal.group}>
                {c.personal.modes.map((m, i) => <button key={m[0]} className={`lp-chip${mode === i ? " lp-on" : ""}`} type="button" aria-pressed={mode === i} onClick={() => setMode(i)}>{m[0]}</button>)}
              </div>
              <label className="lp-toggle lp-reveal lp-d3"><input type="checkbox" checked={quiet} onChange={(e) => setQuiet(e.target.checked)} /> <span className="lp-sw" aria-hidden="true" /> {c.personal.quiet} <span>{quiet ? c.personal.on : c.personal.off}</span></label>
              <p className="lp-mini lp-reveal lp-d3">{c.personal.modes[mode]![1]}</p>
            </div>
            <div className="lp-phones lp-reveal lp-d2">
              {["shot-cards", "shot-alerts", "shot-map"].map((n, i) => <figure key={n} className={`lp-phone lp-p${i + 1}`}><img src={`${S}/${n}.jpg`} width={270} height={587} loading="lazy" alt={c.personal.alts[i]} /></figure>)}
            </div>
          </div>
        </section>

        <section className="lp-scene" id="web" aria-labelledby="web-h">
          <div className="lp-stage lp-split-stage lp-rev">
            <div className="lp-fcards" aria-hidden="true"><i className="lp-fcard lp-f1" data-depth="120" /><i className="lp-fcard lp-f2" data-depth="-150" /><i className="lp-fcard lp-f3" data-depth="180" /></div>
            <div className="lp-browser-wrap">
              <div className="lp-browser">
                <div className="lp-bar" aria-hidden="true"><i /><i /><i /><span>discount-app-rho.vercel.app</span></div>
                <div className="lp-bscreen"><div className="lp-strip" id="web-strip">
                  {["web-home", "web-profile", "web-premises", "web-discounts"].map((n, i) => <img key={n} src={`${S}/${n}.jpg`} width={1100} height={688} loading={i ? "lazy" : undefined} alt={c.web.alts[i]} />)}
                  <div className="lp-tiles" role="img" aria-label={c.web.tilesLabel}>{c.web.tiles.map((t) => <span key={t}>{t}</span>)}</div>
                </div></div>
              </div>
              <span className="lp-chip-f lp-cf1" data-depth="-60">{c.web.chips[0]}</span><span className="lp-chip-f lp-cf2" data-depth="90">{c.web.chips[1]}</span><span className="lp-chip-f lp-cf3" data-depth="-110">{c.web.chips[2]}</span>
            </div>
            <div className="lp-copy">
              <p className="lp-eyebrow">{c.web.eyebrow}</p>
              <h2 id="web-h">{c.web.h} <em>{c.web.hEm}</em></h2>
              <ol className="lp-steps-list" id="web-steps">{c.web.steps.map((s, i) => <li key={s.b} className={i === 0 ? "lp-on" : ""}><b>{s.b}</b><span>{s.s}</span></li>)}</ol>
              <Link className="lp-btn lp-btn-sm" href={signedIn ? "/dashboard" : "/login"}>{c.web.open}</Link>
            </div>
          </div>
        </section>

        <section className="lp-block" id="audiences" aria-labelledby="aud-h">
          <div className="lp-wrap">
            <p className="lp-eyebrow lp-reveal">{c.aud.eyebrow}</p>
            <h2 id="aud-h" className="lp-reveal lp-d1">{c.aud.h} <em>{c.aud.hEm}</em></h2>
            <div className="lp-flow">
              {c.aud.cards.map((a, i) => <article key={a.b} className={`lp-glass lp-tilt lp-reveal${i ? ` lp-d${i}` : ""}`}><span className="lp-ico" aria-hidden="true">{["🏦", "🍽️", "📱"][i]}</span><h3>{a.b}</h3><p>{a.s}</p></article>)}
            </div>
            <div className="lp-glass lp-manage lp-reveal">
              <b>{c.aud.manage}</b>
              <ul>{c.aud.items.map((x) => <li key={x}>{x}</li>)}</ul>
              <Link className="lp-btn lp-btn-sm" href="/register">{c.aud.register}</Link>
            </div>
          </div>
        </section>

        <section className="lp-block" id="open-source" aria-labelledby="os-h">
          <div className="lp-wrap lp-split lp-rev">
            <div className="lp-glass lp-code lp-reveal" aria-hidden="true">
              <pre><span className="lp-dim">$</span> git clone https://github.com/jkbytesjr/Discount-App{"\n"}<span className="lp-dim">$</span> corepack pnpm install{"\n"}<span className="lp-dim">$</span> corepack pnpm dev{"\n"}<span className="lp-ok">ready</span> http://localhost:3000</pre>
            </div>
            <div>
              <p className="lp-eyebrow lp-reveal">{c.oss.eyebrow}</p>
              <h2 id="os-h" className="lp-reveal lp-d1">{c.oss.h} <em>{c.oss.hEm}</em></h2>
              <p className="lp-lead lp-reveal lp-d2">{c.oss.lead}</p>
              <a className="lp-btn lp-reveal lp-d3" href="https://github.com/jkbytesjr/Discount-App">{c.oss.github}</a>
            </div>
          </div>
        </section>

        <section className="lp-dev" id="developers" aria-labelledby="dev-h">
          <div className="lp-dev-bg" aria-hidden="true">
            <div className="lp-marq lp-m1" data-x="-1">{c.dev.marq1}</div><div className="lp-marq lp-m2" data-x="1">{c.dev.marq2}</div>
            <i className="lp-orb lp-o1" data-speed="0.35" /><i className="lp-orb lp-o2" data-speed="-0.25" /><i className="lp-orb lp-o3" data-speed="0.5" />
            <b className="lp-pct lp-p1" data-speed="0.6">%</b><b className="lp-pct lp-p2" data-speed="-0.4">%</b><b className="lp-pct lp-p3" data-speed="0.25">%</b>
          </div>
          <div className="lp-wrap">
            <p className="lp-eyebrow lp-reveal">{c.dev.eyebrow}</p>
            <h2 id="dev-h" className="lp-reveal lp-d1">{c.dev.h} <em>{c.dev.hEm}</em></h2>
            <p className="lp-lead lp-reveal lp-d2">{c.dev.lead}</p>
            <div className="lp-devs">
              <div className="lp-dv" data-speed="0.14"><article className="lp-glass lp-tilt lp-reveal"><span className="lp-avatar" aria-hidden="true">JS</span><h3>Jaikumar Sathish</h3><p>{c.dev.role}</p><a className="lp-link" href="https://www.linkedin.com/in/jkbytes">{c.dev.linkedin} →</a></article></div>
              <div className="lp-dv" data-speed="-0.08"><article className="lp-glass lp-tilt lp-reveal lp-d1"><span className="lp-avatar lp-alt" aria-hidden="true">JS</span><h3>Joshkyle Sathish</h3><p>{c.dev.role}</p><a className="lp-link" href="https://www.linkedin.com/in/joshkyle-sathish-b24831360">{c.dev.linkedin} →</a></article></div>
            </div>
            <p className="lp-mini lp-reveal">{c.dev.built} <a className="lp-link" href="https://github.com/jkbytesjr/Discount-App">github.com/jkbytesjr/Discount-App</a></p>
          </div>
        </section>

        <section className="lp-block" id="guides" aria-labelledby="guides-h">
          <div className="lp-wrap">
            <p className="lp-eyebrow lp-reveal">{c.guides.eyebrow}</p>
            <h2 id="guides-h" className="lp-reveal lp-d1">{c.guides.h} <em>{c.guides.hEm}</em></h2>
            <div className="lp-steps">{c.guides.steps.map((s, i) => <div key={s.b} className={`lp-glass lp-reveal${i ? ` lp-d${i}` : ""}`}><b>{i + 1}</b><h3>{s.b}</h3><p>{s.s}</p></div>)}</div>
            <div className="lp-links">
              {[signedIn ? { href: "/dashboard", b: c.nav.dashboard, s: c.guides.links[0]!.s } : { href: "/login", ...c.guides.links[0]! }, { href: "/register", ...c.guides.links[1]! }, { href: "/map", ...c.guides.links[2]! }, { href: "/privacy", ...c.guides.links[3]! }].map((l) => <Link key={l.href} className="lp-glass lp-tilt" href={l.href}><b>{l.b}</b><span>{l.s}</span></Link>)}
            </div>
            <h3 className="lp-sub lp-reveal" id="stack">{c.guides.stack}</h3>
            <ul className="lp-stack lp-reveal" aria-label={c.guides.stack}>{STACK.map((x) => <li key={x}>{x}</li>)}</ul>
            <p className="lp-mini">{c.guides.stackNote} <a href="https://github.com/jkbytesjr/Discount-App#tech-stack">{c.guides.readme}</a>.</p>
            <div className="lp-glass lp-tf lp-reveal" id="testflight">
              <div><h3>{c.guides.tfH}</h3><p>{c.guides.tfP}</p></div>
              <a className="lp-btn" href="https://www.linkedin.com/in/jkbytes">{c.guides.tfBtn}</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-foot">
          <div><img src={`${S}/logo.png`} width={40} height={40} alt="" /> <b>{c.brand}</b><p>{c.foot.about}</p></div>
          <nav aria-label="Footer">
            <Link href={signedIn ? "/dashboard" : "/login"}>{signedIn ? c.nav.dashboard : c.foot.signIn}</Link>
            <Link href="/register">{c.foot.create}</Link><Link href="/privacy">{c.foot.privacy}</Link><Link href="/privacy#labels">{c.foot.label}</Link>
            <a href="#guides">{c.foot.guides}</a><a href="#stack">{c.foot.stack}</a><a href="https://github.com/jkbytesjr/Discount-App">{c.foot.github}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
