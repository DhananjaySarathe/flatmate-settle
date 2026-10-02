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
  Plus,
  MoreHorizontal,
  Layers,
  ChevronDown,
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
import { useExpenseDialog } from "@/contexts/ExpenseDialogContext";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

const primaryNav = [
  { path: "/dashboard", icon: Home, label: "Overview" },
  { path: "/expenses", icon: Receipt, label: "Expenses" },
  { path: "/reports", icon: FileText, label: "Settle up" },
];

const secondaryNav = [
  { path: "/my-cost", icon: PieChart, label: "My cost" },
  { path: "/analytics", icon: TrendingUp, label: "Analytics" },
  { path: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { path: "/split-spaces", icon: Layers, label: "Manage SplitSpaces" },
];

const Layout = ({ children }: LayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { openAddExpense } = useExpenseDialog();

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
      toast.error("Error logging out");
    } else {
      toast.success("Logged out");
      navigate("/auth");
    }
  };

  const isActive = (path: string) => location.pathname === path;
  const secondaryActive = secondaryNav.some((i) => isActive(i.path));

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-card/85 backdrop-blur-xl">
        <div className="container flex h-14 items-center gap-3 px-4 md:h-16">
          <Link to="/dashboard" className="flex shrink-0 items-center gap-2" aria-label="ExpenseWaale home">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
              <Wallet className="h-[18px] w-[18px] text-primary-foreground" />
            </div>
            <span className="hidden text-lg font-bold tracking-tight lg:inline">ExpenseWaale</span>
          </Link>

          <div className="min-w-0 flex-1 md:flex-none">
            <SplitSpaceSelector />
          </div>

          {/* Desktop navigation */}
          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Main">
            {primaryNav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive(item.path) ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
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
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "h-9 gap-1 px-3 text-sm font-medium",
                    secondaryActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  )}
                >
                  More
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {secondaryNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.path} onSelect={() => navigate(item.path)}>
                      <Icon className="mr-2 h-4 w-4" />
                      {item.label}
                    </DropdownMenuItem>
                  );
                })}
                {user && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                      {user.email}
                    </DropdownMenuLabel>
                    <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={openAddExpense} className="ml-2 gap-1.5">
              <Plus className="h-4 w-4" />
              Add expense
            </Button>
          </nav>
        </div>
      </header>

      {/* Main content — bottom padding clears the mobile tab bar */}
      <main className="container px-4 pb-28 pt-5 sm:pt-8 md:pb-12">{children}</main>

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
            <button
              type="button"
              onClick={openAddExpense}
              aria-label="Add expense"
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform active:scale-95"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
          <TabLink {...primaryNav[2]} active={isActive(primaryNav[2].path)} />
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              secondaryActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="text-left">
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid gap-1">
            {secondaryNav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium",
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
                className="mt-2 flex h-12 items-center gap-3 rounded-lg border-t px-3 text-left text-sm font-medium text-destructive"
              >
                <LogOut className="h-5 w-5" />
                <span className="flex-1">Log out</span>
                <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
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
      "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
      active ? "text-primary" : "text-muted-foreground"
    )}
  >
    <Icon className="h-5 w-5" />
    {label}
  </Link>
);

export default Layout;
