"use client";
// Small SVG line chart (design doc 6: gradient line + area fill, faint gridlines, emphasised end point). No chart library (POC).
interface Series { label: string; values: number[]; color: string }
export function LineChart({ labels, series, title }: { labels: string[]; series: Series[]; title: string }) {
  const W = 640, H = 180, P = { l: 30, r: 12, t: 12, b: 24 };
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const x = (i: number) => P.l + (labels.length <= 1 ? 0 : (i * (W - P.l - P.r)) / (labels.length - 1));
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f));
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title} style={{ display: "block" }}>
        <defs>{series.map((s, i) => <linearGradient key={i} id={`area${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity=".35" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient>)}</defs>
        {ticks.map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.09)" /><text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="rgba(255,255,255,.7)">{t}</text></g>)}
        {series.map((s, i) => {
          const pts = s.values.map((v, j) => `${x(j)},${y(v)}`);
          return (
            <g key={s.label}>
              <polygon points={`${x(0)},${y(0)} ${pts.join(" ")} ${x(s.values.length - 1)},${y(0)}`} fill={`url(#area${i})`} />
              <polyline points={pts.join(" ")} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={x(s.values.length - 1)} cy={y(s.values[s.values.length - 1] ?? 0)} r="4.5" fill={s.color} stroke="#fff" strokeWidth="1.5" />
            </g>
          );
        })}
        {[0, Math.floor((labels.length - 1) / 2), labels.length - 1].map((i) => labels[i] ? <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"} fontSize="10" fill="rgba(255,255,255,.7)">{labels[i]!.slice(5)}</text> : null)}
      </svg>
      <figcaption className="row" style={{ gap: 16, fontSize: 12 }}>{series.map((s) => <span key={s.label} className="row" style={{ gap: 6 }}><span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />{s.label}</span>)}</figcaption>
    </figure>
  );
}
