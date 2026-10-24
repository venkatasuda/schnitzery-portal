"use client";
import { useEffect, useRef } from "react";

export default function NativeDialog({ title, busy=false, wide=false, unsaved=false, onClose, children }: {
  title: string; busy?: boolean; wide?: boolean; unsaved?: boolean; onClose: () => void; children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger=useRef<HTMLElement|null>(null);
  useEffect(() => {
    trigger.current ??= document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return()=>{if(trigger.current?.isConnected)trigger.current.focus();};
  }, []);
  useEffect(()=>{
    if(!unsaved)return;
    const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    window.addEventListener("beforeunload",prevent);
    return()=>window.removeEventListener("beforeunload",prevent);
  },[unsaved]);
  return <dialog ref={dialog} className={`workspace-dialog${wide?" workspace-dialog-wide":""}`} aria-label={title}
    onCancel={event => { if (busy) event.preventDefault(); else onClose(); }} onClose={onClose}>
    {children}
  </dialog>;
}
