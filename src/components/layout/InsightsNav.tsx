import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { path: "/analytics", label: "Spending" },
  { path: "/my-cost", label: "Cost per person" },
  { path: "/leaderboard", label: "Leaderboard" },
];

/** Insights groups three existing pages under one nav item; this switches between them. */
export const InsightsNav = ({ className }: { className?: string }) => {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Insights"
      className={cn(
        "-mx-4 mb-6 flex gap-1 overflow-x-auto border-b px-4 scrollbar-none sm:mx-0 sm:px-0",
        className
      )}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.path;
        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 pb-3 pt-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </NavLink>
        );
      })}
    </nav>
  );
};
