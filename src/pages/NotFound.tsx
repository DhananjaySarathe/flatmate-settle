import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const NotFound = () => {
  const location = useLocation();
  useDocumentTitle("Page not found");

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
          <Compass className="size-5" />
        </span>
        <h1 className="mt-4 text-xl font-semibold">This page doesn't exist</h1>
        <p className="mt-1 text-sm text-muted-foreground">
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
