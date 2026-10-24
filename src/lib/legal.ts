// ─────────────────────────────────────────────────────────────────────────────
// Company details for /privacy and /terms — the ONLY place to fill them in.
// Empty values show as "[…]" on the pages so a missing detail is visible.
// ⚠ Template, not legal advice: have a lawyer / data protection officer review
// the final text before relying on it.
// ─────────────────────────────────────────────────────────────────────────────
export const COMPANY = {
  legalName: "Schnitzery", // add the legal form later, e.g. "Schnitzery GmbH"
  address: "",          // e.g. "Musterstraße 1, 70173 Stuttgart"
  email: "",            // privacy / contact address
  dpo: "",              // data protection officer, if appointed (name + email), else leave empty
  authority: "",        // e.g. "Landesbeauftragter für Datenschutz und Informationsfreiheit Baden-Württemberg"
  updated: "",          // e.g. "2026-11-01"
  extraProcessors: "",  // e.g. "DATEV (payroll)" — leave empty if none
};

const v = (s: string) => s || "[…]";

type Block = { title: string; paras?: string[]; items?: string[] };
export type LegalDoc = { title: string; updated: string; intro: string; sections: Block[]; back: string; seeAlso: string };

export function privacyText(lang: "en" | "de"): LegalDoc {
  const c = COMPANY;
  const extra = c.extraProcessors ? `, ${c.extraProcessors}` : "";
  const processors = lang === "de"
    ? `Supabase (Datenbank, Anmeldung, Dateispeicher), Vercel (Hosting), Sentry (Fehlerüberwachung)${extra}`
    : `Supabase (database, authentication, file storage), Vercel (hosting), Sentry (error monitoring)${extra}`;
  if (lang === "de") return {
    title: "Datenschutzerklärung", updated: `Stand: ${v(c.updated)}`,
    intro: `Diese Erklärung beschreibt, wie ${v(c.legalName)} („wir“) als Betreiber des Schnitzery-Mitarbeiterportals („App“) personenbezogene Daten seiner Beschäftigten und berechtigten Nutzer verarbeitet. Verantwortlicher im Sinne der DSGVO sind wir.`,
    sections: [
      { title: "1. Verantwortlicher und Kontakt", paras: [`${v(c.legalName)}, ${v(c.address)}. E-Mail: ${v(c.email)}.`, c.dpo ? `Datenschutzbeauftragte/r: ${c.dpo}.` : "Ein/e Datenschutzbeauftragte/r ist nicht benannt."] },
      { title: "2. Welche Daten wir verarbeiten", items: [
        "Identität und Kontakt: Name, Personalnummer, E-Mail, Telefon.",
        "Beschäftigung: Rolle, Filiale, Team, Vertragsart und -stunden, Lohn (eingeschränkter Zugriff).",
        "Arbeitszeit: Ein-/Ausstempelzeiten, Pausen, gearbeitete Stunden, Verspätungen und — beim Einstempeln vor Ort — ein ungefährer Standort, nur um die Anwesenheit in der Filiale zu bestätigen.",
        "Betriebliche Einträge: Vorfälle, Temperaturprotokolle, Abfall, Inventurzählungen, Mitteilungen, Urlaubs- und Tauschanträge.",
        "Hochgeladene Dokumente (z. B. Ausweis, Arbeitserlaubnis) und deren Ablaufdaten.",
        "Technisch: Geräte-/Browserangaben und Fehlerprotokolle für Sicherheit und Stabilität.",
      ] },
      { title: "3. Zwecke und Rechtsgrundlagen", items: [
        "Durchführung des Arbeitsverhältnisses (Art. 6 Abs. 1 lit. b, Art. 88 DSGVO): Dienstplanung, Zeiterfassung, Vorbereitung der Lohnabrechnung, Urlaub.",
        "Rechtliche Pflichten (Art. 6 Abs. 1 lit. c DSGVO): Arbeitszeit-, Steuer- und Lebensmittelhygiene-Aufzeichnungen.",
        "Berechtigte Interessen (Art. 6 Abs. 1 lit. f DSGVO): sicherer Betrieb sowie Schutz vor Betrug und Missbrauch, abgewogen mit Ihren Rechten.",
      ] },
      { title: "4. Empfänger (Auftragsverarbeiter)", paras: [`Wir betreiben die App mit Dienstleistern, die nur nach unserer Weisung handeln: ${processors}. Wir verkaufen keine Daten.`] },
      { title: "5. Speicherort", paras: ["Die Daten werden in der EU/im EWR verarbeitet. Soweit ein Dienstleister Daten außerhalb des EWR verarbeitet, gelten geeignete Garantien (z. B. Standardvertragsklauseln)."] },
      { title: "6. Speicherdauer", paras: ["Beschäftigungs- und Zeiterfassungsdaten speichern wir für die Dauer des Arbeitsverhältnisses und danach nur so lange, wie gesetzliche Aufbewahrungsfristen es verlangen (z. B. Arbeitszeitnachweise mindestens 2 Jahre, steuerlich relevante Unterlagen 6 bzw. 10 Jahre). Danach werden sie gelöscht oder anonymisiert."] },
      { title: "7. Ihre Rechte", paras: [`Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Widerspruch und Datenübertragbarkeit. Wenden Sie sich dazu an ${v(c.email)}. Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren (${v(c.authority)}).`] },
      { title: "8. Cookies", paras: ["Die App verwendet nur technisch notwendige Cookies, damit Sie angemeldet bleiben, sowie ein Cookie für die gewählte Sprache. Nutzungsstatistiken werden, falls aktiviert, ohne Cookies und nicht personenbezogen erhoben."] },
    ],
    back: "← Zurück zur Anmeldung", seeAlso: `Fragen? ${v(c.email)} · Siehe auch:`,
  };
  return {
    title: "Privacy Policy", updated: `Last updated: ${v(c.updated)}`,
    intro: `This policy explains how ${v(c.legalName)} (“we”), operator of the Schnitzery staff portal (the “App”), processes the personal data of its employees and authorised users. We are the controller under the GDPR.`,
    sections: [
      { title: "1. Controller and contact", paras: [`${v(c.legalName)}, ${v(c.address)}. Email: ${v(c.email)}.`, c.dpo ? `Data protection officer: ${c.dpo}.` : "No data protection officer has been appointed."] },
      { title: "2. What data we process", items: [
        "Identity & contact: name, employee code, email, phone.",
        "Employment: role, branch, team, contract type and hours, wage (restricted access).",
        "Working time: clock-in/out times, breaks, worked hours, lateness and — when you clock in on site — approximate location, used only to confirm you are at the branch.",
        "Operational records: incidents, temperature logs, waste, stock counts, announcements, leave and swap requests.",
        "Documents you upload (e.g. ID, work permit) and their expiry dates.",
        "Technical: device/browser details and error logs for security and reliability.",
      ] },
      { title: "3. Purposes and legal basis", items: [
        "Performing the employment relationship (Art. 6(1)(b), Art. 88 GDPR): scheduling, time recording, payroll preparation, leave.",
        "Legal obligations (Art. 6(1)(c) GDPR): working-time, tax and food-safety records.",
        "Legitimate interests (Art. 6(1)(f) GDPR): secure operation and protection against fraud or misuse, balanced against your rights.",
      ] },
      { title: "4. Recipients (processors)", paras: [`We run the App with service providers acting only on our instructions: ${processors}. We do not sell data.`] },
      { title: "5. Where it is stored", paras: ["Data is processed in the EU/EEA. Where a provider processes data outside the EEA, appropriate safeguards (e.g. Standard Contractual Clauses) apply."] },
      { title: "6. How long we keep it", paras: ["Employment and working-time data is kept for the duration of employment and afterwards only as long as statutory retention periods require (e.g. working-time records at least 2 years, tax-relevant records 6 or 10 years). It is then deleted or anonymised."] },
      { title: "7. Your rights", paras: [`You have the right of access, rectification, erasure, restriction, objection and data portability. Contact ${v(c.email)}. You may also complain to a data protection authority (${v(c.authority)}).`] },
      { title: "8. Cookies", paras: ["The App uses only strictly necessary cookies to keep you signed in, plus one cookie for your chosen language. Usage statistics, if enabled, are collected without cookies and do not identify you."] },
    ],
    back: "← Back to sign in", seeAlso: `Questions? ${v(c.email)} · See also:`,
  };
}

export function termsText(lang: "en" | "de"): LegalDoc {
  const c = COMPANY;
  if (lang === "de") return {
    title: "Nutzungsbedingungen", updated: `Stand: ${v(c.updated)}`,
    intro: `Das Schnitzery-Mitarbeiterportal („App“) wird von ${v(c.legalName)} für Beschäftigte und berechtigte Personen bereitgestellt. Mit der Anmeldung akzeptieren Sie diese Bedingungen.`,
    sections: [
      { title: "1. Berechtigte Nutzung", paras: ["Der Zugang dient ausschließlich Ihren dienstlichen Aufgaben. Ihr Login ist persönlich — geben Sie Ihr Passwort nicht weiter und lassen Sie niemanden Ihr Konto nutzen."] },
      { title: "2. Zulässige Nutzung", items: [
        "Geben Sie zutreffende Daten ein (Arbeitszeit, Temperaturen, Vorfälle, Bestand usw.).",
        "Fälschen Sie keine Einträge, greifen Sie nicht auf Daten außerhalb Ihrer Rolle oder Filiale zu und testen Sie nicht die Sicherheit der App.",
        "Laden Sie keine rechtswidrigen Inhalte und ohne dienstlichen Grund keine personenbezogenen Daten anderer hoch.",
      ] },
      { title: "3. Konten und Zugang", paras: ["Führungskräfte können Konten anlegen, sperren oder entfernen. Wiederholte Fehlanmeldungen sperren ein Konto, bis eine Führungskraft es entsperrt. Der Zugang endet mit dem Arbeitsverhältnis bzw. der Berechtigung."] },
      { title: "4. Daten", paras: [`Ihre personenbezogenen Daten werden wie in der Datenschutzerklärung beschrieben verarbeitet. Betriebliche Einträge gehören ${v(c.legalName)} und werden für geschäftliche und gesetzliche Zwecke aufbewahrt.`] },
      { title: "5. Verfügbarkeit und Änderungen", paras: ["Wir können Funktionen und diese Bedingungen ändern; wesentliche Änderungen teilen wir in der App mit. Wir streben eine hohe Verfügbarkeit an, können einen unterbrechungsfreien Betrieb aber nicht garantieren."] },
      { title: "6. Kontakt", paras: [`Fragen zu diesen Bedingungen: ${v(c.email)}.`] },
    ],
    back: "← Zurück zur Anmeldung", seeAlso: "Siehe auch:",
  };
  return {
    title: "Terms of Use", updated: `Last updated: ${v(c.updated)}`,
    intro: `The Schnitzery staff portal (the “App”) is provided by ${v(c.legalName)} for its employees and other authorised personnel. By signing in, you accept these terms.`,
    sections: [
      { title: "1. Authorised use", paras: ["Access is for your work duties only. Your login is personal — do not share your password or let anyone else use your account."] },
      { title: "2. Acceptable use", items: [
        "Enter accurate information (attendance, temperatures, incidents, stock, etc.).",
        "Do not falsify records, access data outside your role or branch, or probe the App’s security.",
        "Do not upload unlawful content or anyone else’s personal data without a work reason.",
      ] },
      { title: "3. Accounts & access", paras: ["Managers may create, suspend or remove accounts. Repeated failed sign-ins lock an account until a manager unlocks it. Access ends when your employment or authorisation ends."] },
      { title: "4. Data", paras: [`Your personal data is handled as described in the Privacy Policy. Operational records belong to ${v(c.legalName)} and are kept for business and legal purposes.`] },
      { title: "5. Availability & changes", paras: ["We may change features and these terms; significant changes are announced in the App. We aim for high availability but cannot guarantee uninterrupted service."] },
      { title: "6. Contact", paras: [`Questions about these terms: ${v(c.email)}.`] },
    ],
    back: "← Back to sign in", seeAlso: "See also:",
  };
}
