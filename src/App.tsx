import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import Layout from "./components/Layout";
import NotFound from "./pages/NotFound";
import { SplitSpaceProvider } from "./contexts/SplitSpaceContext";

// Everyday pages load up front; the rest (charts, PDFs, marketing) load on first visit.
const Auth = lazy(() => import("./pages/Auth"));
const SharedReport = lazy(() => import("./pages/SharedReport"));
const SplitSpaces = lazy(() => import("./pages/SplitSpaces"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const MyCost = lazy(() => import("./pages/MyCost"));

const PublicFallback = () => <div className="min-h-dvh bg-background" aria-busy="true" />;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="light" position="top-center" closeButton />
      <BrowserRouter>
        <SplitSpaceProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route
              path="/auth"
              element={
                <Suspense fallback={<PublicFallback />}>
                  <Auth />
                </Suspense>
              }
            />
            <Route
              path="/share/:token"
              element={
                <Suspense fallback={<PublicFallback />}>
                  <SharedReport />
                </Suspense>
              }
            />
            {/* Signed-in pages share one shell, so the header and expense composer never remount. */}
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/my-cost" element={<MyCost />} />
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
