import { ReactNode, Suspense, useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  ChartColumn,
  Ellipsis,
  House,
  Layers,
  LogOut,
  type LucideIcon,
  Plus,
  Receipt,
  Scale,
  Users,
  Wallet,
} from "lucide-react";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SplitSpaceSelector } from "@/components/SplitSpaceSelector";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { ExpenseSheetProvider, useExpenseSheet } from "@/contexts/ExpenseSheetContext";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Other routes that belong to this section. */
  also?: string[];
}

const HOME: NavItem = { to: "/dashboard", label: "Home", icon: House };
const EXPENSES: NavItem = { to: "/expenses", label: "Expenses", icon: Receipt };
const BALANCES: NavItem = { to: "/reports", label: "Balances", icon: Scale };
const INSIGHTS: NavItem = { to: "/analytics", label: "Insights", icon: ChartColumn, also: ["/my-cost", "/leaderboard"] };
const PEOPLE: NavItem = { to: "/people", label: "People", icon: Users };
const SPACES: NavItem = { to: "/split-spaces", label: "Spaces", icon: Layers };

const SIDEBAR_NAV = [HOME, EXPENSES, BALANCES, INSIGHTS, PEOPLE];
const MORE_NAV = [INSIGHTS, PEOPLE, SPACES];

const isActive = (item: NavItem, pathname: string) => pathname === item.to || !!item.also?.includes(pathname);

const BrandMark = () => (
  <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
    <Wallet className="size-4" />
  </span>
);

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

const Shell = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { openNewExpense } = useExpenseSheet();

  useEffect(() => {
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_OUT") navigate("/auth");
    });

    db.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => setMoreOpen(false), [location.pathname]);

  // "N" adds an expense from anywhere (when not typing and no dialog is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      e.preventDefault();
      openNewExpense();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openNewExpense]);

  const handleLogout = async () => {
    const { error } = await db.auth.signOut();
    if (error) {
      toast.error("Couldn't sign out. Try again.");
      return;
    }
    queryClient.clear();
    toast.success("Signed out");
    navigate("/auth");
  };

  return (
    <div className="min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar px-3 pb-3 pt-4 md:flex">
        <Link to="/dashboard" className="mb-5 flex items-center gap-2.5 px-2">
          <BrandMark />
          <span className="text-[15px] font-semibold tracking-tight">ExpenseWaale</span>
        </Link>

        <SplitSpaceSelector />

        <Button onClick={openNewExpense} className="mt-3 w-full justify-between">
          <span className="flex items-center gap-2">
            <Plus />
            Add expense
          </span>
          <kbd className="rounded border border-primary-foreground/30 px-1.5 font-sans text-[11px] font-medium text-primary-foreground/80">
            N
          </kbd>
        </Button>

        <nav className="mt-5 space-y-0.5" aria-label="Main">
          {SIDEBAR_NAV.map((item) => {
            const active = isActive(item, location.pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-card text-foreground shadow-[0_1px_2px_hsl(24_10%_10%/0.08)]"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                )}
              >
                <Icon className={cn("size-4", active && "text-primary")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t pt-3">
          <Link
            to="/split-spaces"
            className={cn(
              "mb-1 flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
              location.pathname === "/split-spaces"
                ? "bg-card text-foreground"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            )}
          >
            <Layers className={cn("size-4", location.pathname === "/split-spaces" && "text-primary")} />
            Spaces
          </Link>
          <div className="flex items-center gap-2 px-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={user?.email ?? undefined}>
              {user?.email ?? " "}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="size-8 text-muted-foreground hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="size-4" />
              <span className="sr-only">Sign out</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 md:hidden">
        <Link to="/dashboard" aria-label="ExpenseWaale home">
          <BrandMark />
        </Link>
        <SplitSpaceSelector variant="compact" className="min-w-0 max-w-[70vw]" />
      </header>

      <div className="md:pl-60">
        <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-5 sm:px-6 md:px-8 md:pb-14 md:pt-8 lg:px-10">
          <Suspense fallback={<PageFallback />}>{children}</Suspense>
        </main>
      </div>

      {/* Phone tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-safe shadow-[0_-4px_16px_-8px_hsl(24_10%_10%/0.12)] md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-stretch">
          {[HOME, EXPENSES].map((item) => (
            <TabLink key={item.to} item={item} active={isActive(item, location.pathname)} />
          ))}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={openNewExpense}
              className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_hsl(18_75%_30%/0.6)] transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Plus className="size-6" />
              <span className="sr-only">Add expense</span>
            </button>
          </div>
          <TabLink item={BALANCES} active={isActive(BALANCES, location.pathname)} />
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-[11px] font-medium",
              MORE_NAV.some((i) => isActive(i, location.pathname)) ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Ellipsis className="size-5" />
            More
          </button>
        </div>
      </nav>

      <ResponsiveDialog open={moreOpen} onOpenChange={setMoreOpen} title="More">
        <div className="-mx-2 space-y-0.5">
          {MORE_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item, location.pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium",
                  active ? "bg-secondary text-foreground" : "hover:bg-secondary/60"
                )}
              >
                <Icon className={cn("size-5", active ? "text-primary" : "text-muted-foreground")} />
                {item.label}
              </Link>
            );
          })}
          <div className="my-2 border-t" />
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[15px] font-medium hover:bg-secondary/60"
          >
            <LogOut className="size-5 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              Sign out
              {user?.email && <span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>}
            </span>
          </button>
        </div>
      </ResponsiveDialog>
    </div>
  );
};

/** Shown inside the shell while a lazily loaded page's code arrives. */
const PageFallback = () => (
  <div className="space-y-4" aria-busy="true" aria-label="Loading">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-10 w-72" />
    <Skeleton className="h-64 rounded-2xl" />
  </div>
);

const TabLink = ({ item, active }: { item: NavItem; active: boolean }) => {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-1 text-[11px] font-medium",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon className="size-5" />
      {item.label}
    </Link>
  );
};

interface LayoutProps {
  /** Pages can be passed directly, or rendered through a nested <Route> via <Outlet />. */
  children?: ReactNode;
}

const Layout = ({ children }: LayoutProps) => (
  <ExpenseSheetProvider>
    <Shell>{children ?? <Outlet />}</Shell>
  </ExpenseSheetProvider>
);

export default Layout;
