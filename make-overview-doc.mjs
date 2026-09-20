// Generates "Schnitzery-Portal-Overview.docx" — the combined, business-friendly
// pitch + features document (same content as the print page, no "about me").
// Every feature is one line: what it does AND why it matters.
//
// RUN (close the .docx in Word first, or it can't overwrite):
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

// One feature per line: "Feature — why it matters."
const bwhy = (feature, why) => new Paragraph({
  bullet: { level: 0 }, spacing: { after: 60 },
  children: [t(feature + " — ", { size: 21, bold: true, color: DARK }), t(why, { size: 21 })],
});

const benefit = (lead, rest) => new Paragraph({
  spacing: { after: 110 },
  children: [t(lead + " ", { size: 22, bold: true, color: DARK }), t(rest, { size: 22 })],
});

const roleTitle = (text) => new Paragraph({ spacing: { before: 160, after: 2 }, children: [t(text, { size: 24, bold: true, color: DARK })] });
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
      p(t("Everyone sees a view built for their job — nothing more to learn than that. Each line below is what it does and why it matters.", { size: 19, italics: true, color: MUTED }), { spacing: { after: 60 } }),

      roleTitle("Employees"),
      roleWho("The everyday view for the kitchen and floor team."),
      bwhy("Clock in / out from their phone", "worked hours are captured accurately and can't be faked, so pay is right and there's no paper punch card."),
      bwhy("See shifts and weekly schedule", "everyone knows when they're on, so fewer missed or misremembered shifts."),
      bwhy("Set availability, request time-off or a shift swap", "requests go straight to the manager, ending the WhatsApp back-and-forth."),
      bwhy("See their own hours for the month", "staff can check their pay looks right themselves, which cuts disputes."),
      bwhy("Personal documents with expiry reminders", "visas and work permits never lapse unnoticed — a real legal and right-to-work risk removed."),
      bwhy("Report a problem or accident with a photo", "incidents are logged with evidence for safety and insurance."),
      bwhy("Log fridge/freezer temperatures and waste", "the food-safety records the law requires, captured in seconds instead of a clipboard."),
      bwhy("Read team announcements", "one place for updates so nothing important gets lost in chat."),

      roleTitle("Managers"),
      roleWho("Everything the team has, plus the tools to run a branch day-to-day."),
      bwhy("Live view of who's working, late, or on break", "spot gaps and lateness the moment they happen, not at day's end."),
      bwhy("Approve time-off and shift swaps in a tap", "decisions in seconds, and the staff member is notified instantly."),
      bwhy("Build the weekly rota fast and spot no-shows", "less admin time and fewer uncovered shifts."),
      bwhy("Add and manage staff, check their documents", "onboarding and compliance handled in one place, not a folder."),
      bwhy("Track stock, orders, and transfers between branches", "avoid running out and avoid over-ordering — both cost money."),
      bwhy("Enter daily sales, see labour cost vs sales instantly", "control the biggest controllable cost while the month is still live."),
      bwhy("One-click monthly pay summary", "payroll is prepared without anyone adding up timesheets by hand."),
      bwhy("Branch performance with working-time checks", "stay on the right side of labour law on breaks, rest and overtime."),

      roleTitle("Branch owners"),
      roleWho("Everything a manager has for the branch they own — plus its performance insights, so they can see the health of their location at a glance."),

      roleTitle("Owners & Head office"),
      roleWho("The whole business in one place."),
      bwhy("One overview across every branch, drill into any", "spot the branch that needs attention fast, then see the detail."),
      bwhy("Compare performance, cost and staffing month by month", "decisions based on data, not gut feel."),
      bwhy("Document compliance across all staff", "audit-ready across the whole company, not one branch at a time."),
      bwhy("Waste by branch, ranked", "see which location wastes the most and act on it."),

      h2("Safe sign-in and access"),
      p(t("Security that protects staff data and the business — mostly invisible, always on.", { size: 19, italics: true, color: MUTED }), { spacing: { after: 60 } }),
      bwhy("Role-based access", "each person sees only what their job needs; it's enforced in the database, so one branch can never see another's data."),
      bwhy("Forced password change on first login", "the shared onboarding password is replaced by a private one immediately — no shared secret left lying around."),
      bwhy("Automatic lockout after repeated wrong tries", "stops password guessing cold; a manager can unlock in a tap."),
      bwhy("Manager password reset", "no company email needed — when someone forgets their password, a manager issues a one-time code on the spot."),
      bwhy("Automatic employee IDs per branch", "every hire gets a clean branch code (e.g. STG-001) with no duplicates as the business grows across cities."),
      bwhy("Instant notifications", "approvals, low stock and announcements reach the right person's phone straight away."),

      h2("See it for yourself"),
      p([t("It's a working app, not a mock-up. Live demo: ", { size: 22 }), t("https://schnitzery-portal.vercel.app", { size: 22, bold: true, color: GOLD })]),
      p(t("A login can be provided for each role, so you can click through everything yourself.", { size: 20, color: MUTED })),
    ],
  }],
});

const buf = await Packer.toBuffer(doc);
writeFileSync("Schnitzery-Portal-Overview.docx", buf);
console.log("Wrote Schnitzery-Portal-Overview.docx");
