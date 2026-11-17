"use client";
// Where the proxy sends plain staff who open a manager or shift-leader page directly.
import Link from "next/link";
import { useLang } from "@/components/LanguageProvider";
import { EmptyState } from "@/components/ui";

export default function NoAccessPage() {
  const { locale } = useLang();
  const de = locale === "de";
  return <div className="page-narrow page-top-gap">
    <EmptyState title={de ? "Kein Zugriff" : "No access"} action={<Link className="btn-gold" href="/">{de ? "Zur Startseite" : "Go to start page"}</Link>}>
      {de ? "Diese Seite ist für Schichtleitung und Leitung." : "This page is for shift leaders and managers."}
    </EmptyState>
  </div>;
}
