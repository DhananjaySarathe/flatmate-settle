import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Eye, EyeOff, Loader2, MailCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonAvatar } from "@/components/PersonAvatar";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

const POINTS = [
  "A space for each group: your flat, a trip, the office lunch crew.",
  "Split each expense equally between whoever was in. Only you need an account.",
  "See the fewest payments that settle everyone, then mark the period as settled.",
  "Share a read-only link or a PDF so everyone can check the numbers.",
];

const STEPS = [
  { title: "Add your people", body: "Names are enough. A Default space is ready the moment you sign up." },
  { title: "Log expenses as they happen", body: "Amount, what it was for, who was in. Shares are worked out for you." },
  { title: "Settle up", body: "Follow the payment list, mark the period settled, and start fresh." },
];

const Auth = () => {
  useDocumentTitle("Sign in");
  const [mode, setMode] = useState<Mode>("signin");
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    db.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
  }, [navigate]);

  const focusForm = (next: Mode) => {
    setMode(next);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => formRef.current?.querySelector<HTMLInputElement>("input")?.focus(), 250);
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="size-[18px]" />
          </span>
          <span className="text-lg font-semibold tracking-tight">ExpenseWaale</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => focusForm(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "Create account" : "Sign in"}
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {/* Phones: pitch, then the form, then the details. Desktop: pitch and details left, form right. */}
        <section className="grid items-start gap-x-16 gap-y-8 pt-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-[auto_1fr] lg:pt-14">
          <div className="max-w-xl lg:col-start-1 lg:row-start-1">
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-balance sm:text-5xl">
              Know who owes whom, without the spreadsheet.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground text-pretty">
              Log what each person paid and who it was for. ExpenseWaale splits it equally and works out the fewest
              payments that square everyone up.
            </p>
          </div>

          <div ref={formRef} className="lg:sticky lg:top-10 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <AuthCard mode={mode} onModeChange={setMode} />
          </div>

          <div className="max-w-xl lg:col-start-1 lg:row-start-2">
            <ul className="space-y-3">
              {POINTS.map((p) => (
                <li key={p} className="flex gap-3 text-[15px]">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-sage/15 text-positive">
                    <Check className="size-3.5" strokeWidth={2.5} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <ExamplePreview className="mt-10" />
          </div>
        </section>

        <section className="mt-20 border-t pt-12" aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="text-2xl font-semibold tracking-tight">
            How it works
          </h2>
          <ol className="mt-6 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground text-pretty">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <Button size="lg" onClick={() => focusForm("signup")}>
              Create your account
              <ArrowRight />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:px-6">
          <span className="font-medium text-foreground">ExpenseWaale</span>
          <span>© {new Date().getFullYear()} ExpenseWaale</span>
        </div>
      </footer>
    </div>
  );
};

const AuthCard = ({ mode, onModeChange }: { mode: Mode; onModeChange: (m: Mode) => void }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmSentTo, setConfirmSentTo] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setFormError(null);
    setConfirmSentTo(null);
  }, [mode]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (mode === "signup" && !name.trim()) return setFormError("Add your name so your group knows who you are.");
    if (!email.trim() || !password) return setFormError("Enter your email and password.");
    if (mode === "signup" && password.length < 6) return setFormError("Use at least 6 characters for your password.");

    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate("/dashboard");
      } else {
        const { data, error } = await db.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        // With email confirmation on, there's no session until the link is clicked.
        if (data.session) navigate("/dashboard");
        else setConfirmSentTo(email.trim());
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (confirmSentTo) {
    return (
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        <span className="grid size-11 place-items-center rounded-full bg-sage/15 text-positive">
          <MailCheck className="size-5" />
        </span>
        <h2 className="mt-4 text-xl font-semibold">Check your inbox</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a confirmation link to <span className="font-medium text-foreground">{confirmSentTo}</span>. Open it
          to finish creating your account, then sign in here.
        </p>
        <Button variant="outline" className="mt-6 w-full" onClick={() => onModeChange("signin")}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-[0_20px_50px_-30px_hsl(24_10%_10%/0.3)] sm:p-8">
      <div className="grid grid-cols-2 rounded-lg bg-secondary p-1" role="tablist" aria-label="Account">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => onModeChange(m)}
            className={cn(
              "rounded-md py-2 text-sm font-medium transition-colors",
              mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        {mode === "signup" && (
          <div className="space-y-1.5">
            <label htmlFor="auth-name" className="text-sm font-medium">
              Your name
            </label>
            <Input
              id="auth-name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Riya Sharma"
              className="h-11"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <label htmlFor="auth-email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="auth-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="auth-password" className="text-sm font-medium">
            Password
          </label>
          <div className="relative">
            <Input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 pr-11"
              aria-describedby={mode === "signup" ? "auth-password-hint" : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {mode === "signup" && (
            <p id="auth-password-hint" className="text-xs text-muted-foreground">
              At least 6 characters.
            </p>
          )}
        </div>

        {formError && (
          <p role="alert" className="rounded-lg bg-negative/10 px-3 py-2.5 text-sm text-negative">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </div>
  );
};

/** A static illustration of the Home screen, labelled as an example. */
const ExamplePreview = ({ className }: { className?: string }) => (
  <figure className={cn("max-w-md", className)}>
    <div className="rounded-2xl border bg-card p-5" aria-hidden>
      <p className="text-2xl font-semibold tracking-tight">
        You get back <span className="text-positive">₹2,340.00</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Since Sep 1 · 14 expenses</p>
      <ul className="mt-4 divide-y border-t text-sm">
        {[
          ["Aman", "You", "₹1,800.00"],
          ["Riya", "You", "₹540.00"],
          ["Kabir", "Riya", "₹220.00"],
        ].map(([from, to, amount]) => (
          <li key={from} className="flex items-center gap-2 py-2.5">
            <PersonAvatar name={from} size="sm" />
            <span className="font-medium">{from}</span>
            <ArrowRight className="size-3.5 text-muted-foreground" />
            <span className="font-medium">{to}</span>
            <span className="ml-auto font-semibold tabular-nums">{amount}</span>
          </li>
        ))}
      </ul>
    </div>
    <figcaption className="mt-2 text-xs text-muted-foreground">Example of what your Home screen shows.</figcaption>
  </figure>
);

export default Auth;
