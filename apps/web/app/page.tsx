export default function Home() {
  return (
    <main style={{ padding: 32 }}>
      <img src="/brand/logo.svg" alt="Moz Discounts" width={64} height={64} />
      <h1 style={{ fontFamily: "var(--font-display)" }}>Moz Discounts</h1>
      <p style={{ color: "var(--slate)" }}>Nunca perca um desconto no seu cartão.</p>
      <small style={{ color: "var(--danger)" }}>Dados de demonstração / Demo data</small>
    </main>
  );
}
