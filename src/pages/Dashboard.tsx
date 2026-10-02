import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { Plus, Users, Trash2, Pencil, Loader2, ArrowRight, Receipt, PartyPopper } from "lucide-react";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { calculateBalances, calculateSettlements, ExpenseLike } from "@/lib/settlement";
import { errorText, formatMoney, relativeDay } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Flatmate {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

const emptyForm = { name: "", email: "", phone: "" };

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export const Avatar = ({ name, className }: { name: string; className?: string }) => (
  <span
    className={cn(
      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary",
      className
    )}
    aria-hidden
  >
    {initials(name) || "?"}
  </span>
);

const Dashboard = () => {
  const { selectedSplitSpace, loading: contextLoading } = useSplitSpace();
  const navigate = useNavigate();
  const [flatmates, setFlatmates] = useState<Flatmate[]>([]);
  const [expenses, setExpenses] = useState<ExpenseLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFlatmate, setEditingFlatmate] = useState<Flatmate | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Flatmate | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (contextLoading) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSplitSpace?.id, contextLoading]);

  const fetchData = async () => {
    try {
      let flatmatesQuery = supabase.from("flatmates").select("*").order("created_at", { ascending: true });
      let expensesQuery = supabase
        .from("expenses")
        .select("id, title, amount, date, paid_by, categories (name), expense_splits (flatmate_id)")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (selectedSplitSpace) {
        const scope = `split_space_id.eq.${selectedSplitSpace.id},split_space_id.is.null`;
        flatmatesQuery = flatmatesQuery.or(scope);
        expensesQuery = expensesQuery.or(scope);
      }

      const [flatmatesRes, expensesRes] = await Promise.all([flatmatesQuery, expensesQuery]);
      if (flatmatesRes.error) throw flatmatesRes.error;
      if (expensesRes.error) throw expensesRes.error;

      setFlatmates(flatmatesRes.data || []);
      setExpenses((expensesRes.data as unknown as ExpenseLike[]) || []);
    } catch (error) {
      console.error(error);
      toast.error("Couldn't load your group. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  };

  const balances = useMemo(
    () => calculateBalances(flatmates, expenses).sort((a, b) => b.balance - a.balance),
    [flatmates, expenses]
  );
  const settlements = useMemo(() => calculateSettlements(balances), [balances]);
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const nameById = useMemo(() => new Map(flatmates.map((f) => [f.id, f.name])), [flatmates]);

  const openAddPerson = () => {
    setEditingFlatmate(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEditPerson = (flatmate: Flatmate) => {
    setEditingFlatmate(flatmate);
    setFormData({ name: flatmate.name, email: flatmate.email || "", phone: flatmate.phone || "" });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formData.name.trim();
    if (!name) {
      toast.error("Enter a name");
      return;
    }

    setSubmitLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You're signed out. Sign in again.");

      const fields = { name, email: formData.email.trim() || null, phone: formData.phone.trim() || null };

      if (editingFlatmate) {
        const { error } = await supabase.from("flatmates").update(fields).eq("id", editingFlatmate.id);
        if (error) throw error;
        toast.success(`Saved ${name}`);
      } else {
        const { error } = await supabase.from("flatmates").insert({
          ...fields,
          created_by: user.id,
          ...(selectedSplitSpace ? { split_space_id: selectedSplitSpace.id } : {}),
        });
        if (error) throw error;
        toast.success(`Added ${name}`);
      }

      setDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setSubmitLoading(false);
    }
  };

  const deleteImpact = useMemo(() => {
    if (!deleteTarget) return { paid: 0, splitIn: 0 };
    return {
      paid: expenses.filter((e) => e.paid_by === deleteTarget.id).length,
      splitIn: expenses.filter(
        (e) => e.paid_by !== deleteTarget.id && e.expense_splits.some((s) => s.flatmate_id === deleteTarget.id)
      ).length,
    };
  }, [deleteTarget, expenses]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from("flatmates").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success(`Removed ${deleteTarget.name}`);
      setDeleteTarget(null);
      fetchData();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const recent = expenses.slice(0, 5);

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      <div>
        <p className="text-sm text-muted-foreground">{selectedSplitSpace ? "SplitSpace" : "Your group"}</p>
        <h1 className="truncate text-2xl font-bold sm:text-3xl">{selectedSplitSpace?.name ?? "Home"}</h1>
      </div>

      {flatmates.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-10 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Who are you splitting with?</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Add everyone who shares costs, including yourself. Then log expenses and we'll work out who owes whom.
            </p>
            <Button className="mt-5" onClick={openAddPerson}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add first person
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Balances: the answer to "who owes whom" */}
          <Card className="overflow-hidden">
            <div className="border-b border-border/60 bg-secondary/40 px-5 py-4 sm:px-6">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">All-time balances</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-3xl font-bold tabular-nums">{formatMoney(total)}</span>
                <span className="text-sm text-muted-foreground">
                  spent across {expenses.length} expense{expenses.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <CardContent className="p-0">
              {expenses.length === 0 ? (
                <div className="px-5 py-8 text-center sm:px-6">
                  <Receipt className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">Add your first expense</p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    Log who paid and who it was for. Balances update instantly.
                  </p>
                  <Button className="mt-4" onClick={() => navigate("/expenses?add=1")}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add expense
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {balances.map((b) => {
                    const square = Math.abs(b.balance) < 0.01;
                    return (
                      <li key={b.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                        <Avatar name={b.name} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{b.name}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            Paid {formatMoney(b.totalPaid)} · Share {formatMoney(b.totalOwed)}
                          </p>
                        </div>
                        <div className="text-right">
                          {square ? (
                            <span className="text-sm text-muted-foreground">Settled up</span>
                          ) : (
                            <>
                              <p
                                className={cn(
                                  "font-semibold tabular-nums",
                                  b.balance > 0 ? "text-accent" : "text-destructive"
                                )}
                              >
                                {formatMoney(Math.abs(b.balance))}
                              </p>
                              <p className="text-xs text-muted-foreground">{b.balance > 0 ? "gets back" : "owes"}</p>
                            </>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {expenses.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {settlements.length === 0 ? "Nobody owes anything" : "How to settle up"}
                </CardTitle>
                {settlements.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {settlements.length} payment{settlements.length === 1 ? "" : "s"} square everyone up.
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {settlements.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <PartyPopper className="h-4 w-4 text-accent" />
                    Everyone has paid their share.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {settlements.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/30 px-3 py-2.5 sm:gap-3"
                      >
                        <span className="min-w-0 truncate font-medium">{s.from}</span>
                        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          pays <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{s.to}</span>
                        <span className="shrink-0 font-semibold tabular-nums">{formatMoney(s.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">
                  Settling a specific month? Pick dates, export a PDF or email everyone in{" "}
                  <Link to="/reports" className="font-medium text-primary hover:underline">
                    Reports
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          )}

          {recent.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Recent expenses</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/expenses">
                    See all
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                <ul>
                  {recent.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 px-5 py-2.5 sm:px-6">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{e.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {nameById.get(e.paid_by) ?? "Someone"} paid · {relativeDay(e.date)}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">{formatMoney(e.amount)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">People ({flatmates.length})</CardTitle>
              <Button variant="ghost" size="sm" onClick={openAddPerson}>
                <Plus className="mr-1 h-4 w-4" />
                Add person
              </Button>
            </CardHeader>
            <CardContent className="p-0 pb-2">
              <ul>
                {flatmates.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-5 py-2 sm:px-6">
                    <Avatar name={f.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{f.name}</p>
                      {(f.email || f.phone) && (
                        <p className="truncate text-xs text-muted-foreground">
                          {[f.email, f.phone].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => openEditPerson(f)} aria-label={`Edit ${f.name}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(f)}
                      className="hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${f.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFlatmate ? `Edit ${editingFlatmate.name}` : "Add a person"}</DialogTitle>
            <DialogDescription>Email is used to send settlement reports. Both contact fields are optional.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                autoFocus
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Priya"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full sm:w-auto" disabled={submitLoading}>
                {submitLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingFlatmate ? "Save" : "Add person"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {deleteImpact.paid > 0 ? (
                  <p className="font-medium text-destructive">
                    This also permanently deletes the {deleteImpact.paid} expense
                    {deleteImpact.paid === 1 ? "" : "s"} they paid for, which changes everyone's balances.
                  </p>
                ) : (
                  <p>They haven't paid for any expenses.</p>
                )}
                {deleteImpact.splitIn > 0 && (
                  <p>
                    They'll be dropped from {deleteImpact.splitIn} other expense{deleteImpact.splitIn === 1 ? "" : "s"}
                    , and those costs will be shared among the remaining people.
                  </p>
                )}
                <p>This can't be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
