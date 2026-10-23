"use client";
import { useEffect, useLayoutEffect, useRef } from "react";

// Liquid-glass selection indicator (docs/DESIGN-GLASSMORPHISM.md section 6b).
// One aria-hidden `.liquid` element per group travels from the old item to the new one:
// it stretches toward the target, squeezes across its width, then settles with a small squash-and-overshoot.
const ACTIVE = '[aria-selected="true"],[aria-current="page"],[aria-current="step"]';
interface Box { l: number; t: number; w: number; h: number }
const rectOf = (el: HTMLElement): Box => ({ l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
const reduced = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Attach to a positioned container whose items expose aria-selected / aria-current; `key` changes whenever the active item does. */
export function useLiquid<T extends HTMLElement = HTMLElement>(key: unknown, opts: { seg?: boolean } = {}) {
  const box = useRef<T>(null);
  const ind = useRef<HTMLSpanElement | null>(null);
  const cur = useRef<HTMLElement | null>(null);
  const anim = useRef<Animation | null>(null);

  const place = (r: Box) => { const s = ind.current!.style; s.left = `${r.l}px`; s.top = `${r.t}px`; s.width = `${r.w}px`; s.height = `${r.h}px`; };
  const snap = (el: HTMLElement | null) => {
    anim.current?.cancel(); anim.current = null; ind.current?.classList.remove("moving");
    cur.current = el;
    if (!el || !ind.current) { if (ind.current) ind.current.style.opacity = "0"; return; }
    place(rectOf(el)); ind.current.style.opacity = "1";
  };

  function go(el: HTMLElement) {
    const i = ind.current!;
    if (el === cur.current) return;
    const from = rectOf(i as unknown as HTMLElement); const to = rectOf(el);
    const vertical = Math.abs(to.t - from.t) > Math.abs(to.l - from.l);
    const u = { l: Math.min(from.l, to.l), t: Math.min(from.t, to.t), w: 0, h: 0 };
    u.w = Math.max(from.l + from.w, to.l + to.w) - u.l; u.h = Math.max(from.t + from.h, to.t + to.h) - u.t;
    if (vertical) { u.l = to.l + to.w * 0.04; u.w = to.w * 0.92; } else { u.t = to.t + to.h * 0.07; u.h = to.h * 0.86; }
    anim.current?.cancel(); cur.current = el; place(to); i.classList.add("moving");
    const K = (r: Box, tf: string, offset: number): Keyframe => ({ left: `${r.l}px`, top: `${r.t}px`, width: `${r.w}px`, height: `${r.h}px`, transform: tf, offset });
    const kf = [K(from, "scale(1)", 0), K(u, "scale(1)", 0.42), K(to, vertical ? "scale(.95,1.07)" : "scale(1.07,.93)", 0.76), K(to, "scale(1)", 1)];
    ["cubic-bezier(.4,0,.2,1)", "cubic-bezier(.2,.9,.3,1)", "ease-out"].forEach((e, n) => { kf[n]!.easing = e; });
    const a = i.animate(kf, { duration: 680 });
    anim.current = a;
    a.onfinish = () => { if (anim.current === a) { anim.current = null; i.classList.remove("moving"); } };
  }

  // Create the indicator once.
  useLayoutEffect(() => {
    const c = box.current; if (!c) return;
    const el = document.createElement("span");
    el.className = `liquid${opts.seg ? " seg" : ""}`; el.setAttribute("aria-hidden", "true");
    c.prepend(el); ind.current = el;
    return () => { anim.current?.cancel(); el.remove(); ind.current = null; cur.current = null; };
  }, []);

  // Move when the active item changes.
  useLayoutEffect(() => {
    const c = box.current; if (!c || !ind.current) return;
    const el = c.querySelector<HTMLElement>(ACTIVE);
    if (!el) return snap(null);
    if (!cur.current || reduced()) snap(el); else go(el);
  }, [key]);

  // Re-snap (no animation) on resize, once fonts are ready and on load.
  useEffect(() => {
    const resnap = () => { const el = box.current?.querySelector<HTMLElement>(ACTIVE) ?? null; if (el) snap(el); };
    window.addEventListener("resize", resnap); window.addEventListener("load", resnap);
    void document.fonts?.ready.then(resnap);
    return () => { window.removeEventListener("resize", resnap); window.removeEventListener("load", resnap); };
  }, []);

  return box;
}
