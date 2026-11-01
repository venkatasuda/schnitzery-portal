// Baden-Württemberg public holidays (all branches are in Stuttgart).
// ponytail: one state hard-coded; add a branch → state setting when a branch opens elsewhere.
// School holidays are set yearly by the state, not computable — add a table when wanted.

// Easter Sunday (Meeus/Jones/Butcher Gregorian algorithm) → drives the movable holidays.
function easter(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=Mar, 4=Apr
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

// Public holidays for a year, as YYYY-MM-DD strings.
export function bwHolidays(year: number): string[] {
  const e = easter(year);
  const off = (n: number) => { const d = new Date(e); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  return [
    `${year}-01-01`, // Neujahr
    `${year}-01-06`, // Heilige Drei Könige
    off(-2),         // Karfreitag
    off(1),          // Ostermontag
    `${year}-05-01`, // Tag der Arbeit
    off(39),         // Christi Himmelfahrt
    off(50),         // Pfingstmontag
    off(60),         // Fronleichnam
    `${year}-10-03`, // Tag der Deutschen Einheit
    `${year}-11-01`, // Allerheiligen
    `${year}-12-25`, // 1. Weihnachtstag
    `${year}-12-26`, // 2. Weihnachtstag
  ];
}

export const isBwHoliday = (date: string) => bwHolidays(Number(date.slice(0, 4))).includes(date.slice(0, 10));
