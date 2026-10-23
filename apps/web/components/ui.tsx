"use client";
import { useEffect, useId, useRef, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { checkPassword, type MessageKey, type PasswordIssue } from "@moz/shared";
import { useT } from "./i18n";

// ---- Icons: inline SVG (no emoji), decorative by default ----
const PATHS: Record<string, string> = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  users: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21c0-4 3.6-6 8-6s8 2 8 6",
  building: "M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 9h5a1 1 0 0 1 1 1v11M8 8h2M8 12h2M8 16h2M3 21h18",
  tag: "M3 12V4h8l10 10-8 8L3 12zM7.5 8.5h.01",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6",
  menu: "M4 6h16M4 12h16M4 18h16",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8zM10 20a2 2 0 0 0 4 0",
  check: "M5 12l5 5L20 7",
  x: "M6 6l12 12M18 6L6 18",
  alert: "M12 9v4M12 17h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4",
  chevron: "M9 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  pin: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
};
export function Icon({ name, size = 20 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}

// ---- Form fields: visible label, hint, inline error (aria-describedby) ----
interface Common { label: string; error?: string; hint?: string; optional?: boolean }

function FieldShell({ id, label, error, hint, optional, children }: Common & { id: string; children: ReactNode }) {
  const { t } = useT();
  return (
    <div className="field">
      <label htmlFor={id}>{label}{optional ? <span className="muted"> {t("common.optional")}</span> : null}</label>
      {children}
      {hint && !error ? <span id={`${id}-hint`} className="hint">{hint}</span> : null}
      {error ? <span id={`${id}-err`} className="error-text"><Icon name="alert" size={16} />{error}</span> : null}
    </div>
  );
}
const describe = (id: string, error?: string, hint?: string) => (error ? `${id}-err` : hint ? `${id}-hint` : undefined);

export function TextField({ label, error, hint, optional, id: idProp, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId(); const id = idProp ?? auto;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optional={optional}>
      <input id={id} className="input" aria-invalid={error ? true : undefined} aria-describedby={describe(id, error, hint)} {...rest} />
    </FieldShell>
  );
}
export function TextArea({ label, error, hint, optional, id: idProp, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId(); const id = idProp ?? auto;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optional={optional}>
      <textarea id={id} className="input" aria-invalid={error ? true : undefined} aria-describedby={describe(id, error, hint)} {...rest} />
    </FieldShell>
  );
}
export function SelectField({ label, error, hint, optional, id: idProp, children, ...rest }: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId(); const id = idProp ?? auto;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optional={optional}>
      <select id={id} className="input" aria-invalid={error ? true : undefined} aria-describedby={describe(id, error, hint)} {...rest}>{children}</select>
    </FieldShell>
  );
}

// ---- Error summary: focused after a failed submit, links to fields ----
export interface Problem { id?: string; message: string }
export function ErrorSummary({ problems }: { problems: Problem[] }) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (problems.length) ref.current?.focus(); }, [problems]);
  if (!problems.length) return null;
  return (
    <div ref={ref} tabIndex={-1} role="alert" className="error-summary" aria-labelledby="err-title">
      <h2 id="err-title">{t("err.summary")}</h2>
      <ul>{problems.map((p, i) => <li key={i}>{p.id ? <a href={`#${p.id}`}>{p.message}</a> : p.message}</li>)}</ul>
    </div>
  );
}

export function PasswordChecklist({ password, email }: { password: string; email?: string }) {
  const { t } = useT();
  const failing = new Set<PasswordIssue>(checkPassword(password, email));
  const items: PasswordIssue[] = ["TOO_SHORT", "NO_UPPER", "NO_LOWER", "NO_NUMBER", "NO_SPECIAL"];
  return (
    <div>
      <p className="hint" style={{ margin: "0 0 4px" }}>{t("pw.title")}</p>
      <ul className="pw-list">
        {items.map((i) => (
          <li key={i} className={failing.has(i) ? "" : "ok"}>
            <Icon name={failing.has(i) ? "x" : "check"} size={14} />
            <span>{t(`pw.${i}` as MessageKey)}</span>
            <span className="sr-only">{failing.has(i) ? "✗" : "✓"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const Badge = ({ tone, children }: { tone?: "good" | "bad" | "warn"; children: ReactNode }) => <span className={`badge ${tone ?? ""}`}>{children}</span>;

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {hint ? <p>{hint}</p> : null}
      {action}
    </div>
  );
}

export function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  const { t } = useT();
  return (
    <>
      <tr><td colSpan={cols}><span className="sr-only" role="status">{t("common.loading")}</span></td></tr>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} aria-hidden="true">{Array.from({ length: cols }, (_, c) => <td key={c}><span className="skeleton" style={{ width: `${50 + ((r + c) % 4) * 12}%` }} /></td>)}</tr>
      ))}
    </>
  );
}

// ---- Dialog / drawer on native <dialog>: focus trap + Esc handled by the browser ----
export function Dialog({ open, onClose, title, children, footer, drawer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; drawer?: boolean }) {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Programmatic close() also fires the native "close" event; only user-initiated closes (Esc, X) may call onClose.
  const openRef = useRef(open);
  openRef.current = open;
  const userClose = () => { if (openRef.current) onClose(); };
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={drawer ? "drawer" : ""} aria-labelledby={titleId} onClose={userClose} onCancel={userClose}>
      {open ? (
        <>
          <div className="dlg-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="btn ghost icon-btn" onClick={onClose} aria-label={t("common.close")}><Icon name="x" /></button>
          </div>
          <div className="dlg-body">{children}</div>
          {footer ? <div className="dlg-foot">{footer}</div> : null}
        </>
      ) : null}
    </dialog>
  );
}

// ---- Toasts (aria-live) ----
type Toast = { id: number; text: string; bad?: boolean };
let push: ((t: Omit<Toast, "id">) => void) | undefined;
let toastSeq = 0;
export const toast = (text: string, bad = false) => push?.({ text, bad });
export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    push = (t) => {
      const id = ++toastSeq;
      setItems((x) => [...x, { ...t, id }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 5000);
    };
    return () => { push = undefined; };
  }, []);
  return <div className="toasts" role="status" aria-live="polite">{items.map((i) => <div key={i.id} className={`toast ${i.bad ? "bad" : ""}`}>{i.text}</div>)}</div>;
}

export function Confirm({ open, title, body, confirmLabel, danger, busy, onConfirm, onClose }: { open: boolean; title: string; body: string; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  const { t } = useT();
  return (
    <Dialog open={open} onClose={onClose} title={title} footer={<>
      <button type="button" className="btn secondary" onClick={onClose}>{t("common.cancel")}</button>
      <button type="button" className={`btn ${danger ? "danger" : ""}`} onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
    </>}>
      <p>{body}</p>
    </Dialog>
  );
}
