import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Wallet className="h-5 w-5" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">This page doesn't exist</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link may be old or mistyped. Your expenses are safe.
        </p>
        <Button asChild className="mt-6">
          <Link to="/dashboard">Go to Home</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
