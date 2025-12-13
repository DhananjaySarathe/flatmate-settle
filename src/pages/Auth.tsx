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
  MousePointer2,
  Loader2,
  type LucideIcon,
} from "lucide-react";

// --- Styles for Animations ---
const animationStyles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotateX(5deg) rotateY(-5deg); }
    50% { transform: translateY(-15px) rotateX(5deg) rotateY(-5deg); }
  }
  @keyframes grid-move {
    0% { transform: translateY(0); }
    100% { transform: translateY(40px); }
  }
  @keyframes blob {
    0% { transform: translate(0px, 0px) scale(1); }
    33% { transform: translate(30px, -50px) scale(1.1); }
    66% { transform: translate(-20px, 20px) scale(0.9); }
    100% { transform: translate(0px, 0px) scale(1); }
  }
  .animate-float-3d {
    animation: float 6s ease-in-out infinite;
  }
  .animate-blob {
    animation: blob 10s infinite;
  }
  .bg-grid-pattern {
    background-image: linear-gradient(to right, #1e293b 1px, transparent 1px),
                      linear-gradient(to bottom, #1e293b 1px, transparent 1px);
    background-size: 40px 40px;
    mask-image: linear-gradient(to bottom, transparent, black, transparent);
    -webkit-mask-image: linear-gradient(to bottom, transparent 5%, black 40%, black 70%, transparent 95%);
  }
`;

// --- Components ---

interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}

const Button = ({
  children,
  variant = "primary",
  className = "",
  onClick,
  type = "button",
  disabled = false,
}: ButtonProps) => {
  const baseStyle =
    "px-6 py-3 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 transform active:scale-95 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-[hsl(263,70%,60%)] hover:bg-[hsl(263,70%,50%)] text-white shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:shadow-[0_0_30px_rgba(124,58,237,0.6)] border border-transparent",
    secondary:
      "bg-[hsl(222,47%,10%)] hover:bg-[hsl(222,47%,15%)] text-[hsl(210,40%,98%)] border border-[hsl(215,20%,20%)]",
    ghost:
      "bg-transparent hover:bg-[hsl(222,47%,10%)] text-[hsl(210,40%,80%)] hover:text-white",
  };

  return (
    <button
      type={type}
      className={`${baseStyle} ${variants[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
};

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
}

const FeatureCard = ({
  icon: Icon,
  title,
  description,
  badge,
}: FeatureCardProps) => (
  <div className="group p-6 rounded-xl bg-[hsl(222,47%,8%)] border border-[hsl(215,20%,12%)] hover:border-[hsl(263,70%,60%)] transition-all duration-300 hover:shadow-[0_0_20px_rgba(124,58,237,0.1)] relative overflow-hidden">
    <div className="absolute top-0 right-0 w-32 h-32 bg-[hsl(263,70%,60%)] opacity-[0.03] rounded-full blur-2xl transform translate-x-10 -translate-y-10 group-hover:opacity-[0.1] transition-opacity" />

    <div className="relative z-10">
      <div className="w-12 h-12 rounded-lg bg-[hsl(222,47%,12%)] flex items-center justify-center mb-4 text-[hsl(263,70%,60%)] group-hover:scale-110 transition-transform duration-300 border border-[hsl(215,20%,16%)]">
        <Icon size={24} />
      </div>

      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xl font-semibold text-[hsl(210,40%,98%)]">
          {title}
        </h3>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-[hsl(263,70%,20%)] text-[hsl(263,70%,80%)] border border-[hsl(263,70%,30%)]">
            {badge}
          </span>
        )}
      </div>

      <p className="text-[hsl(210,40%,70%)] leading-relaxed text-sm">
        {description}
      </p>
    </div>
  </div>
);

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "signin" | "signup";
  onAuthSuccess?: () => void;
}

const AuthModal = ({
  isOpen,
  onClose,
  initialMode = "signin",
  onAuthSuccess,
}: AuthModalProps) => {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });
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
        if (onAuthSuccess) onAuthSuccess();
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.name,
            },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });

        if (error) throw error;

        toast.success("Account created successfully!");
        onClose();
        if (onAuthSuccess) onAuthSuccess();
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Auth error:", error);
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
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-[hsl(222,47%,8%)] border border-[hsl(215,20%,16%)] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[hsl(263,70%,60%)] to-transparent opacity-50" />

        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-[hsl(210,40%,98%)]">
              {mode === "signin" ? "Welcome Back" : "Create Account"}
            </h2>
            <button
              onClick={onClose}
              className="text-[hsl(210,40%,50%)] hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium text-[hsl(210,40%,70%)] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  className="w-full bg-[hsl(222,47%,5%)] border border-[hsl(215,20%,20%)] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[hsl(263,70%,60%)] focus:ring-1 focus:ring-[hsl(263,70%,60%)] transition-all placeholder-[hsl(215,20%,30%)]"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[hsl(210,40%,70%)] mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                className="w-full bg-[hsl(222,47%,5%)] border border-[hsl(215,20%,20%)] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[hsl(263,70%,60%)] focus:ring-1 focus:ring-[hsl(263,70%,60%)] transition-all placeholder-[hsl(215,20%,30%)]"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[hsl(210,40%,70%)] mb-1.5">
                Password
              </label>
              <input
                type="password"
                className="w-full bg-[hsl(222,47%,5%)] border border-[hsl(215,20%,20%)] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[hsl(263,70%,60%)] focus:ring-1 focus:ring-[hsl(263,70%,60%)] transition-all placeholder-[hsl(215,20%,30%)]"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </div>

            <Button type="submit" className="w-full mt-6" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Please wait
                </>
              ) : mode === "signin" ? (
                "Sign In"
              ) : (
                "Create Free Account"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-[hsl(210,40%,60%)]">
            {mode === "signin" ? (
              <>
                New to ExpenseWaale?{" "}
                <button
                  onClick={() => setMode("signup")}
                  className="text-[hsl(263,70%,60%)] hover:text-[hsl(263,70%,70%)] font-medium"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => setMode("signin")}
                  className="text-[hsl(263,70%,60%)] hover:text-[hsl(263,70%,70%)] font-medium"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Mock Screen Components ---

const MockScreen = () => {
  const [activeTab, setActiveTab] = useState<
    "spaces" | "settlements" | "badges"
  >("spaces");

  // Auto-cycle tabs logic
  useEffect(() => {
    const tabs: ("spaces" | "settlements" | "badges")[] = [
      "spaces",
      "settlements",
      "badges",
    ];
    const interval = setInterval(() => {
      setActiveTab((prev) => {
        const nextIndex = (tabs.indexOf(prev) + 1) % tabs.length;
        return tabs[nextIndex];
      });
    }, 4000); // Switch every 4 seconds

    return () => clearInterval(interval);
  }, []);

  const content = {
    spaces: (
      <div className="space-y-3 animate-in slide-in-from-right-8 duration-500 fade-in">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>YOUR SPACES</span>
          <span>3 Active</span>
        </div>
        {["Apartment 404", "Goa Trip 2024", "Office Lunch"].map((space, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 rounded-lg bg-[hsl(222,47%,10%)] border border-[hsl(215,20%,16%)] hover:border-[hsl(263,70%,60%)] transition-colors group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[hsl(263,70%,20%)] flex items-center justify-center text-[hsl(263,70%,70%)] group-hover:scale-110 transition-transform">
                {space[0]}
              </div>
              <span className="text-sm font-medium text-gray-200">{space}</span>
            </div>
            <div className="text-xs text-[hsl(263,70%,60%)] opacity-0 group-hover:opacity-100 transition-opacity">
              Open →
            </div>
          </div>
        ))}
        <div className="p-3 border border-dashed border-gray-700 rounded-lg text-center text-xs text-gray-500 hover:text-[hsl(263,70%,60%)] hover:border-[hsl(263,70%,60%)] transition-colors cursor-pointer">
          + Create New Split Space
        </div>
      </div>
    ),
    settlements: (
      <div className="space-y-4 animate-in slide-in-from-right-8 duration-500 fade-in">
        <div className="text-center pb-4 border-b border-gray-800">
          <div className="text-xs text-gray-500 mb-1">TOTAL OWED TO YOU</div>
          <span className="text-2xl text-[hsl(142,76%,45%)] font-bold tracking-tight">
            ₹1,450.00
          </span>
        </div>
        <div className="flex items-center justify-between text-sm p-2 hover:bg-[hsl(222,47%,12%)] rounded-lg transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-900/50 flex items-center justify-center text-xs border border-blue-500/20">
              A
            </div>
            <div>
              <div className="text-gray-200 font-medium">Alice</div>
              <div className="text-[10px] text-gray-500">Rent Share</div>
            </div>
          </div>
          <span className="text-[hsl(142,76%,45%)] font-mono font-medium">
            +₹450
          </span>
        </div>
        <div className="flex items-center justify-between text-sm p-2 hover:bg-[hsl(222,47%,12%)] rounded-lg transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-900/50 flex items-center justify-center text-xs border border-orange-500/20">
              B
            </div>
            <div>
              <div className="text-gray-200 font-medium">Bob</div>
              <div className="text-[10px] text-gray-500">Dinner & Drinks</div>
            </div>
          </div>
          <span className="text-[hsl(142,76%,45%)] font-mono font-medium">
            +₹1000
          </span>
        </div>
      </div>
    ),
    badges: (
      <div className="grid grid-cols-2 gap-3 animate-in slide-in-from-right-8 duration-500 fade-in">
        <div className="p-3 bg-[hsl(222,47%,10%)] rounded-lg border border-[hsl(215,20%,16%)] text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(263,70%,60%)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="text-3xl mb-2 transform group-hover:scale-110 transition-transform">
            🥛
          </div>
          <div className="text-xs font-bold text-gray-200">Milk Bhai</div>
          <div className="text-[10px] text-gray-500 mt-1">
            Top Grocery Spender
          </div>
        </div>
        <div className="p-3 bg-[hsl(222,47%,10%)] rounded-lg border border-[hsl(215,20%,16%)] text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-t from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="text-3xl mb-2 transform group-hover:scale-110 transition-transform">
            ⛽
          </div>
          <div className="text-xs font-bold text-gray-200">Fuel King</div>
          <div className="text-[10px] text-gray-500 mt-1">Most Fuel Paid</div>
        </div>
        <div className="col-span-2 p-4 bg-gradient-to-r from-[hsl(263,70%,20%)] to-[hsl(222,47%,10%)] rounded-lg border border-[hsl(263,70%,30%)] flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Trophy size={16} className="text-yellow-400" />
            </div>
            <div>
              <div className="text-xs font-medium text-white">
                Most Generous
              </div>
              <div className="text-[10px] text-yellow-400/80">Gold Tier</div>
            </div>
          </div>
          <span className="text-sm font-mono text-yellow-400 font-bold">
            ₹12,400
          </span>
        </div>
      </div>
    ),
  };

  // Cursor position calculation
  const getCursorPos = () => {
    switch (activeTab) {
      case "spaces":
        return "16%";
      case "settlements":
        return "50%";
      case "badges":
        return "84%";
      default:
        return "16%";
    }
  };

  return (
    <div
      className="relative z-10 bg-[hsl(222,47%,8%)] border border-[hsl(215,20%,16%)] rounded-2xl shadow-2xl overflow-hidden animate-float-3d transform-gpu"
      style={{ transformStyle: "preserve-3d" }}
    >
      {/* Visual Header */}
      <div className="h-12 border-b border-[hsl(215,20%,16%)] flex items-center px-4 justify-between bg-[hsl(222,47%,9%)]">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
          <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
        </div>
        <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
          <ShieldCheck size={10} /> expensewaale.app
        </div>
      </div>

      {/* Tab Navigation with Simulated Click */}
      <div className="flex p-2 gap-2 bg-[hsl(222,47%,7%)] relative">
        {/* Animated Cursor */}
        <div
          className="absolute top-6 z-50 transition-all duration-1000 ease-in-out pointer-events-none drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"
          style={{ left: getCursorPos() }}
        >
          <MousePointer2 className="fill-white text-white w-4 h-4" />
        </div>

        <button
          onClick={() => setActiveTab("spaces")}
          className={`flex-1 py-2 text-xs font-medium rounded-md transition-all relative overflow-hidden ${
            activeTab === "spaces"
              ? "bg-[hsl(263,70%,60%)] text-white shadow-lg"
              : "text-gray-500 hover:bg-[hsl(222,47%,12%)]"
          }`}
        >
          {activeTab === "spaces" && (
            <div className="absolute bottom-0 left-0 h-[2px] bg-white/50 w-full animate-[progress_4s_linear]" />
          )}
          Split Spaces
        </button>
        <button
          onClick={() => setActiveTab("settlements")}
          className={`flex-1 py-2 text-xs font-medium rounded-md transition-all relative overflow-hidden ${
            activeTab === "settlements"
              ? "bg-[hsl(263,70%,60%)] text-white shadow-lg"
              : "text-gray-500 hover:bg-[hsl(222,47%,12%)]"
          }`}
        >
          {activeTab === "settlements" && (
            <div className="absolute bottom-0 left-0 h-[2px] bg-white/50 w-full animate-[progress_4s_linear]" />
          )}
          Settlements
        </button>
        <button
          onClick={() => setActiveTab("badges")}
          className={`flex-1 py-2 text-xs font-medium rounded-md transition-all relative overflow-hidden ${
            activeTab === "badges"
              ? "bg-[hsl(263,70%,60%)] text-white shadow-lg"
              : "text-gray-500 hover:bg-[hsl(222,47%,12%)]"
          }`}
        >
          {activeTab === "badges" && (
            <div className="absolute bottom-0 left-0 h-[2px] bg-white/50 w-full animate-[progress_4s_linear]" />
          )}
          Fun Stats
        </button>
      </div>

      {/* Content Area */}
      <div className="p-6 h-[280px] bg-[hsl(222,47%,8%)] relative overflow-hidden">
        {content[activeTab]}
      </div>

      {/* Bottom Stats */}
      <div className="p-4 border-t border-[hsl(215,20%,16%)] bg-[hsl(222,47%,7%)] flex justify-between items-center">
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live Sync
        </div>
        <div className="font-mono text-sm text-[hsl(263,70%,60%)]">
          ₹24,590.00
        </div>
      </div>
    </div>
  );
};

// --- Main Page ---

const Auth = () => {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
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
    <div className="min-h-screen bg-[hsl(222,47%,6%)] text-[hsl(210,40%,98%)] font-sans selection:bg-[hsl(263,70%,60%)] selection:text-white overflow-x-hidden">
      <style>{animationStyles}</style>
      <style>{`
        @keyframes progress { 
          from { width: 0% } 
          to { width: 100% } 
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>

      {/* --- Navbar --- */}
      <nav
        className={`fixed w-full z-40 transition-all duration-300 ${
          scrolled
            ? "bg-[hsl(222,47%,6%)]/80 backdrop-blur-md border-b border-[hsl(215,20%,12%)] py-4"
            : "py-6"
        }`}
      >
        <div className="container mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="w-8 h-8 bg-[hsl(263,70%,60%)] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(124,58,237,0.5)] group-hover:rotate-12 transition-transform">
              <Wallet className="text-white" size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight">
              ExpenseWaale
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[hsl(210,40%,70%)]">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a
              href="#how-it-works"
              className="hover:text-white transition-colors"
            >
              How it works
            </a>
            <a
              href="#leaderboard"
              className="hover:text-white transition-colors"
            >
              Leaderboard
            </a>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => openAuth("signin")}
              className="hidden md:block text-sm font-medium text-[hsl(210,40%,80%)] hover:text-white transition-colors"
            >
              Sign In
            </button>
            <Button
              onClick={() => openAuth("signup")}
              className="text-sm px-4 py-2"
            >
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* --- Hero Section --- */}
      <section className="relative pt-40 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        {/* Animated Background Gradients & Grid */}
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.2] animate-[grid-move_20s_linear_infinite]" />

        {/* Main "Aurora" Blobs */}
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-[hsl(263,70%,60%)] opacity-[0.15] blur-[120px] rounded-full animate-blob mix-blend-screen" />
        <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] bg-blue-600 opacity-[0.1] blur-[100px] rounded-full animate-blob animation-delay-2000 mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[40%] w-[600px] h-[400px] bg-[hsl(263,70%,40%)] opacity-[0.1] blur-[120px] rounded-full animate-blob animation-delay-4000 mix-blend-screen" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-20">
            {/* Hero Copy */}
            <div className="flex-1 text-center lg:text-left pt-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[hsl(263,70%,10%)] border border-[hsl(263,70%,20%)] text-[hsl(263,70%,80%)] text-xs font-semibold mb-8 shadow-[0_0_20px_rgba(124,58,237,0.1)] hover:bg-[hsl(263,70%,15%)] transition-colors cursor-default">
                <Sparkles size={12} className="text-yellow-300" />
                <span className="tracking-wide">V2.0 IS LIVE</span>
                <div className="w-[1px] h-3 bg-[hsl(263,70%,30%)] mx-1" />
                <span className="text-[hsl(210,40%,60%)]">
                  Join 2,000+ users
                </span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] mb-8 tracking-tight">
                Splitting bills <br className="hidden lg:block" />
                made{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(263,70%,60%)] via-purple-400 to-blue-400 animate-gradient-x">
                  effortless.
                </span>
              </h1>

              <p className="text-lg md:text-xl text-[hsl(210,40%,70%)] mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed font-light">
                Stop using spreadsheets. ExpenseWaale organizes your shared
                costs, settles debts instantly, and keeps friendships
                drama-free.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <Button
                  onClick={() => openAuth("signup")}
                  className="w-full sm:w-auto text-lg px-8 py-4"
                >
                  Start Splitting Free
                  <ArrowRight size={18} />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    document
                      .getElementById("features")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="w-full sm:w-auto text-lg px-8 py-4 border border-[hsl(215,20%,20%)] hover:border-[hsl(215,20%,30%)]"
                >
                  View Demo
                </Button>
              </div>

              <div className="mt-12 flex items-center justify-center lg:justify-start gap-8 text-[hsl(210,40%,50%)] text-sm border-t border-[hsl(215,20%,12%)] pt-8 max-w-md mx-auto lg:mx-0">
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-bold text-white">₹10L+</span>
                  <span>Expenses Tracked</span>
                </div>
                <div className="w-[1px] h-8 bg-[hsl(215,20%,20%)]" />
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-bold text-white">0%</span>
                  <span>Transaction Fees</span>
                </div>
                <div className="w-[1px] h-8 bg-[hsl(215,20%,20%)]" />
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-bold text-white">4.9/5</span>
                  <span>User Rating</span>
                </div>
              </div>
            </div>

            {/* Hero Visual / Interactive Demo */}
            <div className="flex-1 w-full max-w-lg lg:max-w-xl relative perspective-1000">
              {/* Floating Elements Background */}
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-[hsl(263,70%,60%)] to-blue-500 rounded-full blur-[80px] opacity-20 animate-pulse" />

              {/* Main Interactive Component */}
              <MockScreen />

              {/* Decorative Floating Cards behind */}
              <div className="absolute -z-10 top-10 -right-10 bg-[hsl(222,47%,10%)] p-4 rounded-xl border border-[hsl(215,20%,20%)] shadow-xl animate-[float_8s_ease-in-out_infinite_reverse]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                    <Check size={16} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Settled up</div>
                    <div className="text-sm font-bold text-white">
                      You paid ₹450
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -z-10 -bottom-5 -left-5 bg-[hsl(222,47%,10%)] p-4 rounded-xl border border-[hsl(215,20%,20%)] shadow-xl animate-[float_7s_ease-in-out_infinite]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                    <Receipt size={16} />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">New Expense</div>
                    <div className="text-sm font-bold text-white">
                      Pizza Night ₹1200
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Features Grid --- */}
      <section
        id="features"
        className="py-24 bg-[hsl(222,47%,5%)] relative border-t border-[hsl(215,20%,10%)]"
      >
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything you need to manage costs
            </h2>
            <p className="text-[hsl(210,40%,70%)]">
              Powerful features wrapped in a simple, intuitive interface
              designed for modern roommates and travel groups.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Users}
              title="Split Spaces"
              description="Create separate contexts for your Apartment, Office Team, or Vacation. Keeps your finances organized and clutter-free."
              badge="Core"
            />
            <FeatureCard
              icon={Receipt}
              title="Smart Expenses"
              description="Add expenses with custom categories. Split by percentage, shares, or equally. We handle the math instantly."
            />
            <FeatureCard
              icon={Check}
              title="Automated Settlements"
              description="Our algorithm calculates the minimum number of transactions needed to settle everyone up. No circular debts."
            />
            <FeatureCard
              icon={TrendingUp}
              title="Deep Analytics"
              description="Visual spending trends, category breakdowns, and 'Fairness Scores' to see who is carrying the team."
              badge="Pro"
            />
            <FeatureCard
              icon={Trophy}
              title="Fun Leaderboards"
              description="Gamify your spending with badges like 'Milk Bhai', 'Fuel King', or 'Silent Assassin'. Make finance fun."
            />
            <FeatureCard
              icon={Mail}
              title="PDF Reports"
              description="Export detailed PDF reports for tax purposes or email settlement summaries directly to your flatmates."
            />
          </div>
        </div>
      </section>

      {/* --- How It Works --- */}
      <section id="how-it-works" className="py-24 relative overflow-hidden">
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[hsl(215,20%,20%)] to-transparent" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-3 gap-12 text-center">
            <div className="group">
              <div className="w-16 h-16 rounded-full bg-[hsl(222,47%,10%)] border border-[hsl(263,70%,60%)] text-[hsl(263,70%,60%)] flex items-center justify-center text-2xl font-bold mx-auto mb-6 shadow-[0_0_20px_rgba(124,58,237,0.2)] group-hover:scale-110 transition-transform duration-300 group-hover:bg-[hsl(263,70%,60%)] group-hover:text-white">
                1
              </div>
              <h3 className="text-xl font-bold mb-3">Create a Space</h3>
              <p className="text-gray-400">
                Sign up and instantly get a "Default" space. Create new ones for
                trips or events.
              </p>
            </div>
            <div className="group">
              <div className="w-16 h-16 rounded-full bg-[hsl(222,47%,10%)] border border-[hsl(263,70%,60%)] text-[hsl(263,70%,60%)] flex items-center justify-center text-2xl font-bold mx-auto mb-6 shadow-[0_0_20px_rgba(124,58,237,0.2)] group-hover:scale-110 transition-transform duration-300 group-hover:bg-[hsl(263,70%,60%)] group-hover:text-white">
                2
              </div>
              <h3 className="text-xl font-bold mb-3">Add Flatmates</h3>
              <p className="text-gray-400">
                Invite your friends by name and email. They don't even need an
                account to be tracked.
              </p>
            </div>
            <div className="group">
              <div className="w-16 h-16 rounded-full bg-[hsl(222,47%,10%)] border border-[hsl(263,70%,60%)] text-[hsl(263,70%,60%)] flex items-center justify-center text-2xl font-bold mx-auto mb-6 shadow-[0_0_20px_rgba(124,58,237,0.2)] group-hover:scale-110 transition-transform duration-300 group-hover:bg-[hsl(263,70%,60%)] group-hover:text-white">
                3
              </div>
              <h3 className="text-xl font-bold mb-3">Track & Settle</h3>
              <p className="text-gray-400">
                Log expenses as they happen. Check the report at month-end to
                see who pays whom.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- CTA Section --- */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="bg-gradient-to-b from-[hsl(263,70%,15%)] to-[hsl(222,47%,10%)] border border-[hsl(263,70%,25%)] rounded-3xl p-12 text-center relative overflow-hidden group hover:border-[hsl(263,70%,40%)] transition-colors duration-500">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[hsl(263,70%,60%)] opacity-20 blur-[100px] rounded-full pointer-events-none group-hover:opacity-30 transition-opacity" />

            <h2 className="text-3xl md:text-5xl font-bold mb-6 relative z-10">
              Ready to stop arguing about money?
            </h2>
            <p className="text-lg text-[hsl(210,40%,80%)] mb-10 max-w-2xl mx-auto relative z-10">
              Join thousands of flatmates who use ExpenseWaale to keep their
              finances—and their friendships—clean.
            </p>
            <div className="relative z-10">
              <Button
                onClick={() => openAuth("signup")}
                className="text-lg px-10 py-4 shadow-[0_0_40px_rgba(124,58,237,0.4)] mx-auto"
              >
                Create Free Account
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="py-12 border-t border-[hsl(215,20%,12%)] bg-[hsl(222,47%,4%)]">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Wallet className="text-[hsl(263,70%,60%)]" size={24} />
            <span className="text-xl font-bold text-gray-200">
              ExpenseWaale
            </span>
          </div>
          <div className="text-sm text-gray-500">
            © 2024 ExpenseWaale. All rights reserved.
          </div>
          <div className="flex gap-6">
            <a
              href="#"
              className="text-gray-500 hover:text-[hsl(263,70%,60%)] transition-colors"
            >
              <span className="sr-only">Twitter</span>
              <Users size={20} />
            </a>
            <a
              href="#"
              className="text-gray-500 hover:text-[hsl(263,70%,60%)] transition-colors"
            >
              <span className="sr-only">GitHub</span>
              <ShieldCheck size={20} />
            </a>
          </div>
        </div>
      </footer>

      {/* --- Auth Modal --- */}
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
      />
    </div>
  );
};

export default Auth;
