// Generates "Schnitzery-Portal-Overview.docx" — the combined, business-friendly
// pitch + features document (same content as the print page, no "about me").
//
// RUN:
//   npm i docx        (once, if not already installed)
//   node make-overview-doc.mjs

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

// Lead-in bold benefit paragraph: "Bold thing. rest of sentence."
const benefit = (lead, rest) => new Paragraph({
  spacing: { after: 110 },
  children: [t(lead + " ", { size: 22, bold: true, color: DARK }), t(rest, { size: 22 })],
});

const roleTitle = (text) => new Paragraph({ spacing: { before: 140, after: 2 }, children: [t(text, { size: 24, bold: true, color: DARK })] });
const roleWho = (text) => new Paragraph({ spacing: { after: 60 }, children: [t(text, { size: 19, italics: true, color: MUTED })] });

// Four pillars as a shaded 4-column table.
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
      cell("01", "Time & Attendance"),
      cell("02", "Scheduling & Team"),
      cell("03", "Stock & Food Safety"),
      cell("04", "Oversight & Compliance"),
    ] })],
  });
}

const doc = new Document({
  sections: [{
    children: [
      p(t("Schnitzery Portal", { size: 44, bold: true, color: DARK }), { spacing: { after: 20 } }),
      p(t("One simple place to run the day.", { size: 26, bold: true, color: GOLD }), { spacing: { after: 60 } }),
      p([t("Today the essentials — who's working, who's off, which stock is low, whose documents are about to expire — are spread across memory, paper and chat messages. Schnitzery Portal brings all of it into one easy app that everyone opens on their phone, with each person seeing only what matters to their job.", { size: 22 })], { spacing: { after: 140 } }),

      pillars(),

      h2("Why it helps the business"),
      p(t("The outcomes that matter, in plain terms.", { size: 19, italics: true, color: MUTED }), { spacing: { after: 100 } }),
      benefit("Saves time every day.", "Staff clock in from their phone, and rotas, availability and time-off all live in one place instead of paper and WhatsApp."),
      benefit("Fewer payroll mistakes.", "Hours are recorded and totalled automatically, ready for payroll in one click — no more adding up timesheets by hand."),
      benefit("Always audit-ready.", "Fridge and freezer checks and food waste are logged and kept for you, and staff documents like visas and work permits are flagged before they expire."),
      benefit("Keeps costs in view.", "See staff cost against sales, and food cost, as the month unfolds — not weeks later when it's too late to act."),
      benefit("The whole business at a glance.", "Owners get one overview across every branch, and can look into any single location whenever they want the detail."),
      benefit("Comfortable for everyone.", "Works in both English and German, on any phone, with nothing to install."),

      h2("What each person gets"),
      p(t("Everyone sees a view built for their job — nothing more to learn than that.", { size: 19, italics: true, color: MUTED }), { spacing: { after: 60 } }),

      roleTitle("Employees"),
      roleWho("The everyday view for the kitchen and floor team."),
      bullet("Clock in and out from their phone in seconds"),
      bullet("See their shifts and weekly schedule"),
      bullet("Tell managers when they're available, and request time off or a shift swap"),
      bullet("See their own hours for the month"),
      bullet("Keep personal documents in one place, with reminders before they expire"),
      bullet("Report a problem or accident, with a photo"),
      bullet("Log fridge and freezer temperature checks and record any waste"),
      bullet("Read team announcements"),

      roleTitle("Managers"),
      roleWho("Everything the team has, plus the tools to run a branch day-to-day."),
      bullet("See who's working, who's late, and who's on break at a glance"),
      bullet("Approve time-off and shift-swap requests in a tap"),
      bullet("Build the weekly rota in minutes and spot no-shows"),
      bullet("Add and manage staff, and check their documents"),
      bullet("Track stock levels, orders, and move stock between branches"),
      bullet("Enter daily sales and see staff cost against them instantly"),
      bullet("Get a one-click monthly pay summary for payroll"),
      bullet("See branch performance — hours, overtime and punctuality — with built-in working-time checks"),

      roleTitle("Branch owners"),
      roleWho("Everything a manager has, for the branch they own — plus its performance insights."),

      roleTitle("Owners & Head office"),
      roleWho("The whole business in one place."),
      bullet("One overview across every branch, with the detail of any branch a tap away"),
      bullet("Compare performance and track cost and staffing month by month"),
      bullet("See document compliance across all staff, and manage people business-wide"),
      bullet("Step into any branch's own tools whenever needed"),

      h2("See it for yourself"),
      p([t("It's a working app, not a mock-up. Live demo: ", { size: 22 }), t("https://schnitzery-portal.vercel.app", { size: 22, bold: true, color: GOLD })]),
      p(t("A login can be provided for each role, so you can click through everything yourself.", { size: 20, color: MUTED })),
    ],
  }],
});

const buf = await Packer.toBuffer(doc);
writeFileSync("Schnitzery-Portal-Overview.docx", buf);
console.log("Wrote Schnitzery-Portal-Overview.docx");
