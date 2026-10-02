import { cn } from "@/lib/utils";
import { avatarHue, initials } from "@/lib/format";

interface PersonAvatarProps {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export const PersonAvatar = ({ name, size = "sm", className }: PersonAvatarProps) => {
  const hue = avatarHue(name);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold",
        SIZES[size],
        className
      )}
      style={{
        backgroundColor: `hsl(${hue} 45% 90%)`,
        color: `hsl(${hue} 45% 28%)`,
      }}
    >
      {initials(name)}
    </span>
  );
};
