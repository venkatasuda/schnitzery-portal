import { messages } from "./messages";

export type Locale = "en" | "de";
export const LOCALES: Locale[] = ["en", "de"];
// English default: nothing changes until a user toggles. Flip to "de" once
// translation coverage is complete to make German the default.
export const DEFAULT_LOCALE: Locale = "en";

function resolve(tree: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => {
    if (node && typeof node === "object") return (node as Record<string, unknown>)[key];
    return undefined;
  }, tree);
}

// Look up a dotted key for a locale; fall back to English, then to the key itself.
// Optional {vars} replace {placeholders} in the string.
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  let val = resolve(messages[locale], key);
  if (typeof val !== "string") val = resolve(messages.en, key);
  if (typeof val !== "string") return key;
  let str = val;
  if (vars) for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, String(v));
  return str;
}