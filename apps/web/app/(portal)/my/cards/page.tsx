"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { MessageKey } from "@moz/shared";
import { api } from "@/lib/client";
import { useErrorText, useT } from "@/components/i18n";
import { Badge, SelectField, TextField, toast } from "@/components/ui";

interface MyCard { id: string; name: string; issuerName: string; cardType: string; segment: string; nickname: string | null }
interface MyWallet { walletProviderId: string; name: string }
interface Prefs { alertsEnabled: boolean; mode: "PERSONALISED" | "PERSONALISED_PLUS_GENERAL" | "ALL"; quietFrom: string | null; quietTo: string | null; generalIssuers: string[] }
interface Product { id: string; name: string; issuerId: string }
interface Issuer { id: string; shortName: string }
interface Wallet { id: string; name: string }

export default function Page() {
  const { t } = useT();
  const errText = useErrorText();
  const [cards, setCards] = useState<MyCard[]>([]); const [wallets, setWallets] = useState<MyWallet[]>([]); const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [products, setProducts] = useState<Product[]>([]); const [issuers, setIssuers] = useState<Issuer[]>([]); const [allWallets, setAllWallets] = useState<Wallet[]>([]);
  const [pick, setPick] = useState(""); const [nick, setNick] = useState(""); const [wpick, setWpick] = useState("");
  const reload = useCallback(async () => {
    const b = await api<{ cards: MyCard[]; wallets: MyWallet[]; prefs: Prefs }>("/me/bundle"); setCards(b.cards); setWallets(b.wallets); setPrefs(b.prefs);
  }, []);
  useEffect(() => {
    void reload().catch((e) => toast(errText(e), true));
    api<Product[]>("/card-products").then(setProducts).catch(() => {}); api<Issuer[]>("/issuers").then(setIssuers).catch(() => {}); api<Wallet[]>("/wallet-providers").then(setAllWallets).catch(() => {});
  }, []);
  const issuer = (id: string) => issuers.find((i) => i.id === id)?.shortName ?? id;
  const run = async (fn: () => Promise<unknown>, ok: MessageKey) => { try { await fn(); await reload(); toast(t(ok)); } catch (e) { toast(errText(e), true); } };
  const addCard = (e: FormEvent) => { e.preventDefault(); if (pick) void run(async () => { await api("/me/cards", { method: "POST", body: { cardProductId: pick, ...(nick.trim() ? { nickname: nick.trim() } : {}) } }); setPick(""); setNick(""); }, "my.added"); };
  const addWallet = (e: FormEvent) => { e.preventDefault(); if (wpick) void run(async () => { await api("/me/wallets", { method: "POST", body: { walletProviderId: wpick } }); setWpick(""); }, "my.added"); };
  const savePrefs = (e: FormEvent) => { e.preventDefault(); if (!prefs) return; const quiet = prefs.quietFrom && prefs.quietTo ? { quietFrom: prefs.quietFrom, quietTo: prefs.quietTo } : { quietFrom: null, quietTo: null };
    void run(() => api("/me/alert-preferences", { method: "PUT", body: { alertsEnabled: prefs.alertsEnabled, mode: prefs.mode, generalIssuers: prefs.generalIssuers, ...quiet } }), "my.saved"); };

  return (
    <>
      <div><h1>{t("my.title")}</h1><p className="subtitle">{t("my.sub")}</p></div>
      <div className="grid2">
        <section className="card stack" aria-labelledby="mc"><h2 id="mc">{t("my.cards")}</h2>
          {cards.length ? <ul className="elig">{cards.map((c) => <li key={c.id} className="row between"><span><strong>{c.nickname ?? c.name}</strong><br /><small className="muted">{c.issuerName} · {t(`ctype.${c.cardType}` as MessageKey)} · {c.segment}</small></span>
            <button type="button" className="btn ghost sm" onClick={() => run(() => api(`/me/cards/${c.id}`, { method: "DELETE" }), "my.removed")} aria-label={`${t("my.remove")}: ${c.nickname ?? c.name}`}>{t("my.remove")}</button></li>)}</ul> : <p className="muted">{t("my.noCards")}</p>}
          <form className="stack" onSubmit={addCard}>
            <SelectField label={t("my.chooseCard")} value={pick} onChange={(e) => setPick(e.target.value)}><option value="">–</option>{products.map((p) => <option key={p.id} value={p.id}>{issuer(p.issuerId)} · {p.name}</option>)}</SelectField>
            <TextField label={t("my.nickname")} optional value={nick} onChange={(e) => setNick(e.target.value)} maxLength={40} />
            <div><button className="btn" type="submit" disabled={!pick}>{t("my.addCard")}</button></div>
          </form>
        </section>
        <section className="card stack" aria-labelledby="mw"><h2 id="mw">{t("my.wallets")}</h2>
          {wallets.length ? <ul className="elig">{wallets.map((w) => <li key={w.walletProviderId} className="row between"><strong>{w.name}</strong>
            <button type="button" className="btn ghost sm" onClick={() => run(() => api(`/me/wallets/${w.walletProviderId}`, { method: "DELETE" }), "my.removed")} aria-label={`${t("my.remove")}: ${w.name}`}>{t("my.remove")}</button></li>)}</ul> : <p className="muted">{t("my.noWallets")}</p>}
          <form className="stack" onSubmit={addWallet}>
            <SelectField label={t("my.chooseWallet")} value={wpick} onChange={(e) => setWpick(e.target.value)}><option value="">–</option>{allWallets.filter((w) => !wallets.some((x) => x.walletProviderId === w.id)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</SelectField>
            <div><button className="btn" type="submit" disabled={!wpick}>{t("my.addWallet")}</button></div>
          </form>
        </section>
      </div>
      {prefs ? (
        <form className="card stack" onSubmit={savePrefs} aria-labelledby="mp"><h2 id="mp">{t("my.prefs")}</h2>
          <label className="check"><input type="checkbox" checked={prefs.alertsEnabled} onChange={(e) => setPrefs({ ...prefs, alertsEnabled: e.target.checked })} />{t("my.alertsOn")}</label>
          <SelectField label={t("my.mode")} value={prefs.mode} onChange={(e) => setPrefs({ ...prefs, mode: e.target.value as Prefs["mode"] })}>{(["PERSONALISED", "PERSONALISED_PLUS_GENERAL", "ALL"] as const).map((m) => <option key={m} value={m}>{t(`my.mode.${m}` as MessageKey)}</option>)}</SelectField>
          {prefs.mode === "PERSONALISED_PLUS_GENERAL" ? (
            <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}><legend className="legend">{t("my.generalIssuers")}</legend>
              <div className="row">{issuers.map((i) => <label key={i.id} className="check"><input type="checkbox" checked={prefs.generalIssuers.includes(i.id)} onChange={(e) => setPrefs({ ...prefs, generalIssuers: e.target.checked ? [...prefs.generalIssuers, i.id] : prefs.generalIssuers.filter((x) => x !== i.id) })} />{i.shortName}</label>)}</div></fieldset>
          ) : null}
          <div className="grid2"><TextField type="time" label={`${t("my.quiet")}: ${t("my.quietFrom")}`} optional value={prefs.quietFrom ?? ""} onChange={(e) => setPrefs({ ...prefs, quietFrom: e.target.value || null })} /><TextField type="time" label={`${t("my.quiet")}: ${t("my.quietTo")}`} optional value={prefs.quietTo ?? ""} onChange={(e) => setPrefs({ ...prefs, quietTo: e.target.value || null })} /></div>
          <div><button className="btn" type="submit">{t("common.save")}</button> <Badge>{prefs.alertsEnabled ? t("common.active") : t("common.inactive")}</Badge></div>
        </form>
      ) : null}
    </>
  );
}
