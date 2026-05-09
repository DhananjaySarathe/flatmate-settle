import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Wallet,
  Users,
  Trophy,
  ArrowRight,
  Check,
  X,
  TrendingUp,
  Receipt,
  Sparkles,
  ShieldCheck,
  Mail,
  Loader2,
  Pizza,
  Star,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  tone?: "primary" | "accent" | "amber" | "rose" | "sky" | "violet";
}

const FEATURE_TONES = {
  primary: { bg: "bg-primary/10", icon: "text-primary", hover: "group-hover:bg-primary group-hover:text-primary-foreground" },
  accent: { bg: "bg-accent/10", icon: "text-accent", hover: "group-hover:bg-accent group-hover:text-accent-foreground" },
  amber: { bg: "bg-amber-100", icon: "text-amber-700", hover: "group-hover:bg-amber-500 group-hover:text-white" },
  rose: { bg: "bg-rose-100", icon: "text-rose-600", hover: "group-hover:bg-rose-500 group-hover:text-white" },
  sky: { bg: "bg-sky-100", icon: "text-sky-700", hover: "group-hover:bg-sky-500 group-hover:text-white" },
  violet: { bg: "bg-violet-100", icon: "text-violet-700", hover: "group-hover:bg-violet-500 group-hover:text-white" },
};

const FeatureCard = ({
  icon: Icon,
  title,
  description,
  badge,
  tone = "primary",
}: FeatureCardProps) => {
  const t = FEATURE_TONES[tone];
  return (
    <Card className="p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group bg-card border-border">
      <div
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors",
          t.bg,
          t.icon,
          t.hover
        )}
      >
        <Icon size={22} />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium">
            {badge}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </Card>
  );
};

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "signin" | "signup";
}

const AuthModal = ({
  isOpen,
  onClose,
  initialMode = "signin",
}: AuthModalProps) => {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [formData, setFormData] = useState({ email: "", password: "", name: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      toast.error("Please fill in all fields");
      return;
    }
    if (mode === "signup" && !formData.name) {
      toast.error("Please provide your full name");
      return;
    }

    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
        onClose();
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: { full_name: formData.name },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        toast.success("Account created successfully!");
        onClose();
        navigate("/dashboard");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <Card className="relative w-full max-w-md shadow-2xl overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <div className="p-6 sm:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 -m-1"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </div>
            <Button type="submit" className="w-full mt-2" disabled={loading} size="lg">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Please wait
                </>
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Create free account"
              )}
            </Button>
          </form>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                New to ExpenseWaale?{" "}
                <button
                  onClick={() => setMode("signup")}
                  className="text-primary hover:underline font-medium"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => setMode("signin")}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

const MockScreen = () => {
  const [activeTab, setActiveTab] = useState<"spaces" | "settlements" | "badges">(
    "spaces"
  );

  useEffect(() => {
    const tabs: ("spaces" | "settlements" | "badges")[] = [
      "spaces",
      "settlements",
      "badges",
    ];
    const interval = setInterval(() => {
      setActiveTab((prev) => tabs[(tabs.indexOf(prev) + 1) % tabs.length]);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const content = {
    spaces: (
      <div className="space-y-2 animate-in slide-in-from-right-4 duration-500 fade-in">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 px-1">
          <span className="font-medium tracking-wide">YOUR SPACES</span>
          <span>3 active</span>
        </div>
        {["Apartment 404", "Goa Trip 2024", "Office Lunch"].map((space) => (
          <div
            key={space}
            className="flex items-center justify-between p-3 rounded-lg bg-secondary/60 border border-border hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                {space[0]}
              </div>
              <span className="text-sm font-medium text-foreground">{space}</span>
            </div>
            <span className="text-xs text-muted-foreground">Open →</span>
          </div>
        ))}
      </div>
    ),
    settlements: (
      <div className="space-y-3 animate-in slide-in-from-right-4 duration-500 fade-in">
        <div className="text-center pb-3 border-b border-border">
          <div className="text-xs text-muted-foreground mb-1 tracking-wide font-medium">
            TOTAL OWED TO YOU
          </div>
          <span className="text-2xl text-accent font-bold tracking-tight">
            ₹1,450.00
          </span>
        </div>
        {[
          { name: "Alice", note: "Rent share", amt: "+₹450" },
          { name: "Bob", note: "Dinner & drinks", amt: "+₹1000" },
        ].map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                {s.name[0]}
              </div>
              <div>
                <div className="text-foreground font-medium text-sm">{s.name}</div>
                <div className="text-[10px] text-muted-foreground">{s.note}</div>
              </div>
            </div>
            <span className="text-accent font-semibold text-sm">{s.amt}</span>
          </div>
        ))}
      </div>
    ),
    badges: (
      <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-right-4 duration-500 fade-in">
        <div className="p-3 bg-secondary/60 rounded-lg border border-border text-center">
          <div className="text-3xl mb-1">🥛</div>
          <div className="text-xs font-bold text-foreground">Milk Bhai</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Top grocery spender
          </div>
        </div>
        <div className="p-3 bg-secondary/60 rounded-lg border border-border text-center">
          <div className="text-3xl mb-1">⛽</div>
          <div className="text-xs font-bold text-foreground">Fuel King</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Most fuel paid
          </div>
        </div>
        <div className="col-span-2 p-3 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/15 rounded-lg text-primary">
              <Trophy size={16} />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">
                Most Generous
              </div>
              <div className="text-[10px] text-muted-foreground">Gold tier</div>
            </div>
          </div>
          <span className="text-sm font-semibold text-primary">₹12,400</span>
        </div>
      </div>
    ),
  };

  return (
    <div className="relative bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
      <div className="h-10 border-b border-border flex items-center px-4 justify-between bg-secondary/40">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-destructive/40" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-accent/40" />
        </div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <ShieldCheck size={10} /> expensewaale.app
        </div>
      </div>

      <div className="flex p-2 gap-1 bg-secondary/30">
        {(
          [
            { id: "spaces", label: "Spaces" },
            { id: "settlements", label: "Settlements" },
            { id: "badges", label: "Badges" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
              activeTab === t.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5 min-h-[260px]">{content[activeTab]}</div>

      <div className="p-3 border-t border-border bg-secondary/30 flex justify-between items-center">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Live sync
        </div>
        <div className="text-sm font-semibold text-primary">₹24,590.00</div>
      </div>
    </div>
  );
};

const Auth = () => {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) navigate("/dashboard");
    };
    checkUser();
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [navigate]);

  const openAuth = (mode: "signin" | "signup") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 overflow-x-hidden">
      {/* Navbar */}
      <nav
        className={cn(
          "fixed w-full z-40 transition-all duration-300",
          scrolled
            ? "bg-background/85 backdrop-blur-md border-b border-border py-3"
            : "py-5"
        )}
      >
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <Wallet className="text-primary-foreground" size={18} />
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight">
              ExpenseWaale
            </span>
          </div>

          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a
              href="#how-it-works"
              className="hover:text-foreground transition-colors"
            >
              How it works
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openAuth("signin")}
              className="hidden sm:inline-flex"
            >
              Sign in
            </Button>
            <Button onClick={() => openAuth("signup")} size="sm">
              Get started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        {/* Soft warm decorative blobs */}
        <div className="absolute top-[-15%] left-[5%] w-[420px] h-[420px] bg-primary/15 blur-[110px] rounded-full pointer-events-none" />
        <div className="absolute top-[25%] right-[0%] w-[360px] h-[360px] bg-accent/12 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[40%] w-[300px] h-[300px] bg-amber-300/15 blur-[90px] rounded-full pointer-events-none" />

        {/* Subtle dotted grid */}
        <div
          className="absolute inset-0 opacity-[0.4] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, hsl(35 15% 80%) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6">
                <Sparkles size={12} />
                <span className="tracking-wide">V2.0 IS LIVE</span>
                <span className="w-px h-3 bg-primary/30 mx-1" />
                <span className="text-muted-foreground">Join 2,000+ users</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] mb-6 tracking-tight">
                Splitting bills{" "}
                <span className="relative inline-block">
                  <span className="gradient-text">made&nbsp;easy.</span>
                  <svg
                    className="absolute -bottom-2 left-0 w-full"
                    viewBox="0 0 200 8"
                    preserveAspectRatio="none"
                    aria-hidden
                  >
                    <path
                      d="M2 5 Q 50 1, 100 4 T 198 4"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="none"
                      opacity="0.6"
                    />
                  </svg>
                </span>
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Stop using spreadsheets. ExpenseWaale organizes shared costs,
                settles debts instantly, and keeps friendships drama-free.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-center lg:justify-start">
                <Button
                  onClick={() => openAuth("signup")}
                  size="lg"
                  className="text-base px-7 shadow-md shadow-primary/20"
                >
                  Start splitting free
                  <ArrowRight size={18} className="ml-1" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() =>
                    document
                      .getElementById("features")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="text-base px-7"
                >
                  See how it works
                </Button>
              </div>

              {/* Social proof: avatar stack + rating */}
              <div className="mt-8 flex items-center justify-center lg:justify-start gap-4 flex-wrap">
                <div className="flex -space-x-2">
                  {["A", "R", "P", "S", "M"].map((c, i) => (
                    <div
                      key={i}
                      className={cn(
                        "w-9 h-9 rounded-full border-2 border-background flex items-center justify-center text-xs font-bold",
                        ["bg-rose-200 text-rose-800",
                          "bg-amber-200 text-amber-900",
                          "bg-emerald-200 text-emerald-800",
                          "bg-sky-200 text-sky-800",
                          "bg-violet-200 text-violet-800"][i]
                      )}
                    >
                      {c}
                    </div>
                  ))}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
                    ))}
                    <span className="text-xs font-semibold ml-1">4.9</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Loved by 2,000+ flatmates
                  </div>
                </div>
              </div>

              <div className="mt-10 grid grid-cols-3 gap-4 sm:gap-8 max-w-md mx-auto lg:mx-0 border-t border-border pt-6">
                <div>
                  <div className="text-xl sm:text-2xl font-bold gradient-text">
                    ₹10L+
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Tracked</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold gradient-text">
                    0₹
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">In fees</div>
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold gradient-text">
                    100%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Free</div>
                </div>
              </div>
            </div>

            <div className="flex-1 w-full max-w-md lg:max-w-lg relative">
              {/* Floating decorative cards */}
              <div className="hidden sm:block absolute -top-6 -left-4 z-20 animate-in fade-in slide-in-from-left-4 duration-700">
                <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2 flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">
                      Settled
                    </div>
                    <div className="text-sm font-bold">You paid ₹450</div>
                  </div>
                </div>
              </div>

              <div
                className="hidden sm:block absolute -bottom-4 -right-2 z-20 animate-in fade-in slide-in-from-right-4 duration-700"
                style={{ animationDelay: "200ms" }}
              >
                <div className="bg-card border border-border rounded-xl shadow-lg px-3 py-2 flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                    <Pizza className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">
                      New expense
                    </div>
                    <div className="text-sm font-bold">Pizza Night ₹1,200</div>
                  </div>
                </div>
              </div>

              <MockScreen />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="py-16 sm:py-24 bg-secondary/40 border-t border-border"
      >
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight">
              Everything you need to manage costs
            </h2>
            <p className="text-muted-foreground">
              Powerful features wrapped in a simple, intuitive interface designed
              for modern roommates and travel groups.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <FeatureCard
              icon={Users}
              title="Split Spaces"
              description="Create separate contexts for your apartment, office team, or vacation. Keeps your finances organized."
              badge="Core"
              tone="primary"
            />
            <FeatureCard
              icon={Receipt}
              title="Smart Expenses"
              description="Add expenses with custom categories. Split by percentage, shares, or equally. We handle the math."
              tone="amber"
            />
            <FeatureCard
              icon={Check}
              title="Auto Settlements"
              description="Our algorithm calculates the minimum number of transactions needed to settle everyone up."
              tone="accent"
            />
            <FeatureCard
              icon={TrendingUp}
              title="Deep Analytics"
              description="Visual spending trends, category breakdowns, and fairness scores to see who's carrying the team."
              badge="Pro"
              tone="sky"
            />
            <FeatureCard
              icon={Trophy}
              title="Fun Leaderboards"
              description="Gamify spending with badges like Milk Bhai, Fuel King, or Silent Assassin. Make finance fun."
              tone="rose"
            />
            <FeatureCard
              icon={Mail}
              title="PDF & Share"
              description="Export detailed PDF reports or generate a public link to share the settlement summary instantly."
              tone="violet"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight">
              How it works
            </h2>
            <p className="text-muted-foreground">
              Three steps from sign-up to your first settled split.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8 text-center max-w-4xl mx-auto">
            {[
              {
                n: "1",
                title: "Create a space",
                body:
                  "Sign up and instantly get a Default space. Add new ones for trips or events.",
              },
              {
                n: "2",
                title: "Add flatmates",
                body:
                  "Invite friends by name and email. They don't need an account to be tracked.",
              },
              {
                n: "3",
                title: "Track & settle",
                body:
                  "Log expenses as they happen. See who pays whom at month-end.",
              },
            ].map((s) => (
              <div key={s.n} className="group">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold mx-auto mb-4 border border-primary/20 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {s.n}
                </div>
                <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20">
        <div className="container mx-auto px-4 sm:px-6">
          <Card className="relative p-8 sm:p-14 text-center bg-gradient-to-br from-primary/12 via-card to-accent/12 border-primary/20 overflow-hidden">
            {/* Decorative blur blobs */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-primary/15 blur-[80px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent/15 blur-[80px] rounded-full pointer-events-none" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/80 backdrop-blur border border-border text-xs font-semibold mb-5">
                <Sparkles size={12} className="text-primary" />
                <span>Free forever — no credit card required</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-bold mb-4 tracking-tight max-w-3xl mx-auto leading-tight">
                Ready to stop arguing about money?
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join thousands of flatmates who use ExpenseWaale to keep their
                finances — and their friendships — clean.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <Button
                  onClick={() => openAuth("signup")}
                  size="lg"
                  className="px-8 shadow-lg shadow-primary/20"
                >
                  Create free account
                  <ArrowRight size={18} className="ml-1" />
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => openAuth("signin")}
                  className="px-6"
                >
                  I already have an account
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border bg-secondary/30">
        <div className="container mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Wallet className="text-primary" size={18} />
            <span className="font-bold text-foreground">ExpenseWaale</span>
          </div>
          <div className="text-muted-foreground">
            © {new Date().getFullYear()} ExpenseWaale. All rights reserved.
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
      />
    </div>
  );
};

export default Auth;
