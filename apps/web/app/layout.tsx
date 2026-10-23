import "@moz/shared/src/tokens.css";
import type { ReactNode } from "react";

export const metadata = { title: "Moz Discounts" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-MZ">
      <body style={{ background: "var(--canvas)", color: "var(--ink)", fontFamily: "var(--font-ui)", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
