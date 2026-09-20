import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use · Schnitzery Portal",
  description: "Terms governing use of the Schnitzery staff portal.",
};

// ⚠ TEMPLATE — not legal advice. Fill every [BRACKETED] placeholder and have a
// lawyer review. This is an internal tool for authorised staff, so the terms are
// short and use-focused rather than a consumer EULA.
export default function TermsPage() {
  return (
    <main style={wrap}>
      <h1 style={h1}>Terms of Use</h1>
      <p style={muted}>Last updated: [DATE]</p>

      <p style={p}>
        The Schnitzery staff portal (the “App”) is provided by <b>[LEGAL COMPANY NAME]</b> for use
        by its employees and other authorised personnel. By signing in, you agree to these terms.
      </p>

      <Section title="1. Authorised use">
        <p style={p}>Access is granted for your work duties only. Your login is personal — do not share your password or let anyone else use your account. You are responsible for activity under your login.</p>
      </Section>

      <Section title="2. Acceptable use">
        <ul style={ul}>
          <li>Enter accurate information (attendance, temperatures, incidents, stock, etc.).</li>
          <li>Do not falsify records, attempt to access data outside your role or branch, or probe the App’s security.</li>
          <li>Do not upload unlawful content or anyone else’s personal data without a work reason.</li>
        </ul>
      </Section>

      <Section title="3. Accounts &amp; access">
        <p style={p}>Managers may create, suspend, or remove accounts. Repeated failed sign-ins lock an account until a manager unlocks it. Access ends when your employment or authorisation ends.</p>
      </Section>

      <Section title="4. Data">
        <p style={p}>Your personal data is handled as described in our <Link href="/privacy" style={a}>Privacy Policy</Link>. Records you enter belong to [LEGAL COMPANY NAME] and are kept for business and legal purposes.</p>
      </Section>

      <Section title="5. Availability &amp; changes">
        <p style={p}>The App is provided “as is”. We may change, suspend, or update features and these terms at any time; continued use after a change means you accept it. We aim for high availability but do not guarantee uninterrupted service.</p>
      </Section>

      <Section title="6. Contact">
        <p style={p}>Questions about these terms: [NAME / EMAIL].</p>
      </Section>

      <p style={{ marginTop: 24 }}><Link href="/login" style={a}>← Back to sign in</Link></p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <h2 style={h2}>{title}</h2>
      {children}
    </section>
  );
}

const wrap: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px", color: "var(--white, #fff)", lineHeight: 1.6 };
const h1: React.CSSProperties = { fontFamily: "var(--font-display, Georgia, serif)", fontSize: 30, color: "var(--gold-ink, #d4a847)", margin: 0 };
const h2: React.CSSProperties = { fontSize: 17, color: "var(--white, #fff)", marginBottom: 6 };
const p: React.CSSProperties = { fontSize: 14, color: "var(--gray-light, #aaa)", margin: "6px 0" };
const ul: React.CSSProperties = { fontSize: 14, color: "var(--gray-light, #aaa)", margin: "6px 0", paddingLeft: 20 };
const muted: React.CSSProperties = { fontSize: 12, color: "var(--gray, #888)" };
const a: React.CSSProperties = { color: "var(--gold, #d4a847)", textDecoration: "none" };
