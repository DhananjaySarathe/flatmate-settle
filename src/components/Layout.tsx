import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import {
  Building2,
  ChevronDown,
  Handshake,
  Home,
  LogOut,
  Menu,
  PieChart,
  Plus,
  Receipt,
  Trophy,
  UserRound,
  Wallet,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SplitSpaceSelector } from "@/components/SplitSpaceSelector";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

// The everyday loop: see balances, log expenses, settle up.
const primaryNav = [
  { path: "/dashboard", icon: Home, label: "Home" },
  { path: "/expenses", icon: Receipt, label: "Expenses" },
  { path: "/reports", icon: Handshake, label: "Settle up" },
];

// Occasional deep-dives, grouped so they don't compete with the main loop.
const insightsNav = [
  { path: "/analytics", icon: PieChart, label: "Analytics", hint: "Trends and category breakdown" },
  { path: "/my-cost", icon: UserRound, label: "My cost", hint: "What each person actually spent" },
  { path: "/leaderboard", icon: Trophy, label: "Leaderboard", hint: "Fun stats for the group" },
];

const Layout = ({ children }: LayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session && location.pathname !== "/auth") {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error logging out");
    } else {
      toast.success("Logged out");
      navigate("/auth");
    }
  };

  const isActive = (path: string) => location.pathname === path;
  const insightsActive = insightsNav.some((item) => isActive(item.path));

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-card/85 backdrop-blur-xl">
        <div className="container flex h-14 items-center gap-3 px-4 md:h-16">
          <Link to="/dashboard" className="flex shrink-0 items-center gap-2" aria-label="ExpenseWaale home">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-amber-500 shadow-md shadow-primary/20">
              <Wallet className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="hidden text-lg font-bold gradient-text sm:inline">ExpenseWaale</span>
          </Link>

          {/* Desktop navigation */}
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive(item.path) ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                    isActive(item.path)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  insightsActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <PieChart className="h-4 w-4" />
                Insights
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {insightsNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link to={item.path} className="flex items-start gap-3 py-2">
                        <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.hint}</p>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <SplitSpaceSelector />
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="hidden shrink-0 md:inline-flex" aria-label="Account">
                    <UserRound className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/split-spaces">
                      <Building2 className="mr-2 h-4 w-4" />
                      Manage split spaces
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      {/* Bottom padding leaves room for the mobile tab bar */}
      <main className="container px-4 pb-28 pt-5 sm:pt-8 md:pb-10">{children}</main>

      {/* Mobile tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
          {primaryNav.slice(0, 2).map((item) => (
            <TabLink key={item.path} {...item} active={isActive(item.path)} />
          ))}
          <div className="flex justify-center">
            <Link
              to="/expenses?new=1"
              aria-label="Add expense"
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform active:scale-95"
            >
              <Plus className="h-6 w-6" />
            </Link>
          </div>
          <TabLink {...primaryNav[2]} active={isActive(primaryNav[2].path)} />
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              insightsActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Menu className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="text-left">
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1">
            {insightsNav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3",
                    isActive(item.path) ? "bg-primary/10 text-primary" : "hover:bg-secondary"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.hint}</p>
                  </div>
                </Link>
              );
            })}
            <div className="my-2 border-t" />
            <Link to="/split-spaces" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-secondary">
              <Building2 className="h-5 w-5" />
              <span className="text-sm font-medium">Manage split spaces</span>
            </Link>
            {user && (
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-5 w-5" />
                <span className="text-sm font-medium">Log out</span>
              </button>
            )}
            {user?.email && <p className="px-3 pt-2 text-xs text-muted-foreground">Signed in as {user.email}</p>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

const TabLink = ({
  path,
  icon: Icon,
  label,
  active,
}: {
  path: string;
  icon: typeof Home;
  label: string;
  active: boolean;
}) => (
  <Link
    to={path}
    aria-current={active ? "page" : undefined}
    className={cn(
      "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
      active ? "text-primary" : "text-muted-foreground"
    )}
  >
    <Icon className="h-5 w-5" />
    {label}
  </Link>
);

export default Layout;
