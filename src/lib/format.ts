// Display helpers shared across pages. These only format numbers for the UI —
// all money maths lives in `@/lib/settlement`.

const inr = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const inrFixed = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,234.5 → "₹1,234.50"; whole numbers drop the decimals ("₹1,200"). */
export const formatMoney = (n: number) => {
  const abs = Math.abs(n);
  const body = Number.isInteger(Math.round(abs * 100) / 100)
    ? inr.format(abs)
    : inrFixed.format(abs);
  return `${n < 0 ? "-" : ""}₹${body}`;
};

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

// Stable, muted hues so each person keeps the same colour everywhere.
const AVATAR_HUES = [18, 84, 200, 265, 330, 40, 160, 0];

export const avatarHue = (key: string) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
};

/** Expense dates are stored as plain `yyyy-MM-dd`; parse them as local dates. */
export const parseDay = (d: string) => {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
};

/** Best-effort message from whatever a Supabase call or `throw` produced. */
export const errorMessage = (error: unknown, fallback = "Unknown error") => {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message || fallback;
  }
  return fallback;
};
