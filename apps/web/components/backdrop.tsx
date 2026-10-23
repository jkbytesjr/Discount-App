// Page backdrop (docs/DESIGN-GLASSMORPHISM.md section 4): blobs, three vivid credit cards, grain and vignette.
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <span className="blob b1" /><span className="blob b2" /><span className="blob b3" />
      <div className="vc vc1"><span className="bars" /></div>
      <div className="vc vc2"><span className="bars" /></div>
      <div className="vc vc3"><span className="bars" /></div>
      <div className="grain" /><div className="vignette" />
    </div>
  );
}
