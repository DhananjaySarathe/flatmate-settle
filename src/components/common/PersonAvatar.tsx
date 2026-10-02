import { cn } from "@/lib/utils";

// Warm, low-chroma tints that sit well on the cream background. Text colours
// keep at least 4.5:1 contrast against their tint.
const TINTS = [
  "bg-[hsl(18_70%_92%)] text-[hsl(18_70%_30%)]",
  "bg-[hsl(84_35%_88%)] text-[hsl(84_55%_22%)]",
  "bg-[hsl(38_80%_88%)] text-[hsl(30_75%_28%)]",
  "bg-[hsl(200_35%_89%)] text-[hsl(205_55%_28%)]",
  "bg-[hsl(330_35%_91%)] text-[hsl(335_45%_32%)]",
  "bg-[hsl(265_25%_91%)] text-[hsl(265_35%_35%)]",
  "bg-[hsl(170_30%_88%)] text-[hsl(172_50%_22%)]",
];

const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
};

const tintFor = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
};

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

interface PersonAvatarProps {
  name: string;
  /** Stable key for the colour; defaults to the name. */
  seed?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export const PersonAvatar = ({ name, seed, size = "sm", className }: PersonAvatarProps) => (
  <span
    aria-hidden="true"
    className={cn(
      "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-tight",
      SIZES[size],
      tintFor(seed ?? name),
      className
    )}
  >
    {initialsOf(name)}
  </span>
);
