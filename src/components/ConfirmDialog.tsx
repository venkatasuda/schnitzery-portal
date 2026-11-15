"use client";
// In-app confirmation instead of the browser's confirm() popup.
//   if (!(await askConfirm({ message: "Publish this week?", confirmLabel: "Publish" }))) return;
// One host (<ConfirmHost/>, mounted in the app layout) shows one dialog at a time; Escape or Cancel = false.
import { useEffect, useState } from "react";
import NativeDialog from "@/components/NativeDialog";
import { useLang } from "@/components/LanguageProvider";

type Ask = { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type Pending = Ask & { resolve: (ok: boolean) => void };
let show: ((p: Pending) => void) | null = null;

export function askConfirm(ask: Ask): Promise<boolean> {
  // No host mounted (should not happen inside the app): fall back to the browser so the action stays guarded.
  if (!show) return Promise.resolve(typeof window !== "undefined" && window.confirm(ask.message));
  return new Promise((resolve) => show!({ ...ask, resolve }));
}

export default function ConfirmHost() {
  const { locale } = useLang();
  const [pending, setPending] = useState<Pending | null>(null);
  useEffect(() => { show = setPending; return () => { show = null; }; }, []);
  if (!pending) return null;
  const done = (ok: boolean) => { pending.resolve(ok); setPending(null); };
  const de = locale === "de";
  return (
    <NativeDialog title={pending.title ?? (de ? "Bitte bestätigen" : "Please confirm")} onClose={() => done(false)}>
      <p className="confirm-message">{pending.message}</p>
      <div className="row-actions confirm-actions">
        <button type="button" className="btn-secondary" onClick={() => done(false)}>{pending.cancelLabel ?? (de ? "Abbrechen" : "Cancel")}</button>
        <button type="button" className={pending.danger ? "btn-danger" : "btn-gold"} autoFocus onClick={() => done(true)}>{pending.confirmLabel ?? (de ? "Bestätigen" : "Confirm")}</button>
      </div>
    </NativeDialog>
  );
}
