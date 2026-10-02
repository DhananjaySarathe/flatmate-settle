import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    // min-h-screen is emitted after min-h-dvh, so the dvh height has to sit in an
    // @supports rule to win; otherwise 100vh overshoots the visible area on phones.
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-foreground supports-[min-height:100dvh]:min-h-dvh sm:px-6">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="mb-10 inline-flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-base font-bold tracking-tight">ExpenseWaale</span>
        </div>
        <p className="text-sm font-medium text-primary">Error 404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Page not found</h1>
        <p className="mt-2 text-muted-foreground">That link doesn't go anywhere.</p>
        <Button asChild className="mt-8 h-11 px-6">
          <Link to="/dashboard">Go to Home</Link>
        </Button>
      </div>
    </main>
  );
};

export default NotFound;
