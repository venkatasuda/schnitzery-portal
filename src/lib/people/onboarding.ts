// New-hire onboarding checklist (docs/COMPETITIVE-ROADMAP.md #8). Pure: every step is
// derived from data the app already has, so nothing can be ticked without being true.
export const NEW_HIRE_DAYS = 90;

export type OnboardingInput = {
  contractType: string | null; contractHours: number | null; code: string | null;
  wage: number | null; approvedDocs: Set<string>; availability: boolean; firstShift: boolean; loggedIn: boolean;
};
export type OnboardingStep = { key: "contract" | "contractDoc" | "taxId" | "ifsg" | "pnr" | "wage" | "login" | "availability" | "firstShift"; done: boolean };

export function onboardingSteps(i: OnboardingInput): OnboardingStep[] {
  return [
    { key: "contract", done: !!i.contractType && i.contractHours != null },
    { key: "contractDoc", done: i.approvedDocs.has("contract") },
    { key: "taxId", done: i.approvedDocs.has("tax_id") },
    { key: "ifsg", done: i.approvedDocs.has("health_certificate") }, // Belehrung nach § 43 IfSG
    { key: "pnr", done: /^\d{1,5}$/.test((i.code || "").trim()) },   // DATEV Personalnummer
    { key: "wage", done: i.wage != null },
    { key: "login", done: i.loggedIn },
    { key: "availability", done: i.availability },
    { key: "firstShift", done: i.firstShift },
  ];
}
