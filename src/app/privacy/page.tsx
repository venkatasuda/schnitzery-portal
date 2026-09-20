import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Schnitzery Portal",
  description: "How the Schnitzery staff portal handles personal data.",
};

// ⚠ TEMPLATE — not legal advice. Fill every [BRACKETED] placeholder with your
// real details and have a lawyer / DPO review before you rely on it. Written to
// the shape of GDPR (the app stores staff personal data in the EU).
export default function PrivacyPage() {
  return (
    <main style={wrap}>
      <h1 style={h1}>Privacy Policy</h1>
      <p style={muted}>Last updated: [DATE]</p>

      <p style={p}>
        This policy explains how <b>[LEGAL COMPANY NAME]</b> (“we”, “us”), operator of the
        Schnitzery staff portal (the “App”), collects and uses the personal data of its
        employees and authorised users. We are the data controller.
      </p>

      <Section title="1. Who to contact">
        <p style={p}>Controller: [LEGAL COMPANY NAME], [REGISTERED ADDRESS].</p>
        <p style={p}>Data protection contact: [NAME / EMAIL]. [If a DPO is appointed, name them here.]</p>
      </Section>

      <Section title="2. What data we collect">
        <ul style={ul}>
          <li>Identity &amp; contact: name, employee code, email, phone.</li>
          <li>Employment: role, branch, team, contract type and hours, wage (restricted).</li>
          <li>Time &amp; attendance: clock-in/out times, breaks, worked hours, lateness, and — when you clock in on site — approximate location used only to confirm you are at the branch.</li>
          <li>Operational records you create: incidents, temperature logs, waste, inventory counts, announcements, leave and swap requests.</li>
          <li>Documents you upload (e.g. ID, permits) and their expiry dates.</li>
          <li>Technical: device/browser info and error logs for security and reliability.</li>
        </ul>
      </Section>

      <Section title="3. Why we use it and our legal basis">
        <ul style={ul}>
          <li><b>Performance of your employment contract</b> — scheduling, attendance, payroll preparation, leave.</li>
          <li><b>Legal obligation</b> — working-time, tax and food-safety record keeping.</li>
          <li><b>Legitimate interests</b> — running the business securely and preventing fraud or misuse (balanced against your rights).</li>
        </ul>
      </Section>

      <Section title="4. Who we share it with (processors)">
        <p style={p}>
          We host the App and its data with service providers acting on our instructions:
          Supabase (database, authentication, file storage), Vercel (hosting), and Sentry
          (error monitoring). [Add any others — e.g. payroll provider.] We do not sell your data.
        </p>
      </Section>

      <Section title="5. Where it is stored">
        <p style={p}>Data is processed in the EU/EEA [confirm your Supabase/Vercel regions]. Where a provider processes data outside the EEA, appropriate safeguards (e.g. Standard Contractual Clauses) apply.</p>
      </Section>

      <Section title="6. How long we keep it">
        <p style={p}>We keep employment and attendance records for as long as you are employed and for [RETENTION PERIOD, e.g. the statutory period after employment ends]. Documents and logs are retained per legal requirements, then deleted or anonymised.</p>
      </Section>

      <Section title="7. Your rights">
        <p style={p}>
          You have the right to access, correct, delete, restrict, or object to the processing of
          your data, and to data portability. To exercise these, contact [EMAIL]. You may also
          lodge a complaint with your data protection authority ([e.g. your Landesdatenschutzbehörde]).
        </p>
      </Section>

      <Section title="8. Cookies">
        <p style={p}>
          The App uses only strictly necessary cookies to keep you signed in. Usage analytics, if
          enabled, are collected in an aggregated, cookieless way and do not identify you.
        </p>
      </Section>

      <p style={{ ...muted, marginTop: 28 }}>
        Questions? Contact [EMAIL]. · See also our <Link href="/terms" style={a}>Terms of Use</Link>.
      </p>
      <p style={{ marginTop: 20 }}><Link href="/login" style={a}>← Back to sign in</Link></p>
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
