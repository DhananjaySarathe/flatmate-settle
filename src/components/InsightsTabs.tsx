import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/analytics", label: "Spending" },
  { to: "/my-cost", label: "Per person" },
  { to: "/leaderboard", label: "Leaderboard" },
];

/** Section switcher for the three Insights pages. */
export const InsightsTabs = () => (
  <nav aria-label="Insights" className="-mx-1 overflow-x-auto scrollbar-none">
    <div className="inline-flex gap-1 rounded-xl bg-secondary p-1">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            cn(
              "whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              isActive ? "bg-card text-foreground shadow-[0_1px_2px_hsl(24_10%_10%/0.1)]" : "text-muted-foreground hover:text-foreground"
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  </nav>
);
