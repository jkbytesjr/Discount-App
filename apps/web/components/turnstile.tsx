"use client";
import { useEffect, useRef } from "react";

declare global { interface Window { turnstile?: { render: (el: HTMLElement, o: { sitekey: string; callback: (t: string) => void }) => void } } }

/** Cloudflare Turnstile widget; renders only when a site key is configured. */
export function Turnstile({ onToken }: { onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!key || !ref.current) return;
    const el = ref.current;
    const draw = () => window.turnstile?.render(el, { sitekey: key, callback: onToken });
    if (window.turnstile) return draw();
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true; s.onload = draw;
    document.head.appendChild(s);
  }, [key, onToken]);
  return key ? <div ref={ref} /> : null;
}
