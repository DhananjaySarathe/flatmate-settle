import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import {
  Home,
  Receipt,
  FileText,
  LogOut,
  Wallet,
  TrendingUp,
  Trophy,
  PieChart,
  Building2,
  MoreHorizontal,
  Plus,
  ChevronDown,
} from "lucide-react";
import { SplitSpaceSelector } from "@/components/SplitSpaceSelector";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

// Everyday loop: check balances, log expenses, export a period.
const primaryNav = [
  { path: "/dashboard", icon: Home, label: "Home" },
  { path: "/expenses", icon: Receipt, label: "Expenses" },
  { path: "/reports", icon: FileText, label: "Reports" },
];

// Occasional deep-dives and setup.
const moreNav = [
  { path: "/my-cost", icon: PieChart, label: "My Cost" },
  { path: "/analytics", icon: TrendingUp, label: "Analytics" },
  { path: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { path: "/split-spaces", icon: Building2, label: "SplitSpaces" },
];

const ADD_EXPENSE_PATH = "/expenses?add=1";

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

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Couldn't log out. Try again.");
    } else {
      toast.success("Logged out");
      navigate("/auth");
    }
  };

  const isActive = (path: string) => location.pathname === path;
  const moreActive = moreNav.some((item) => isActive(item.path));

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="container flex h-14 md:h-16 items-center gap-3 px-4">
          <Link to="/dashboard" className="flex items-center gap-2 shrink-0" aria-label="ExpenseWaale home">
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-amber-500 rounded-xl flex items-center justify-center shadow-md shadow-primary/20">
              <Wallet className="w-[18px] h-[18px] text-primary-foreground" />
            </div>
            <span className="hidden sm:inline text-lg font-bold gradient-text">ExpenseWaale</span>
          </Link>

          <div className="ml-auto md:ml-0 min-w-0">
            <SplitSpaceSelector />
          </div>

          <nav className="hidden md:flex items-center gap-1 ml-auto" aria-label="Main">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.path}
                  asChild
                  variant="ghost"
                  className={isActive(item.path) ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}
                >
                  <Link to={item.path} aria-current={isActive(item.path) ? "page" : undefined}>
                    <Icon className="w-4 h-4 mr-2" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={moreActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}
                >
                  More
                  <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {moreNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.path} onSelect={() => navigate(item.path)}>
                      <Icon className="w-4 h-4 mr-2" />
                      {item.label}
                    </DropdownMenuItem>
                  );
                })}
                {user && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive">
                      <LogOut className="w-4 h-4 mr-2" />
                      Log out
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <Button className="hidden md:inline-flex shadow-md shadow-primary/20" onClick={() => navigate(ADD_EXPENSE_PATH)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add expense
          </Button>
        </div>
      </header>

      <main className="container px-4 pt-5 pb-28 sm:pt-8 md:pb-10">{children}</main>

      {/* Mobile bottom navigation: thumb-reachable, Add in the middle. */}
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
        aria-label="Main"
      >
        <div className="grid grid-cols-5 items-end h-16 px-1">
          {primaryNav.slice(0, 2).map((item) => (
            <BottomTab key={item.path} {...item} active={isActive(item.path)} />
          ))}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => navigate(ADD_EXPENSE_PATH)}
              className="-translate-y-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Add expense"
            >
              <Plus className="h-7 w-7" />
            </button>
          </div>
          <BottomTab {...primaryNav[2]} active={isActive(primaryNav[2].path)} />
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
              moreActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader>
            <SheetTitle className="text-left">More</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid gap-1">
            {moreNav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium",
                    isActive(item.path) ? "bg-primary/10 text-primary" : "hover:bg-secondary"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
            {user && (
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  handleLogout();
                }}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-5 w-5" />
                Log out
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

const BottomTab = ({
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
    className={cn(
      "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
      active ? "text-primary" : "text-muted-foreground"
    )}
    aria-current={active ? "page" : undefined}
  >
    <Icon className="h-5 w-5" />
    {label}
  </Link>
);

export default Layout;
