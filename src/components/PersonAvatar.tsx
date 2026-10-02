import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

// Muted, warm-compatible pairs (background / ink). Ink clears 4.5:1 on its tint.
const TONES = [
  { bg: "hsl(18 70% 90%)", fg: "hsl(18 70% 30%)" },
  { bg: "hsl(84 40% 87%)", fg: "hsl(84 55% 24%)" },
  { bg: "hsl(40 80% 86%)", fg: "hsl(30 75% 28%)" },
  { bg: "hsl(205 45% 88%)", fg: "hsl(210 50% 30%)" },
  { bg: "hsl(330 35% 89%)", fg: "hsl(330 40% 32%)" },
  { bg: "hsl(170 35% 85%)", fg: "hsl(175 50% 23%)" },
  { bg: "hsl(260 30% 90%)", fg: "hsl(260 30% 36%)" },
];

const hash = (value: string) => {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
};

interface PersonAvatarProps {
  name: string;
  /** Stable key for the colour; defaults to the name. */
  seed?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export const PersonAvatar = ({ name, seed, size = "sm", className }: PersonAvatarProps) => {
  const tone = TONES[hash(seed ?? name) % TONES.length];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold",
        SIZES[size],
        className
      )}
      style={{ backgroundColor: tone.bg, color: tone.fg }}
    >
      {initials(name)}
    </span>
  );
};
