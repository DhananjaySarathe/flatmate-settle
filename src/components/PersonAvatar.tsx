import { cn } from "@/lib/utils";

/** Hues picked to sit with the terracotta / sage palette; stable per name across pages. */
const HUES = [18, 84, 205, 340, 36, 165, 262, 52];

const hueFor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
};

const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + second).toUpperCase();
};

const SIZES = {
  xs: "size-5 text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
  xl: "size-14 text-lg",
} as const;

interface PersonAvatarProps {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export const PersonAvatar = ({ name, size = "md", className }: PersonAvatarProps) => {
  const hue = hueFor(name);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold leading-none",
        SIZES[size],
        className
      )}
      style={{ backgroundColor: `hsl(${hue} 42% 88%)`, color: `hsl(${hue} 45% 26%)` }}
    >
      {initials(name)}
    </span>
  );
};

/** Overlapping avatars for "split between" previews. */
export const AvatarStack = ({ names, max = 4, size = "xs" }: { names: string[]; max?: number; size?: "xs" | "sm" }) => {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <span className="inline-flex items-center">
      {shown.map((n, i) => (
        <PersonAvatar key={`${n}-${i}`} name={n} size={size} className={cn("ring-2 ring-card", i > 0 && "-ml-1.5")} />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            "-ml-1.5 inline-flex items-center justify-center rounded-full bg-secondary font-semibold text-muted-foreground ring-2 ring-card",
            size === "xs" ? "size-5 text-[9px]" : "size-6 text-[10px]"
          )}
        >
          +{extra}
        </span>
      )}
    </span>
  );
};
