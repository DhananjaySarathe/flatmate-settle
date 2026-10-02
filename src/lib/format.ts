// Display-only helpers. These never change how amounts are calculated.

export const formatINR = (amount: number, decimals = 2) =>
  `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

// Stable, readable avatar tint per person so the same name always gets the same colour.
const AVATAR_TINTS = [
  "bg-orange-100 text-orange-800",
  "bg-lime-100 text-lime-800",
  "bg-sky-100 text-sky-800",
  "bg-rose-100 text-rose-800",
  "bg-amber-100 text-amber-800",
  "bg-teal-100 text-teal-800",
  "bg-violet-100 text-violet-800",
  "bg-stone-200 text-stone-800",
];

export const avatarTint = (key: string) => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
};
