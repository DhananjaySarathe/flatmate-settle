import { ReactNode, Suspense, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import {
  BarChart3,
  Home,
  LogOut,
  Plus,
  Receipt,
  Settings2,
  Wallet,
  HandCoins,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SpaceSwitcher } from "@/components/layout/SpaceSwitcher";
import { ExpenseComposerProvider, useExpenseComposer } from "@/contexts/ExpenseComposerContext";
import { cn } from "@/lib/utils";

interface LayoutProps {
  /** Optional: used as a layout route, the matched page renders through <Outlet />. */
  children?: ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Extra routes that light this item up. */
  also?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { path: "/dashboard", label: "Home", icon: Home },
  { path: "/expenses", label: "Expenses", icon: Receipt },
  { path: "/reports", label: "Settle up", icon: HandCoins },
  { path: "/analytics", label: "Insights", icon: BarChart3, also: ["/my-cost", "/leaderboard"] },
];

const isActive = (item: NavItem, pathname: string) =>
  pathname === item.path || (item.also ?? []).includes(pathname);

const Layout = ({ children }: LayoutProps) => (
  <ExpenseComposerProvider>
    <Shell>{children}</Shell>
  </ExpenseComposerProvider>
);

const Shell = ({ children }: LayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { openNew } = useExpenseComposer();

  // There is no route guard; the shell sends signed-out visitors to /auth.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Couldn't sign out", { description: error.message });
    } else {
      toast.success("Signed out");
      navigate("/auth");
    }
  };

  const displayName = (user?.user_metadata?.full_name as string | undefined) || user?.email || "Account";

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow-raised"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6 md:h-16">
          <Link
            to="/dashboard"
            className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="ExpenseWaale home"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="hidden text-base font-bold tracking-tight lg:inline">ExpenseWaale</span>
          </Link>

          <span className="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />

          <SpaceSwitcher className="min-w-0 max-w-[14rem] flex-shrink" />

          <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item, pathname);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button onClick={openNew} className="hidden md:inline-flex">
              <Plus /> Add expense
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground transition-colors hover:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Account menu"
              >
                {displayName.charAt(0).toUpperCase()}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-semibold">{displayName}</p>
                  {user?.email && displayName !== user.email && (
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 py-2" onSelect={() => navigate("/split-spaces")}>
                  <Settings2 className="h-4 w-4" /> Manage groups
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 py-2 text-debit focus:bg-debit-soft focus:text-debit"
                  onSelect={handleLogout}
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pb-tabbar pt-5 sm:px-6 sm:pt-8 md:pb-16">
        <Suspense fallback={<PageFallback />}>{children ?? <Outlet />}</Suspense>
      </main>

      <BottomNav pathname={pathname} onAdd={openNew} />
    </div>
  );
};

const PageFallback = () => (
  <div aria-busy="true" aria-label="Loading">
    <Skeleton className="mb-2 h-8 w-44" />
    <Skeleton className="mb-8 h-4 w-64" />
    <Skeleton className="h-64 rounded-xl" />
  </div>
);

/** Phone navigation: four destinations with "Add expense" in the thumb-friendly centre. */
const BottomNav = ({ pathname, onAdd }: { pathname: string; onAdd: () => void }) => {
  const [first, second, third, fourth] = NAV_ITEMS;

  const renderItem = (item: NavItem) => {
    const active = isActive(item, pathname);
    const Icon = item.icon;
    return (
      <NavLink
        key={item.path}
        to={item.path}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          active ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
        {item.label}
      </NavLink>
    );
  };

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-safe backdrop-blur supports-[backdrop-filter]:bg-card/85 md:hidden"
    >
      <div className="mx-auto grid h-[var(--tabbar-height)] max-w-md grid-cols-5">
        {renderItem(first)}
        {renderItem(second)}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add expense"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-raised transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        {renderItem(third)}
        {renderItem(fourth)}
      </div>
    </nav>
  );
};

export default Layout;
