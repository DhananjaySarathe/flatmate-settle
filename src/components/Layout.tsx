import { ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import {
  Home,
  Receipt,
  HandCoins,
  LogOut,
  Wallet,
  Plus,
  TrendingUp,
  Trophy,
  PieChart,
  Menu,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { SplitSpaceSelector } from "@/components/SplitSpaceSelector";
import { ExpenseComposerProvider } from "@/components/ExpenseComposer";
import { useExpenseComposer } from "@/contexts/expense-composer";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
}

const PRIMARY_NAV: NavItem[] = [
  { path: "/dashboard", icon: Home, label: "Home" },
  { path: "/expenses", icon: Receipt, label: "Expenses" },
  { path: "/reports", icon: HandCoins, label: "Settle up" },
];

const INSIGHTS_NAV: NavItem[] = [
  { path: "/analytics", icon: TrendingUp, label: "Analytics" },
  { path: "/my-cost", icon: PieChart, label: "Cost per person" },
  { path: "/leaderboard", icon: Trophy, label: "Leaderboard" },
];

const Layout = ({ children }: LayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Check for existing session
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
      toast.error("Couldn't sign out. Try again.");
    } else {
      toast.success("Signed out");
      navigate("/auth");
    }
  };

  return (
    <ExpenseComposerProvider>
      <div className="min-h-screen bg-background">
        <DesktopSidebar pathname={location.pathname} user={user} onLogout={handleLogout} />
        <MobileTopBar />

        <main className="lg:pl-64">
          <div className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
            {children}
          </div>
        </main>

        <MobileTabBar pathname={location.pathname} user={user} onLogout={handleLogout} />
      </div>
    </ExpenseComposerProvider>
  );
};

const Brand = () => (
  <Link
    to="/dashboard"
    className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
      <Wallet className="h-4 w-4" />
    </span>
    <span className="text-[15px] font-semibold tracking-tight">ExpenseWaale</span>
  </Link>
);

const SidebarLink = ({ item, active }: { item: NavItem; active: boolean }) => {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-card font-medium text-foreground shadow-card"
          : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
      )}
    >
      <Icon className={cn("h-4 w-4", active && "text-primary")} />
      {item.label}
    </Link>
  );
};

const DesktopSidebar = ({
  pathname,
  user,
  onLogout,
}: {
  pathname: string;
  user: User | null;
  onLogout: () => void;
}) => {
  const { openComposer } = useExpenseComposer();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
      <div className="px-5 pb-4 pt-6">
        <Brand />
      </div>
      <div className="space-y-3 px-4">
        <SplitSpaceSelector />
        <Button className="w-full shadow-card" onClick={() => openComposer()}>
          <Plus />
          Add expense
        </Button>
      </div>

      <nav className="mt-6 flex-1 space-y-6 overflow-y-auto px-3" aria-label="Main">
        <div className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <SidebarLink key={item.path} item={item} active={pathname === item.path} />
          ))}
        </div>
        <div className="space-y-0.5">
          <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">Insights</p>
          {INSIGHTS_NAV.map((item) => (
            <SidebarLink key={item.path} item={item} active={pathname === item.path} />
          ))}
        </div>
      </nav>

      <div className="space-y-0.5 border-t px-3 py-3">
        <SidebarLink
          item={{ path: "/split-spaces", icon: Layers, label: "Spaces" }}
          active={pathname === "/split-spaces"}
        />
        {user && (
          <div className="flex items-center gap-2 px-3 pt-2">
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={user.email}>
              {user.email}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut />
              Sign out
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
};

const MobileTopBar = () => (
  <header className="sticky top-0 z-30 border-b bg-background lg:hidden">
    <div className="flex h-14 items-center justify-between gap-3 px-4">
      <Link to="/dashboard" aria-label="ExpenseWaale home" className="shrink-0">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Wallet className="h-4 w-4" />
        </span>
      </Link>
      <SplitSpaceSelector variant="compact" />
    </div>
  </header>
);

const MobileTabBar = ({
  pathname,
  user,
  onLogout,
}: {
  pathname: string;
  user: User | null;
  onLogout: () => void;
}) => {
  const { openComposer } = useExpenseComposer();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = [...INSIGHTS_NAV.map((i) => i.path), "/split-spaces"].includes(pathname);

  const tab = (item: NavItem) => {
    const Icon = item.icon;
    const active = pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.path}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
          active ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
        {item.label}
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-safe lg:hidden"
      >
        <div className="mx-auto flex h-16 max-w-md items-stretch px-2">
          {tab(PRIMARY_NAV[0])}
          {tab(PRIMARY_NAV[1])}
          <div className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => openComposer()}
              aria-label="Add expense"
              className="flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-raised ring-4 ring-background transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-ring"
            >
              <Plus className="h-6 w-6" strokeWidth={2.25} />
            </button>
          </div>
          {tab(PRIMARY_NAV[2])}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
              moreActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Menu className="h-5 w-5" strokeWidth={moreActive ? 2.25 : 1.75} />
            More
          </button>
        </div>
      </nav>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen} shouldScaleBackground={false}>
        <DrawerContent className="bg-card">
          <DrawerHeader className="px-5 text-left">
            <DrawerTitle className="text-base">More</DrawerTitle>
            <DrawerDescription className="sr-only">Insights, spaces and account</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-1 px-3 pb-safe">
            {[...INSIGHTS_NAV, { path: "/split-spaces", icon: Layers, label: "Spaces" }].map((item) => {
              const Icon = item.icon;
              const active = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex h-12 items-center gap-3 rounded-lg px-3 text-[15px]",
                    active ? "bg-secondary font-medium" : "hover:bg-secondary"
                  )}
                >
                  <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} />
                  {item.label}
                </Link>
              );
            })}
            {user && (
              <div className="mt-2 border-t pt-2">
                <p className="truncate px-3 py-2 text-xs text-muted-foreground">{user.email}</p>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    onLogout();
                  }}
                  className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-[15px] hover:bg-secondary"
                >
                  <LogOut className="h-5 w-5 text-muted-foreground" />
                  Sign out
                </button>
              </div>
            )}
            <div className="h-4" />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default Layout;
