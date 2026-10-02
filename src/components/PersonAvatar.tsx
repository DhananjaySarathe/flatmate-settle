import { cn } from "@/lib/utils";
import { avatarTint, initials } from "@/lib/format";

interface PersonAvatarProps {
  id: string;
  name: string;
  size?: "sm" | "md";
  className?: string;
}

export const PersonAvatar = ({ id, name, size = "md", className }: PersonAvatarProps) => (
  <span
    aria-hidden
    className={cn(
      "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
      size === "sm" ? "h-6 w-6 text-[10px]" : "h-9 w-9 text-xs",
      avatarTint(id),
      className
    )}
  >
    {initials(name) || "?"}
  </span>
);
