export function validChatMessages(value: unknown): value is { role: "user" | "assistant"; content: string }[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 20 &&
    value.every(m => m && (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" && m.content.trim().length > 0 && m.content.length <= 8000) &&
    value.reduce((sum, m) => sum + m.content.length, 0) <= 32000 && value[value.length - 1].role === "user";
}

export function validateToolInput(name: string, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid tool input.");
  const value = input as Record<string, unknown>;
  if (name === "get_stock_levels") {
    if (Object.keys(value).some(k => k !== "belowReorderOnly") ||
      (value.belowReorderOnly !== undefined && typeof value.belowReorderOnly !== "boolean")) throw new Error("Invalid stock filter.");
  } else {
    const key = name === "get_expiry_risk" ? "withinDays" : name === "get_waste_trend" ? "days" : null;
    if (!key || Object.keys(value).some(k => k !== key) || !Number.isInteger(value[key]) ||
      Number(value[key]) < 1 || Number(value[key]) > 90) throw new Error("Invalid tool period.");
  }
}
