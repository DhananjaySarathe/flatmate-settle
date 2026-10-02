import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import People from "./pages/People";
import Layout from "./components/Layout";
import NotFound from "./pages/NotFound";
import { SplitSpaceProvider } from "./contexts/SplitSpaceContext";

// Pages that pull in charts or PDF generation load on first visit, keeping Home and
// the add-expense flow light on phones.
const Reports = lazy(() => import("./pages/Reports"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const MyCost = lazy(() => import("./pages/MyCost"));
const SplitSpaces = lazy(() => import("./pages/SplitSpaces"));
const SharedReport = lazy(() => import("./pages/SharedReport"));

const FullPageFallback = () => (
  <div className="grid min-h-dvh place-items-center bg-background">
    <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Navigating between pages reuses what's loaded; a refetch runs in the background.
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <SplitSpaceProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/share/:token"
              element={
                <Suspense fallback={<FullPageFallback />}>
                  <SharedReport />
                </Suspense>
              }
            />
            {/* Signed-in pages share one Layout instance, so the navigation doesn't remount. */}
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/my-cost" element={<MyCost />} />
              <Route path="/people" element={<People />} />
              <Route path="/split-spaces" element={<SplitSpaces />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SplitSpaceProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
