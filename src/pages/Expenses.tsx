import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ChevronDown, Loader2, Pencil, Plus, Receipt, Search, Trash2, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ExpenseFormDialog } from "@/components/ExpenseFormDialog";
import { PersonAvatar } from "@/components/PersonAvatar";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { SpaceExpense, useSpaceData } from "@/hooks/useSpaceData";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

const Expenses = () => {
  const { selectedSplitSpace } = useSplitSpace();
  const { flatmates, expenses, loading, needsSpace, refresh } = useSpaceData();
  const [searchParams, setSearchParams] = useSearchParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SpaceExpense | null>(null);
  const [deleting, setDeleting] = useState<SpaceExpense | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // The mobile "+" button links here with ?new=1.
  useEffect(() => {
    if (searchParams.get("new") === "1" && !loading && flatmates.length > 0) {
      setEditing(null);
      setFormOpen(true);
      searchParams.delete("new");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, loading, flatmates.length]);

  const nameById = useMemo(() => new Map(flatmates.map((f) => [f.id, f.name])), [flatmates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter((e) =>
      [e.title, e.categories?.name, e.flatmates?.name]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    );
  }, [expenses, query]);

  const months = useMemo(() => {
    const groups: { key: string; label: string; total: number; items: SpaceExpense[] }[] = [];
    filtered.forEach((e) => {
      const key = e.date.slice(0, 7);
      let group = groups[groups.length - 1];
      if (!group || group.key !== key) {
        group = { key, label: format(parseISO(e.date), "MMMM yyyy"), total: 0, items: [] };
        groups.push(group);
      }
      group.total += e.amount;
      group.items.push(e);
    });
    return groups;
  }, [filtered]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", deleting.id);
      if (error) throw error;
      toast.success(`Deleted ${deleting.title}`);
      setDeleting(null);
      refresh();
    } catch (error: any) {
      toast.error(error.message);
      console.error(error);
    } finally {
      setDeleteBusy(false);
    }
  };

  if (needsSpace) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Select a split space to continue.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold sm:text-3xl">Expenses</h1>
          <p className="truncate text-sm text-muted-foreground">
            {expenses.length} logged{selectedSplitSpace ? ` in ${selectedSplitSpace.name}` : ""}
          </p>
        </div>
        {flatmates.length > 0 && (
          <Button className="hidden shadow-md shadow-primary/20 md:inline-flex" onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Add expense
          </Button>
        )}
      </div>

      {flatmates.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <UserPlus className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
            <p className="mb-1 font-medium">Add people first</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Expenses are split between the people in this group.
            </p>
            <Button asChild>
              <Link to="/dashboard">Go to Home</Link>
            </Button>
          </CardContent>
        </Card>
      ) : expenses.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
            <p className="mb-4 text-muted-foreground">No expenses yet.</p>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              Add the first expense
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search expenses or people"
              className="h-11 bg-card pl-9 pr-9"
              aria-label="Search expenses"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {months.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No expenses match "{query}".</p>
          )}

          {months.map((month) => (
            <section key={month.key} className="space-y-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold text-muted-foreground">{month.label}</h2>
                <span className="text-sm tabular-nums text-muted-foreground">{formatINR(month.total)}</span>
              </div>
              <Card className="overflow-hidden">
                <ul className="divide-y">
                  {month.items.map((e) => {
                    const splitCount = e.expense_splits.length;
                    const share = splitCount > 0 ? e.amount / splitCount : 0;
                    const expanded = expandedId === e.id;
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : e.id)}
                          aria-expanded={expanded}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
                        >
                          <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary text-[10px] font-medium uppercase leading-tight text-muted-foreground">
                            <span>{format(parseISO(e.date), "EEE")}</span>
                            <span className="text-sm font-bold text-foreground">{format(parseISO(e.date), "d")}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium">{e.title}</p>
                              {e.categories?.name && (
                                <Badge variant="secondary" className="hidden shrink-0 text-[10px] font-normal sm:inline-flex">
                                  {e.categories.name}
                                </Badge>
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {e.flatmates?.name ?? "Someone"} paid
                              <span className="hidden sm:inline"> · {formatINR(share)} each × {splitCount}</span>
                              <span className="sm:hidden"> · split {splitCount} ways</span>
                            </p>
                          </div>
                          <span className="whitespace-nowrap font-semibold tabular-nums">{formatINR(e.amount)}</span>
                          <ChevronDown
                            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
                          />
                        </button>

                        {expanded && (
                          <div className="space-y-3 bg-secondary/30 px-4 pb-4 pt-1">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span>{format(parseISO(e.date), "EEEE, d MMMM yyyy")}</span>
                              {e.categories?.name && <span>{e.categories.name}</span>}
                            </div>
                            <ul className="space-y-1.5">
                              {e.expense_splits.map((s) => {
                                const name = nameById.get(s.flatmate_id) ?? "Removed person";
                                const isPayer = s.flatmate_id === e.paid_by;
                                return (
                                  <li key={s.flatmate_id} className="flex items-center gap-2 text-sm">
                                    <PersonAvatar id={s.flatmate_id} name={name} size="sm" />
                                    <span className="flex-1 truncate">
                                      {name}
                                      {isPayer && <span className="text-xs text-muted-foreground"> · paid</span>}
                                    </span>
                                    <span className="tabular-nums text-muted-foreground">{formatINR(share)}</span>
                                  </li>
                                );
                              })}
                            </ul>
                            <div className="flex gap-2 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9"
                                onClick={() => {
                                  setEditing(e);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setDeleting(e)}
                              >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </>
      )}

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        flatmates={flatmates}
        expense={editing}
        onSaved={refresh}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && `${formatINR(deleting.amount)} paid by ${deleting.flatmates?.name ?? "someone"}. `}
              Balances will be recalculated. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(ev) => {
                ev.preventDefault();
                confirmDelete();
              }}
              disabled={deleteBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Expenses;
