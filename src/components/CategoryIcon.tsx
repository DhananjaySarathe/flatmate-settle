import { iconForCategory } from "@/lib/categoryIcons";
import { cn } from "@/lib/utils";

export const CategoryIcon = ({ name, className }: { name?: string | null; className?: string }) => {
  const Icon = iconForCategory(name);
  return (
    <span
      aria-hidden
      className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-foreground/70", className)}
    >
      <Icon className="size-4" strokeWidth={1.75} />
    </span>
  );
};
