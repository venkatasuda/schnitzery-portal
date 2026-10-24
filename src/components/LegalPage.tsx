import Link from "next/link";
import type { LegalDoc } from "@/lib/legal";

// Shared layout for /privacy and /terms (public, outside the app shell).
export default function LegalPage({ doc, lang, other }: { doc: LegalDoc; lang: "en" | "de"; other: { href: string; label: string } }) {
  return (
    <main className="legal" lang={lang}>
      <h1>{doc.title}</h1>
      <p className="legal-muted">{doc.updated}</p>
      <p>{doc.intro}</p>
      {doc.sections.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          {s.paras?.map((p, i) => <p key={i}>{p}</p>)}
          {s.items && <ul>{s.items.map((it, i) => <li key={i}>{it}</li>)}</ul>}
        </section>
      ))}
      <p className="legal-muted mt-5">{doc.seeAlso} <Link href={other.href}>{other.label}</Link></p>
      <p className="mt-5"><Link href="/login">{doc.back}</Link></p>
    </main>
  );
}
