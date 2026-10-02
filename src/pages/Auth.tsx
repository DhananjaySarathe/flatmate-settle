import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Wallet,
  Users,
  Trophy,
  ArrowRight,
  Check,
  TrendingUp,
  Receipt,
  FileText,
  HandCoins,
  Loader2,
  Pizza,
  Eye,
  EyeOff,
  MailCheck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/common/ResponsiveDialog";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { errorMessage } from "@/lib/db";
import { formatMoneyCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Page gutter for this public page (it renders outside the app Layout). */
const WRAP = "mx-auto w-full max-w-6xl px-4 sm:px-6";

/* ------------------------------------------------------------------ */
/* Feature cards                                                       */
/* ------------------------------------------------------------------ */

const FEATURE_TONES = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  amber: "bg-amber-100 text-amber-800",
  rose: "bg-rose-100 text-rose-700",
  sky: "bg-sky-100 text-sky-800",
  violet: "bg-violet-100 text-violet-800",
};

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: keyof typeof FEATURE_TONES;
}

const FeatureCard = ({ icon: Icon, title, description, tone = "primary" }: FeatureCardProps) => (
  <div className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
    <div
      className={cn("mb-4 flex h-11 w-11 items-center justify-center rounded-xl", FEATURE_TONES[tone])}
      aria-hidden="true"
    >
      <Icon size={20} />
    </div>
    <h3 className="mb-1.5 text-base font-semibold text-foreground sm:text-lg">{title}</h3>
    <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
  </div>
);

const FEATURES: FeatureCardProps[] = [
  {
    icon: Users,
    title: "Groups for every flat and trip",
    description:
      "Keep the flat, the Goa trip and office lunches apart. Each group has its own people, expenses and balances.",
    tone: "primary",
  },
  {
    icon: Receipt,
    title: "Add expenses in seconds",
    description:
      "Enter the amount, who paid and a category. Split equally between exactly the people involved. We handle the math.",
    tone: "amber",
  },
  {
    icon: HandCoins,
    title: "Who pays whom",
    description:
      "See who owes what and settle up with the fewest payments. Mark a period as settled and start fresh.",
    tone: "success",
  },
  {
    icon: TrendingUp,
    title: "Spending insights",
    description:
      "Spending over time, category breakdowns and each person's share of the costs.",
    tone: "sky",
  },
  {
    icon: Trophy,
    title: "Fun leaderboards",
    description:
      "Badges like Milk Bhai, Fuel King and Silent Assassin make the month-end money talk a lot lighter.",
    tone: "rose",
  },
  {
    icon: FileText,
    title: "PDF reports and share links",
    description:
      "Download a PDF report, or share a read-only link so everyone sees the same numbers.",
    tone: "violet",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Start with a group",
    body: "Sign up and you get a Default group straight away. Add more for trips or events.",
  },
  {
    n: "2",
    title: "Add your people",
    body: "Add the people you share costs with by name. They don't need an account.",
  },
  {
    n: "3",
    title: "Track and settle",
    body: "Log expenses as they happen. At month-end, see who pays whom and mark it as settled.",
  },
];

/* ------------------------------------------------------------------ */
/* Sign in / sign up                                                   */
/* ------------------------------------------------------------------ */

type AuthMode = "signin" | "signup";
type Field = "name" | "email" | "password";
type FieldErrors = Partial<Record<Field, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Supabase's default minimum password length. */
const MIN_PASSWORD_LENGTH = 6;

const ALREADY_REGISTERED_MESSAGE =
  "There's already an account with this email. Enter your password to sign in.";

const isAlreadyRegisteredError = (error: unknown) => {
  const lower = errorMessage(error, "").toLowerCase();
  return lower.includes("already registered") || lower.includes("already been registered");
};

/** Turns the common Supabase auth errors into something that says how to recover. */
const describeAuthError = (error: unknown, mode: AuthMode): string => {
  const raw = errorMessage(error, "");
  const lower = raw.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "That email and password don't match. Check them and try again.";
  }
  if (lower.includes("email not confirmed")) {
    return "Your email isn't confirmed yet. Open the link in the email we sent you, then sign in.";
  }
  if (isAlreadyRegisteredError(error)) return ALREADY_REGISTERED_MESSAGE;
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Couldn't reach ExpenseWaale. Check your connection and try again.";
  }
  if (raw) return raw;
  return mode === "signin"
    ? "Couldn't sign you in. Try again."
    : "Couldn't create your account. Try again.";
};

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
}

const AuthModal = ({ isOpen, onClose, initialMode = "signin" }: AuthModalProps) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [formData, setFormData] = useState({ email: "", password: "", name: "" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  const navigate = useNavigate();

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const refs = { name: nameRef, email: emailRef, password: passwordRef };

  // Reset to the requested mode each time the modal opens. Done during render
  // (not in an effect) so the first field exists before the dialog focuses it.
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setMode(initialMode);
      setFieldErrors({});
      setFormError(null);
      setNotice(null);
      setShowPassword(false);
    }
  }

  const isSignUp = mode === "signup";
  const firstFieldRef = isSignUp ? nameRef : emailRef;

  const updateField = (field: Field, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    if (formError) setFormError(null);
  };

  // The keyboard's "next" key sends Enter, which would submit a half-filled
  // form. Move on to the next empty field instead.
  const focusNextOnEnter =
    (next: React.RefObject<HTMLInputElement>) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
      if (next.current && !next.current.value) {
        e.preventDefault();
        next.current.focus();
      }
    };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setFieldErrors({});
    setFormError(null);
    setNotice(null);
    requestAnimationFrame(() => (next === "signup" ? nameRef : emailRef).current?.focus());
  };

  // Sign-up hit an existing account: keep the email and password they typed
  // and put them one tap away from signing in.
  const moveToSignIn = () => {
    setMode("signin");
    setFieldErrors({});
    setNotice(null);
    requestAnimationFrame(() => passwordRef.current?.focus());
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (isSignUp && !formData.name.trim()) errors.name = "Enter your name.";
    const email = formData.email.trim();
    if (!email) errors.email = "Enter your email address.";
    else if (!EMAIL_PATTERN.test(email)) {
      errors.email = "Enter a valid email address, like name@example.com.";
    }
    if (!formData.password) {
      errors.password = isSignUp ? "Choose a password." : "Enter your password.";
    } else if (isSignUp && formData.password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const errors = validate();
    setFieldErrors(errors);
    setFormError(null);
    setNotice(null);
    const firstInvalid = (["name", "email", "password"] as const).find((field) => errors[field]);
    if (firstInvalid) {
      refs[firstInvalid].current?.focus();
      return;
    }

    const email = formData.email.trim();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: formData.password,
        });
        if (error) throw error;
        toast.success("Welcome back");
        onClose();
        navigate("/dashboard");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: formData.password,
          options: {
            data: { full_name: formData.name.trim() },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        if (!data.session) {
          // With email confirmation on, Supabase answers a sign-up for an
          // existing account with a stand-in user that has no identities and
          // sends no email. Point them at sign in instead of the inbox.
          if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
            moveToSignIn();
            setFormError(ALREADY_REGISTERED_MESSAGE);
            return;
          }
          // Email confirmation is on: there's no session yet, so /dashboard
          // would just bounce back here. Stay put and say what to do next.
          setMode("signin");
          setFormData((prev) => ({ ...prev, password: "" }));
          setShowPassword(false);
          setNotice("Check your inbox to confirm your email, then sign in.");
          return;
        }
        toast.success("Account created", {
          description: "Your Default group is ready.",
        });
        onClose();
        navigate("/dashboard");
      }
    } catch (error) {
      if (mode === "signup" && isAlreadyRegisteredError(error)) moveToSignIn();
      setFormError(describeAuthError(error, mode));
    } finally {
      setLoading(false);
    }
  };

  const errorId = (field: Field) => `auth-${field}-error`;
  const inputClass =
    "h-11 text-base md:text-base aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive";

  return (
    <ResponsiveDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ResponsiveDialogContent
        aria-modal="true"
        className="sm:max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          firstFieldRef.current?.focus();
        }}
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-xl sm:text-2xl">
            {isSignUp ? "Create your account" : "Welcome back"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {isSignUp
              ? "It's free. You start with a Default group, ready for your people."
              : "Sign in to see your groups and balances."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <ResponsiveDialogBody className="space-y-4 pt-2">
            {notice && (
              <div
                role="status"
                className="flex items-start gap-3 rounded-lg bg-credit-soft px-3.5 py-3 text-sm text-foreground"
              >
                <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-credit" aria-hidden="true" />
                <p>{notice}</p>
              </div>
            )}

            {isSignUp && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-name">Your name</Label>
                <Input
                  ref={nameRef}
                  id="auth-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  required
                  aria-required="true"
                  aria-invalid={fieldErrors.name ? true : undefined}
                  aria-describedby={fieldErrors.name ? errorId("name") : undefined}
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  onKeyDown={focusNextOnEnter(emailRef)}
                  className={inputClass}
                />
                {fieldErrors.name && (
                  <p id={errorId("name")} className="text-sm text-destructive">
                    {fieldErrors.name}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                ref={emailRef}
                id="auth-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="you@example.com"
                required
                aria-required="true"
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={fieldErrors.email ? errorId("email") : undefined}
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                onKeyDown={focusNextOnEnter(passwordRef)}
                className={inputClass}
              />
              {fieldErrors.email && (
                <p id={errorId("email")} className="text-sm text-destructive">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="auth-password">Password</Label>
              <div className="relative">
                <Input
                  ref={passwordRef}
                  id="auth-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="go"
                  required
                  aria-required="true"
                  minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
                  aria-invalid={fieldErrors.password ? true : undefined}
                  aria-describedby={
                    fieldErrors.password
                      ? errorId("password")
                      : isSignUp
                        ? "auth-password-hint"
                        : undefined
                  }
                  value={formData.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  className={cn(inputClass, "pr-12")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-controls="auth-password"
                  className="absolute right-0.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {fieldErrors.password ? (
                <p id={errorId("password")} className="text-sm text-destructive">
                  {fieldErrors.password}
                </p>
              ) : (
                isSignUp && (
                  <p id="auth-password-hint" className="text-sm text-muted-foreground">
                    At least {MIN_PASSWORD_LENGTH} characters.
                  </p>
                )
              )}
            </div>

            {formError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-sm text-destructive"
              >
                {formError}
              </p>
            )}
          </ResponsiveDialogBody>

          <ResponsiveDialogFooter className="flex-col gap-3 sm:flex-col sm:items-stretch sm:justify-start">
            {/* aria-disabled rather than disabled: a disabled button drops focus to
                <body> mid-request, which loses keyboard users' place in the sheet.
                handleSubmit already ignores repeat submits while loading. */}
            <Button
              type="submit"
              size="lg"
              className="w-full aria-disabled:cursor-progress"
              aria-disabled={loading || undefined}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {isSignUp ? "Creating account…" : "Signing in…"}
                </>
              ) : isSignUp ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? "Already have an account?" : "New to ExpenseWaale?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(isSignUp ? "signin" : "signup")}
                className="inline-flex min-h-10 items-center rounded-sm px-1.5 font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};

/* ------------------------------------------------------------------ */
/* Animated product preview                                            */
/* ------------------------------------------------------------------ */

type MockTab = "groups" | "settle" | "badges";

const MOCK_TABS: { id: MockTab; label: string }[] = [
  { id: "groups", label: "Groups" },
  { id: "settle", label: "Settle up" },
  { id: "badges", label: "Badges" },
];

const MOCK_GROUPS = [
  { name: "Flat 404", meta: "4 people · 38 expenses", current: true },
  { name: "Goa trip", meta: "6 people · 21 expenses", current: false },
  { name: "Office lunch", meta: "5 people · 12 expenses", current: false },
];

const MOCK_PAYMENTS = [
  { from: "Alice", amount: 450 },
  { from: "Bob", amount: 1000 },
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Entrance for each preview screen; skipped for people who prefer less motion. */
const MOCK_ENTER =
  "animate-in fade-in slide-in-from-right-4 duration-500 motion-reduce:animate-none";

const MockScreen = () => {
  const [activeTab, setActiveTab] = useState<MockTab>("groups");
  // Stop the slideshow once someone picks a tab, or if they prefer less motion.
  const [autoPlay, setAutoPlay] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    if (!autoPlay) return;
    const interval = setInterval(() => {
      setActiveTab((prev) => {
        const index = MOCK_TABS.findIndex((t) => t.id === prev);
        return MOCK_TABS[(index + 1) % MOCK_TABS.length].id;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [autoPlay]);

  const youGetBack = MOCK_PAYMENTS.reduce((sum, p) => sum + p.amount, 0);

  const content: Record<MockTab, React.ReactNode> = {
    groups: (
      <div className={MOCK_ENTER}>
        <div className="mb-2 flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span className="font-medium">Your groups</span>
          <span>3 groups</span>
        </div>
        <ul className="divide-y rounded-lg border bg-card">
          {MOCK_GROUPS.map((group) => (
            <li key={group.name} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                {group.name[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{group.name}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{group.meta}</span>
              </span>
              {group.current && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Current
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    ),
    settle: (
      <div className={MOCK_ENTER}>
        <div className="mb-3 rounded-lg bg-credit-soft px-3 py-3 text-center">
          <div className="text-xs font-medium text-credit">You get back</div>
          <div className="text-2xl font-bold tabular-nums tracking-tight text-credit">
            {formatMoneyCompact(youGetBack)}
          </div>
          <div className="text-[11px] text-muted-foreground">Flat 404 · since last settle-up</div>
        </div>
        <ul className="divide-y rounded-lg border bg-card">
          {MOCK_PAYMENTS.map((p) => (
            <li key={p.from} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex shrink-0 items-center -space-x-1.5">
                <PersonAvatar name={p.from} size="xs" className="ring-2 ring-card" />
                <PersonAvatar name="You" size="xs" className="ring-2 ring-card" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-semibold">{p.from}</span>{" "}
                <span className="text-muted-foreground">pays</span>{" "}
                <span className="font-semibold">you</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatMoneyCompact(p.amount)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          {MOCK_PAYMENTS.length} payments settle everyone up.
        </p>
      </div>
    ),
    badges: (
      <div className={cn("grid grid-cols-2 gap-3", MOCK_ENTER)}>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="mb-1 text-3xl" aria-hidden="true">
            🥛
          </div>
          <div className="text-xs font-bold text-foreground">Milk Bhai</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">Top grocery spender</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="mb-1 text-3xl" aria-hidden="true">
            ⛽
          </div>
          <div className="text-xs font-bold text-foreground">Fuel King</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">Most fuel paid</div>
        </div>
        <div className="col-span-2 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-lg bg-primary/15 p-2 text-primary" aria-hidden="true">
              <Trophy size={16} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-foreground">Most generous</div>
              <div className="truncate text-[11px] text-muted-foreground">Paid the most overall</div>
            </div>
          </div>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-primary">
            {formatMoneyCompact(12400)}
          </span>
        </div>
      </div>
    ),
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card shadow-raised">
      <div className="flex h-10 items-center justify-between border-b bg-secondary/40 px-4" aria-hidden="true">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-destructive/40" />
          <div className="h-2.5 w-2.5 rounded-full bg-amber-400/50" />
          <div className="h-2.5 w-2.5 rounded-full bg-success/40" />
        </div>
        <div className="text-[11px] font-medium text-muted-foreground">ExpenseWaale</div>
      </div>

      <div className="flex gap-1 bg-secondary/30 p-2" role="group" aria-label="Preview screens">
        {MOCK_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={activeTab === t.id}
            onClick={() => {
              setAutoPlay(false);
              setActiveTab(t.id);
            }}
            className={cn(
              "min-h-10 flex-1 rounded-md px-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              activeTab === t.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-[260px] p-4 sm:p-5">{content[activeTab]}</div>

      <div className="flex items-center justify-between border-t bg-secondary/30 p-3 text-xs">
        <span className="text-muted-foreground">Spent this month</span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatMoneyCompact(24590)}
        </span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const TRUST_POINTS = [
  "Free, no card needed",
  "Your people don't need an account",
  "Works on your phone",
];

const Auth = () => {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
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
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [navigate]);

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const scrollToSection = (id: string) =>
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-sans text-foreground">
      {/* Navbar */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 transition-colors duration-150",
          scrolled ? "border-b bg-background/90 backdrop-blur-md" : "border-b border-transparent"
        )}
      >
        <div className={cn(WRAP, "flex h-16 items-center justify-between gap-3")}>
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:h-9 sm:w-9">
              <Wallet size={18} aria-hidden="true" />
            </span>
            <span className="truncate text-base font-bold tracking-tight sm:text-xl">ExpenseWaale</span>
          </div>

          <nav
            className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex"
            aria-label="Page sections"
          >
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <Button variant="ghost" size="sm" className="h-10 px-3" onClick={() => openAuth("signin")}>
              Sign in
            </Button>
            <Button size="sm" className="h-10 px-3 sm:px-4" onClick={() => openAuth("signup")}>
              Get started
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pb-16 pt-28 sm:pb-24 sm:pt-36">
          {/* Subtle dotted grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            aria-hidden="true"
            style={{
              backgroundImage: "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            }}
          />

          <div className={cn(WRAP, "relative")}>
            <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-16">
              <div className="min-w-0 flex-1 text-center lg:text-left">
                <p className="mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  For flats, trips and office lunches
                </p>

                <h1 className="mb-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                  Splitting bills{" "}
                  <span className="relative inline-block text-primary">
                    made&nbsp;easy.
                    <svg
                      className="absolute -bottom-2 left-0 w-full"
                      viewBox="0 0 200 8"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 5 Q 50 1, 100 4 T 198 4"
                        stroke="hsl(var(--primary))"
                        strokeWidth="2"
                        strokeLinecap="round"
                        fill="none"
                        opacity="0.5"
                      />
                    </svg>
                  </span>
                </h1>

                <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
                  Stop using spreadsheets. Log shared costs as they happen, split them between the
                  people involved, and see exactly who pays whom when it's time to settle up.
                </p>

                <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center lg:justify-start">
                  <Button onClick={() => openAuth("signup")} size="lg" className="px-7 text-base">
                    Start splitting free
                    <ArrowRight size={18} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => scrollToSection("how-it-works")}
                    className="px-7 text-base"
                  >
                    See how it works
                  </Button>
                </div>

                <ul className="mx-auto mt-10 flex max-w-xl flex-wrap justify-center gap-x-6 gap-y-2 border-t pt-6 text-sm text-muted-foreground lg:mx-0 lg:justify-start">
                  {TRUST_POINTS.map((point) => (
                    <li key={point} className="flex items-center gap-1.5">
                      <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative w-full min-w-0 max-w-md flex-1 lg:max-w-lg">
                {/* Floating sample cards */}
                <div
                  className="absolute -left-4 -top-6 z-20 hidden duration-700 animate-in fade-in slide-in-from-left-4 motion-reduce:animate-none sm:block"
                  aria-hidden="true"
                >
                  <div className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2 shadow-raised">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-credit-soft text-credit">
                      <Check className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">Marked as settled</div>
                      <div className="text-sm font-bold">1 – 30 Sep</div>
                    </div>
                  </div>
                </div>

                {/* fill-mode-backwards keeps this card hidden during its delay instead of
                    showing, vanishing and then fading in. */}
                <div
                  className="absolute -bottom-4 -right-2 z-20 hidden delay-200 duration-700 animate-in fade-in slide-in-from-right-4 fill-mode-backwards motion-reduce:animate-none sm:block"
                  aria-hidden="true"
                >
                  <div className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2 shadow-raised">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                      <Pizza className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">
                        Pizza night · split 4 ways
                      </div>
                      <div className="text-sm font-bold tabular-nums">
                        {formatMoneyCompact(1200)}{" "}
                        <span className="font-medium text-muted-foreground">
                          · {formatMoneyCompact(300)} each
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <MockScreen />
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-16 border-t bg-secondary/40 py-16 sm:py-24">
          <div className={WRAP}>
            <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
              <h2 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need to share costs
              </h2>
              <p className="text-muted-foreground">
                Add what you spend. ExpenseWaale works out each person's share, who owes whom and
                the fewest payments to clear it.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <FeatureCard key={feature.title} {...feature} />
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-16 py-16 sm:py-24">
          <div className={WRAP}>
            <div className="mx-auto mb-10 max-w-xl text-center sm:mb-12">
              <h2 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
              <p className="text-muted-foreground">Three steps from sign-up to your first settle-up.</p>
            </div>
            <ol className="mx-auto grid max-w-4xl grid-cols-1 gap-8 text-center sm:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <div
                    className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xl font-bold text-primary"
                    aria-hidden="true"
                  >
                    {s.n}
                  </div>
                  <h3 className="mb-2 text-lg font-bold">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="pb-20">
          <div className={WRAP}>
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] px-5 py-10 text-center sm:p-14">
              <p className="mb-5 inline-flex items-center rounded-full border bg-card px-3 py-1 text-xs font-semibold">
                Free to use · no card needed
              </p>
              <h2 className="mx-auto mb-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
                Ready to stop arguing about money?
              </h2>
              <p className="mx-auto mb-8 max-w-2xl text-base text-muted-foreground sm:text-lg">
                Set up your group, add the first expense, and let ExpenseWaale keep the numbers
                straight for everyone.
              </p>
              <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <Button onClick={() => openAuth("signup")} size="lg" className="px-8">
                  Create free account
                  <ArrowRight size={18} aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="lg" onClick={() => openAuth("signin")} className="px-6">
                  I already have an account
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-secondary/30 py-8">
        <div className={cn(WRAP, "flex flex-col items-center justify-between gap-4 text-sm sm:flex-row")}>
          <div className="flex items-center gap-2">
            <Wallet className="text-primary" size={18} aria-hidden="true" />
            <span className="font-bold text-foreground">ExpenseWaale</span>
          </div>
          <div className="text-muted-foreground">
            © {new Date().getFullYear()} ExpenseWaale. All rights reserved.
          </div>
        </div>
      </footer>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
    </div>
  );
};

export default Auth;
