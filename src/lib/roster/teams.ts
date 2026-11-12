// Which teams a person can work in, in order of preference. Pure.
// Skill 1 is the person's Team; Skill 2, 3, … are team names stored (in order) in users.skills.
// Only the automatic planner, the swap list and cover offers use this — a manager can always place anyone by hand.
import { TEAMS } from "@/lib/queries/schedule-constants";

const ALIAS: Record<string, string> = {
  preparation: "Preparation", prep: "Preparation", vorbereitung: "Preparation",
  kitchen: "Kitchen", "küche": "Kitchen", kueche: "Kitchen",
  cashier: "Cashier", kasse: "Cashier", kassierer: "Cashier",
  dishwashing: "Dishwashing", dishwasher: "Dishwashing", "spüler": "Dishwashing", spueler: "Dishwashing", "spülküche": "Dishwashing", spuelkueche: "Dishwashing",
  manager: "Manager",
};
// Team a skill entry stands for ("Kasse" → "Cashier"), or null for any other skill ("Barista").
export const skillTeam = (skill: string): string | null => ALIAS[(skill || "").trim().toLowerCase()] ?? null;

// Main team first, then the team skills in the order they are stored. "Allrounder" = every floor team.
export function workTeams(team: string | null | undefined, skills: string[] | null | undefined): string[] {
  const out: string[] = team ? [team] : [];
  for (const s of skills || []) {
    const add = /^all-?rounder$/i.test((s || "").trim()) ? TEAMS.filter((t) => t !== "Manager") : [skillTeam(s)];
    for (const t of add) if (t && !out.includes(t)) out.push(t);
  }
  return out;
}
