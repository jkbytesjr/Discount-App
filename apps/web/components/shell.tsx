"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { SUPPORTED_LOCALES, type Locale, type MessageKey } from "@moz/shared";
import { api, setCsrf } from "@/lib/client";
import { setLocaleCookie, useT } from "./i18n";
import { useMe } from "./session";
import { Icon } from "./ui";

interface Item { href: string; label: MessageKey; icon: string }
const NAV: Record<string, Item[]> = {
  ADMIN: [
    { href: "/dashboard", label: "nav.dashboard", icon: "home" }, { href: "/admin/users", label: "nav.users", icon: "users" },
    { href: "/admin/businesses", label: "nav.businesses", icon: "building" }, { href: "/admin/catalogue", label: "nav.catalogue", icon: "tag" },
    { href: "/account", label: "nav.account", icon: "user" },
  ],
  BUSINESS_OWNER: [
    { href: "/dashboard", label: "nav.dashboard", icon: "home" }, { href: "/business", label: "nav.myBusiness", icon: "building" },
    { href: "/account", label: "nav.account", icon: "user" },
  ],
  USER: [{ href: "/dashboard", label: "nav.dashboard", icon: "home" }, { href: "/account", label: "nav.account", icon: "user" }],
};

function useOutside(ref: React.RefObject<HTMLElement | null>, on: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const click = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) on(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") on(); };
    document.addEventListener("mousedown", click); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [ref, on, active]);
}

export function Shell({ children }: { children: ReactNode }) {
  const { t, locale } = useT();
  const { me } = useMe();
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState<"user" | "bell" | null>(null);
  const [q, setQ] = useState("");
  const popRef = useRef<HTMLDivElement>(null);
  const items = me.mfaPending ? NAV.USER!.filter((i) => i.href === "/account") : NAV[me.role] ?? [];

  useEffect(() => { try { setCollapsed(localStorage.getItem("moz_nav") === "1"); } catch { /* storage blocked: stay expanded */ } }, []);
  useEffect(() => setOpen(false), [path]);
  useOutside(popRef, () => setMenu(null), menu !== null);

  const toggle = () => { const v = !collapsed; setCollapsed(v); try { localStorage.setItem("moz_nav", v ? "1" : "0"); } catch { /* ignore */ } };
  async function logout() { try { await api("/auth/logout", { method: "POST", body: {} }); } finally { setCsrf(undefined); router.replace("/login"); } }
  const other = SUPPORTED_LOCALES.find((l) => l !== locale) as Locale;
  const search = (e: FormEvent) => { e.preventDefault(); router.push(`/admin/users?q=${encodeURIComponent(q)}`); };

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <nav className={`sidebar ${open ? "open" : ""}`} aria-label="Main">
        <Link href="/dashboard" className="brand"><img src="/brand/logo.svg" alt="" /><span>{t("app.name")}</span></Link>
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="nav-link" aria-current={path === i.href || (i.href !== "/dashboard" && path.startsWith(i.href)) ? "page" : undefined} title={collapsed ? t(i.label) : undefined}>
            <Icon name={i.icon} /><span className="nav-label">{t(i.label)}</span>
          </Link>
        ))}
        <div style={{ marginTop: "auto" }}>
          <button type="button" className="nav-link" style={{ width: "100%", background: "none", border: 0, borderLeft: "3px solid transparent", font: "inherit", cursor: "pointer" }} onClick={toggle} aria-pressed={collapsed}>
            <span style={{ transform: collapsed ? "none" : "rotate(180deg)", display: "inline-flex" }}><Icon name="chevron" /></span><span className="nav-label">{t("nav.collapse")}</span>
          </button>
        </div>
      </nav>
      <div className="main">
        <header className="topbar">
          <button type="button" className="btn ghost icon-btn menu-btn" onClick={() => setOpen(!open)} aria-label={t("nav.openMenu")} aria-expanded={open}><Icon name="menu" /></button>
          {me.role === "ADMIN" && !me.mfaPending ? (
            <form className="search" role="search" onSubmit={search}>
              <Icon name="search" size={18} />
              <input className="input" type="search" aria-label={t("common.search")} placeholder={t("nav.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
            </form>
          ) : null}
          <span className="grow" />
          <button type="button" className="btn ghost sm" onClick={() => { setLocaleCookie(other); router.refresh(); }} lang={other}><Icon name="globe" size={18} />{other === "en" ? "English" : "Português"}</button>
          <div className="menu" ref={popRef}>
            <button type="button" className="btn ghost icon-btn" aria-label={t("nav.notifications")} aria-expanded={menu === "bell"} onClick={() => setMenu(menu === "bell" ? null : "bell")}><Icon name="bell" /></button>
            {menu === "bell" ? <div className="menu-pop" role="region" aria-label={t("nav.notifications")}><p className="muted" style={{ margin: 8 }}>{t("nav.noNotifications")}</p></div> : null}
          </div>
          <div className="menu">
            <button type="button" className="btn ghost icon-btn" aria-label={`${me.firstName} ${me.lastName}`} aria-expanded={menu === "user"} onClick={() => setMenu(menu === "user" ? null : "user")}><span className="avatar" aria-hidden="true"><Icon name="user" size={18} /></span></button>
            {menu === "user" ? (
              <div className="menu-pop">
                <div style={{ padding: "8px 12px" }}><strong>{me.firstName} {me.lastName}</strong><br /><small className="muted">{me.email}</small></div>
                <Link className="btn ghost sm" href="/account">{t("nav.account")}</Link>
                <button type="button" className="btn ghost sm" onClick={logout}><Icon name="logout" size={18} />{t("auth.logout")}</button>
              </div>
            ) : null}
          </div>
        </header>
        <main id="main" className="content">{children}</main>
      </div>
    </div>
  );
}
