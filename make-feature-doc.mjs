// Generates "Schnitzery-Portal-Features.docx" — a one-page, role-by-role
// feature summary to attach to the pitch email.
//
// RUN:
//   npm i docx        (once, if not already installed)
//   node make-feature-doc.mjs
//
// Produces Schnitzery-Portal-Features.docx in this folder.

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle,
} from "docx";
import { writeFileSync } from "fs";

const GOLD = "B8860B";
const DARK = "1A0E0E";

const heading = (text) =>
  new Paragraph({
    spacing: { before: 220, after: 90 },
    children: [new TextRun({ text, bold: true, size: 26, color: GOLD })],
  });

const sub = (text) =>
  new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, italics: true, size: 20, color: "555555" })],
  });

const bullet = (text) =>
  new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [new TextRun({ text, size: 20 })],
  });

const rule = () =>
  new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "DDDDDD", space: 1 } },
    spacing: { after: 120 },
    children: [],
  });

const section = (title, note, items) => [
  heading(title),
  ...(note ? [sub(note)] : []),
  ...items.map(bullet),
];

const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: "Schnitzery Portal", bold: true, size: 40, color: DARK })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new TextRun({ text: "Internal staff & operations platform — features by role", size: 22, color: "555555" })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [new TextRun({ text: "Live demo: https://schnitzery-portal.vercel.app", size: 18, color: GOLD })],
      }),
      rule(),

      ...section("Common to everyone", "Available in every role.", [
        "Secure login with automatic lockout after repeated failures",
        "Personal profile with photo",
        "Change password at any time",
        "In-app notifications",
        "English / German language toggle",
        "Light and dark mode",
      ]),

      ...section("Staff (Employee)", "The everyday view for kitchen and floor team.", [
        "Clock in / out by QR scan or 6-digit code, with optional GPS geofencing",
        "Works offline and syncs automatically when the connection returns",
        "My shifts and weekly schedule",
        "Submit weekly availability",
        "Request time off and shift swaps",
        "My hours worked versus contract, this month",
        "Upload and track my own documents (ID, visa, work permit, contract)",
        "Report an incident, with photo",
        "Temperature log — HACCP fridge / freezer checks",
        "Waste log — spoiled or dropped stock",
        "Food expiry and FIFO tracking",
        "Team announcements",
      ]),

      ...section("Manager (Branch)", "Everything Staff can do, plus running one branch day-to-day.", [
        "Live attendance dashboard — who is in, late, or on break",
        "Approve or reject leave and shift-swap requests",
        "Approve attendance corrections",
        "Build the weekly roster",
        "No-show tracking",
        "Manage staff — add, edit, deactivate",
        "Approve staff documents and monitor an expiring-documents dashboard",
        "Inventory counts and ordering",
        "Stock transfers between branches",
        "Enter daily sales and wages; live labour-cost percentage",
        "Monthly payroll summary and CSV export",
        "Branch analytics — hours, overtime, punctuality",
        "Working-time compliance checks (German ArbZG)",
        "Branch settings — QR required, GPS mode",
        "Kiosk / clock-display management",
        "Audit log of key actions",
      ]),

      ...section("Branch Owner", "All Manager features, plus ownership of one branch.", [
        "Full manager toolkit for the branch",
        "Branch-level analytics and administration",
      ]),

      ...section("Brand Owner / Admin (HQ)", "Cross-branch oversight of the whole business.", [
        "Organisation overview across all branches",
        "All-branches live view with per-branch drill-down",
        "Cross-branch analytics",
        "Cost and labour across the month",
        "Document-compliance across the whole team",
        "People management",
        "One-tap switch into any branch's full toolkit (HQ / Branch view)",
      ]),

      ...section("Kiosk (shared tablet)", "A device account, not a person.", [
        "Rotating clock-code display screen only — shows no personal data",
      ]),

      rule(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80 },
        children: [new TextRun({ text: "Built by Venky · Happy to walk through it in a brief meeting.", italics: true, size: 18, color: "777777" })],
      }),
    ],
  }],
});

const buf = await Packer.toBuffer(doc);
writeFileSync("Schnitzery-Portal-Features.docx", buf);
console.log("Wrote Schnitzery-Portal-Features.docx");
