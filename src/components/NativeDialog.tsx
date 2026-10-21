"use client";
import { useEffect, useRef } from "react";

export default function NativeDialog({ title, busy=false, onClose, children }: {
  title: string; busy?: boolean; onClose: () => void; children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger=useRef<HTMLElement|null>(null);
  useEffect(() => {
    trigger.current ??= document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return()=>{if(trigger.current?.isConnected)trigger.current.focus();};
  }, []);
  return <dialog ref={dialog} className="workspace-dialog" aria-label={title}
    onCancel={event => { if (busy) event.preventDefault(); else onClose(); }} onClose={onClose}>
    {children}
  </dialog>;
}
