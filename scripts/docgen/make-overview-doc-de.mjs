// Generates "Schnitzery-Portal-Overview-DE.docx" — the German version of the
// business overview (same content, natural German).
//
// RUN:
//   npm i docx        (once, if not already installed)
//   node make-overview-doc-de.mjs

import {
  Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, Table, TableRow,
  TableCell, WidthType, ShadingType,
} from "docx";
import { writeFileSync } from "fs";

const GOLD = "B8860B";
const DARK = "1A0E0E";
const MUTED = "6B6560";

const p = (runs, opts = {}) => new Paragraph({ spacing: { after: 100, ...(opts.spacing || {}) }, alignment: opts.align, children: Array.isArray(runs) ? runs : [runs] });
const t = (text, o = {}) => new TextRun({ text, size: o.size ?? 22, bold: o.bold, italics: o.italics, color: o.color });

const h2 = (text) => new Paragraph({
  spacing: { before: 260, after: 40 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "E6E0D6", space: 2 } },
  children: [t(text, { size: 28, bold: true, color: GOLD })],
});

const bullet = (text) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 50 }, children: [t(text, { size: 21 })] });
const benefit = (lead, rest) => new Paragraph({ spacing: { after: 110 }, children: [t(lead + " ", { size: 22, bold: true, color: DARK }), t(rest, { size: 22 })] });
const roleTitle = (text) => new Paragraph({ spacing: { before: 140, after: 2 }, children: [t(text, { size: 24, bold: true, color: DARK })] });
const roleWho = (text) => new Paragraph({ spacing: { after: 60 }, children: [t(text, { size: 19, italics: true, color: MUTED })] });

function pillars() {
  const cell = (n, title) => new TableCell({
    width: { size: 2340, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: "FAF6EE" },
    margins: { top: 100, bottom: 100, left: 100, right: 100 },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [t(n, { size: 16, bold: true, color: GOLD })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [t(title, { size: 19, bold: true, color: DARK })] }),
    ],
  });
  return new Table({
    columnWidths: [2340, 2340, 2340, 2340],
    width: { size: 9360, type: WidthType.DXA },
    rows: [new TableRow({ children: [
      cell("01", "Zeiterfassung & Anwesenheit"),
      cell("02", "Dienstplanung & Team"),
      cell("03", "Bestand & Lebensmittelsicherheit"),
      cell("04", "Überblick & Compliance"),
    ] })],
  });
}

const doc = new Document({
  sections: [{
    children: [
      p(t("Schnitzery Portal", { size: 44, bold: true, color: DARK }), { spacing: { after: 20 } }),
      p(t("Alles für den Arbeitsalltag an einem Ort.", { size: 26, bold: true, color: GOLD }), { spacing: { after: 60 } }),
      p([t("Heute sind die wichtigsten Informationen — wer arbeitet, wer frei hat, welche Ware knapp wird, wessen Dokumente bald ablaufen — über Gedächtnis, Papier und Chat-Nachrichten verstreut. Schnitzery Portal bündelt alles in einer einfachen App, die jeder auf dem Handy öffnet — und jede Person sieht nur das, was für ihre Aufgabe wichtig ist.", { size: 22 })], { spacing: { after: 140 } }),

      pillars(),

      h2("Warum es dem Unternehmen hilft"),
      p(t("Die Ergebnisse, die zählen — einfach erklärt.", { size: 19, italics: true, color: MUTED }), { spacing: { after: 100 } }),
      benefit("Spart täglich Zeit.", "Mitarbeiter stempeln per Handy ein, und Dienstpläne, Verfügbarkeiten und Urlaubsanträge liegen an einem Ort — statt auf Papier und in WhatsApp."),
      benefit("Weniger Fehler bei der Lohnabrechnung.", "Arbeitsstunden werden automatisch erfasst und summiert — mit einem Klick bereit für die Lohnabrechnung, kein manuelles Zusammenrechnen mehr."),
      benefit("Jederzeit prüfungsbereit.", "Kühl- und Gefrierkontrollen sowie Lebensmittelabfälle werden automatisch protokolliert und aufbewahrt, und Mitarbeiterdokumente wie Visa und Arbeitserlaubnisse werden rechtzeitig vor Ablauf angezeigt."),
      benefit("Kosten immer im Blick.", "Personalkosten im Verhältnis zum Umsatz und den Wareneinsatz sehen Sie laufend im Monat — nicht erst Wochen später, wenn es zu spät ist."),
      benefit("Das ganze Unternehmen auf einen Blick.", "Inhaber erhalten einen Überblick über alle Filialen und können bei Bedarf in jede einzelne hineinschauen."),
      benefit("Für alle bequem.", "Funktioniert auf Deutsch und Englisch, auf jedem Handy, ohne Installation."),

      h2("Was jede Person bekommt"),
      p(t("Jeder sieht eine auf seine Aufgabe zugeschnittene Ansicht — mehr muss man nicht lernen.", { size: 19, italics: true, color: MUTED }), { spacing: { after: 60 } }),

      roleTitle("Mitarbeiter"),
      roleWho("Die tägliche Ansicht für das Küchen- und Serviceteam."),
      bullet("Per Handy in Sekunden ein- und ausstempeln"),
      bullet("Eigene Schichten und den Wochenplan sehen"),
      bullet("Verfügbarkeit mitteilen und Urlaub oder Schichttausch beantragen"),
      bullet("Die eigenen Stunden im Monat sehen"),
      bullet("Persönliche Dokumente an einem Ort ablegen, mit Erinnerung vor Ablauf"),
      bullet("Ein Problem oder einen Vorfall melden, mit Foto"),
      bullet("Kühl- und Gefriertemperaturen erfassen und Abfall dokumentieren"),
      bullet("Team-Ankündigungen lesen"),

      roleTitle("Manager"),
      roleWho("Alles, was das Team hat, plus die Werkzeuge zum Führen einer Filiale."),
      bullet("Auf einen Blick sehen, wer arbeitet, zu spät oder in der Pause ist"),
      bullet("Urlaubs- und Tauschanträge mit einem Tipp genehmigen"),
      bullet("Den Wochenplan in Minuten erstellen und Nichterscheinen erkennen"),
      bullet("Mitarbeiter anlegen und verwalten und deren Dokumente prüfen"),
      bullet("Bestände und Bestellungen verfolgen und Ware zwischen Filialen umbuchen"),
      bullet("Tagesumsatz eingeben und Personalkosten sofort im Verhältnis dazu sehen"),
      bullet("Monatliche Lohnübersicht mit einem Klick"),
      bullet("Filialkennzahlen sehen — Stunden, Überstunden, Pünktlichkeit — mit integrierter Arbeitszeitprüfung"),

      roleTitle("Filialinhaber"),
      roleWho("Alles, was ein Manager hat, für die eigene Filiale — plus deren Auswertungen."),

      roleTitle("Inhaber & Zentrale"),
      roleWho("Das ganze Unternehmen an einem Ort."),
      bullet("Ein Überblick über alle Filialen, Details jeder Filiale nur einen Tipp entfernt"),
      bullet("Leistung vergleichen und Kosten und Personal Monat für Monat verfolgen"),
      bullet("Dokumenten-Compliance über alle Mitarbeiter sehen und Personal unternehmensweit verwalten"),
      bullet("Bei Bedarf in die Werkzeuge jeder Filiale wechseln"),

      h2("Überzeugen Sie sich selbst"),
      p([t("Es ist eine funktionierende App, kein Entwurf. Live-Demo: ", { size: 22 }), t("https://schnitzery-portal.vercel.app", { size: 22, bold: true, color: GOLD })]),
      p(t("Für jede Rolle kann ein Zugang bereitgestellt werden, sodass Sie alles selbst ausprobieren können.", { size: 20, color: MUTED })),
    ],
  }],
});

const buf = await Packer.toBuffer(doc);
writeFileSync("Schnitzery-Portal-Overview-DE.docx", buf);
console.log("Wrote Schnitzery-Portal-Overview-DE.docx");
