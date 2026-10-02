import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import {
  Building2,
  ChevronDown,
  FileText,
  Home,
  LogOut,
  Menu,
  PieChart,
  Plus,
  Receipt,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  { path: "/reports", icon: FileText, label: "Reports" },
];

// Occasional deep-dives.
const insightNav = [
  { path: "/my-cost", icon: PieChart, label: "My cost" },
  { path: "/analytics", icon: TrendingUp, label: "Analytics" },
  { path: "/leaderboard", icon: Trophy, label: "Leaderboard" },
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

  useEffect(() => setMoreOpen(false), [location.pathname]);

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
  const insightActive = insightNav.some((i) => isActive(i.path)) || isActive("/split-spaces");

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-card/85 backdrop-blur-xl">
        <div className="container flex h-14 items-center gap-3 px-4 sm:h-16">
          <Link to="/dashboard" className="flex shrink-0 items-center gap-2" aria-label="ExpenseWaale home">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Wallet className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="hidden text-lg font-bold sm:inline">ExpenseWaale</span>
          </Link>

          <div className="min-w-0 flex-1 md:flex-none">
            <SplitSpaceSelector />
          </div>

          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Main">
            {primaryNav.map((item) => (
              <Button
                key={item.path}
                asChild
                variant="ghost"
                className={cn(
                  isActive(item.path) ? "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary" : "text-muted-foreground"
                )}
              >
                <Link to={item.path} aria-current={isActive(item.path) ? "page" : undefined}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(insightActive ? "bg-primary/10 text-primary" : "text-muted-foreground")}
                >
                  Insights
                  <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {insightNav.map((item) => (
                  <DropdownMenuItem key={item.path} asChild>
                    <Link to={item.path}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/split-spaces">
                    <Building2 className="mr-2 h-4 w-4" />
                    Split spaces
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {user && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* Bottom padding leaves room for the mobile tab bar. */}
      <main className="container px-4 pb-28 pt-5 sm:pt-8 md:pb-10">{children}</main>

      {/* Mobile tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Main"
      >
        <div className="grid h-16 grid-cols-5 items-center">
          {primaryNav.slice(0, 2).map((item) => (
            <TabLink key={item.path} {...item} active={isActive(item.path)} />
          ))}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => navigate("/expenses?add=1")}
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
              aria-label="Add expense"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
          <TabLink {...primaryNav[2]} active={isActive(primaryNav[2].path)} />
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 text-[11px] font-medium",
              insightActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Menu className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-2 text-left">
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid gap-1">
            {[...insightNav, { path: "/split-spaces", icon: Building2, label: "Split spaces" }].map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium",
                  isActive(item.path) ? "bg-primary/10 text-primary" : "hover:bg-secondary"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
            {user && (
              <button
                type="button"
                onClick={handleLogout}
                className="mt-2 flex items-center gap-3 rounded-lg border-t px-3 py-3 text-left text-sm font-medium text-destructive hover:bg-destructive/5"
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
      "flex flex-col items-center gap-0.5 text-[11px] font-medium",
      active ? "text-primary" : "text-muted-foreground"
    )}
  >
    <Icon className="h-5 w-5" />
    {label}
  </Link>
);

export default Layout;
