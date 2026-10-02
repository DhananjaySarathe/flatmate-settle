import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { ExpenseFormDialog } from "@/components/ExpenseFormDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { calculateBalances, calculateSettlements } from "@/lib/settlement";
import { errorMessage, fetchSpaceData, SpaceExpense, SpaceFlatmate } from "@/lib/spaceData";
import { formatDay, formatMoney, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface LastSettlement {
  from_date: string;
  to_date: string;
}

type Period = "since-settlement" | "all";

const Avatar = ({ name, className }: { name: string; className?: string }) => (
  <span
    className={cn(
      "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary",
      className
    )}
    aria-hidden
  >
    {initials(name)}
  </span>
);

const Dashboard = () => {
  const { selectedSplitSpace, loading: contextLoading } = useSplitSpace();
  const [flatmates, setFlatmates] = useState<SpaceFlatmate[]>([]);
  const [expenses, setExpenses] = useState<SpaceExpense[]>([]);
  const [lastSettlement, setLastSettlement] = useState<LastSettlement | null>(null);
  const [period, setPeriod] = useState<Period>("since-settlement");
  const [loading, setLoading] = useState(true);

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingFlatmate, setEditingFlatmate] = useState<SpaceFlatmate | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SpaceFlatmate | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const data = await fetchSpaceData(selectedSplitSpace?.id ?? null);
      setFlatmates(data.flatmates);
      setExpenses(data.expenses);

      if (selectedSplitSpace) {
        const { data: s, error } = await supabase
          .from("settlements")
          .select("from_date, to_date")
          .eq("split_space_id", selectedSplitSpace.id)
          .order("to_date", { ascending: false })
          .limit(1);
        // Missing table (42P01) just means no settle-ups have been recorded.
        if (error && error.code !== "42P01") console.error("Failed to load settlements:", error);
        setLastSettlement(s?.[0] ?? null);
      } else {
        setLastSettlement(null);
      }
    } catch (error) {
      toast.error(`Couldn't load this space: ${errorMessage(error)}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [selectedSplitSpace]);

  useEffect(() => {
    if (contextLoading) return;
    setLoading(true);
    fetchAll();
  }, [fetchAll, contextLoading]);

  // Balances use the same rules as Reports. By default we only count expenses after the
  // most recent recorded settle-up, since earlier periods were already squared off.
  const periodExpenses = useMemo(() => {
    if (period === "all" || !lastSettlement) return expenses;
    return expenses.filter((e) => e.date > lastSettlement.to_date);
  }, [expenses, period, lastSettlement]);

  const balances = useMemo(() => calculateBalances(flatmates, periodExpenses), [flatmates, periodExpenses]);
  const settlements = useMemo(() => calculateSettlements(balances), [balances]);
  const periodTotal = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const nameById = useMemo(() => new Map(flatmates.map((f) => [f.id, f.name])), [flatmates]);

  const openMemberDialog = (flatmate: SpaceFlatmate | null) => {
    setEditingFlatmate(flatmate);
    setFormData({
      name: flatmate?.name ?? "",
      email: flatmate?.email ?? "",
      phone: flatmate?.phone ?? "",
    });
    setMemberDialogOpen(true);
  };

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSubmitLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editingFlatmate) {
        const { error } = await supabase
          .from("flatmates")
          .update({
            name: formData.name.trim(),
            email: formData.email || null,
            phone: formData.phone || null,
          })
          .eq("id", editingFlatmate.id);
        if (error) throw error;
        toast.success("Member updated");
      } else {
        const flatmateDataToInsert: Record<string, unknown> = {
          name: formData.name.trim(),
          email: formData.email || null,
          phone: formData.phone || null,
          created_by: user.id,
        };
        if (selectedSplitSpace) flatmateDataToInsert.split_space_id = selectedSplitSpace.id;

        const { error } = await supabase.from("flatmates").insert(flatmateDataToInsert as never);
        if (error) throw error;
        toast.success(`${formData.name.trim()} added`);
      }

      setMemberDialogOpen(false);
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error));
      console.error(error);
    } finally {
      setSubmitLoading(false);
    }
  };

  const confirmDeleteMember = async () => {
    const flatmate = pendingDelete;
    setPendingDelete(null);
    if (!flatmate) return;
    setDeleteLoading(flatmate.id);
    try {
      const { error } = await supabase.from("flatmates").delete().eq("id", flatmate.id);
      if (error) throw error;
      toast.success(`${flatmate.name} removed`);
      fetchAll();
    } catch (error) {
      toast.error(errorMessage(error));
      console.error(error);
    } finally {
      setDeleteLoading(null);
    }
  };

  if (loading || contextLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasMembers = flatmates.length > 0;
  const hasExpenses = expenses.length > 0;
  const allSettled = hasExpenses && settlements.length === 0;
  const recent = expenses.slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{selectedSplitSpace?.name ?? "Your space"}</p>
          <h1 className="text-2xl font-bold sm:text-3xl">
            {!hasMembers ? "Let's get set up" : allSettled ? "Everyone's square" : "Balances"}
          </h1>
        </div>
        {hasMembers && (
          <Button onClick={() => setExpenseDialogOpen(true)} className="hidden shrink-0 sm:inline-flex">
            <Plus className="mr-2 h-4 w-4" />
            Add expense
          </Button>
        )}
      </div>

      {!hasMembers ? (
        <Card>
          <CardContent className="space-y-5 p-6 sm:p-8">
            <ol className="space-y-4">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  1
                </span>
                <div>
                  <p className="font-medium">Add the people you share costs with</p>
                  <p className="text-sm text-muted-foreground">Include yourself. Email is optional and used for reports.</p>
                </div>
              </li>
              <li className="flex gap-3 text-muted-foreground">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                  2
                </span>
                <div>
                  <p className="font-medium">Log expenses as they happen</p>
                  <p className="text-sm">Pick who paid and who it's for. Shares are split equally.</p>
                </div>
              </li>
              <li className="flex gap-3 text-muted-foreground">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                  3
                </span>
                <div>
                  <p className="font-medium">See who owes whom</p>
                  <p className="text-sm">We work out the fewest payments to settle everyone up.</p>
                </div>
              </li>
            </ol>
            <Button onClick={() => openMemberDialog(null)} className="w-full sm:w-auto">
              <UserPlus className="mr-2 h-4 w-4" />
              Add first member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            {/* Who owes whom */}
            <Card>
              <CardHeader className="space-y-3 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">Who owes whom</CardTitle>
                  {lastSettlement && (
                    <div className="inline-flex rounded-lg bg-secondary p-0.5 text-xs font-medium" role="group">
                      {(
                        [
                          ["since-settlement", "Since last settle-up"],
                          ["all", "All time"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPeriod(value)}
                          aria-pressed={period === value}
                          className={cn(
                            "rounded-md px-2.5 py-1 transition-colors",
                            period === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {lastSettlement && period === "since-settlement"
                    ? `Expenses after ${formatDay(lastSettlement.to_date)} · ${formatMoney(periodTotal)} spent`
                    : `All expenses · ${formatMoney(periodTotal)} spent`}
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                {periodExpenses.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center">
                    <Receipt className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {hasExpenses ? "No new expenses since the last settle-up." : "No expenses yet."}
                    </p>
                    <Button size="sm" className="mt-4" onClick={() => setExpenseDialogOpen(true)}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add expense
                    </Button>
                  </div>
                ) : settlements.length === 0 ? (
                  <div className="flex items-center gap-3 rounded-lg bg-success/10 p-4 text-sm">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                    <span>All settled. Nobody owes anything for this period.</span>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {settlements.map((s, i) => (
                      <li key={i} className="flex items-center gap-3 rounded-lg border bg-background px-3 py-3">
                        <Avatar name={s.from} />
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="truncate">
                            <span className="font-semibold">{s.from}</span>
                            <span className="text-muted-foreground"> pays </span>
                            <span className="font-semibold">{s.to}</span>
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold tabular-nums text-primary">{formatMoney(s.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    {settlements.length > 0
                      ? `${settlements.length} ${settlements.length === 1 ? "payment" : "payments"} settles everyone.`
                      : "Pick any date range in Reports."}
                  </p>
                  <Button asChild variant="ghost" size="sm" className="-mr-2 text-primary">
                    <Link to="/reports">
                      <FileText className="mr-1.5 h-4 w-4" />
                      Reports & settle-up
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent expenses */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">Recent expenses</CardTitle>
                {hasExpenses && (
                  <Button asChild variant="ghost" size="sm" className="-mr-2 text-primary">
                    <Link to="/expenses">
                      View all <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {recent.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">Expenses you add will show up here.</p>
                ) : (
                  <ul className="divide-y">
                    {recent.map((e) => (
                      <li key={e.id} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{e.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatDay(e.date, "MMM d")} · {nameById.get(e.paid_by) ?? "Unknown"} paid · split{" "}
                            {e.expense_splits.length} {e.expense_splits.length === 1 ? "way" : "ways"}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(e.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Members with net balances */}
          <Card className="h-fit lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Members ({flatmates.length})</CardTitle>
              <Button variant="ghost" size="sm" className="-mr-2 text-primary" onClick={() => openMemberDialog(null)}>
                <UserPlus className="mr-1.5 h-4 w-4" />
                Add
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="divide-y">
                {balances.map((b) => {
                  const flatmate = flatmates.find((f) => f.id === b.id)!;
                  const status =
                    b.balance > 0.01 ? "gets back" : b.balance < -0.01 ? "owes" : "settled";
                  return (
                    <li key={b.id} className="group flex items-center gap-3 py-2.5">
                      <Avatar name={b.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{b.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          Paid {formatMoney(b.totalPaid)} · share {formatMoney(b.totalOwed)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            status === "gets back" && "text-success",
                            status === "owes" && "text-destructive",
                            status === "settled" && "text-muted-foreground"
                          )}
                        >
                          {status === "settled" ? "—" : formatMoney(Math.abs(b.balance))}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{status}</p>
                      </div>
                      <div className="flex shrink-0 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={() => openMemberDialog(flatmate)}
                          aria-label={`Edit ${b.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setPendingDelete(flatmate)}
                          disabled={deleteLoading === b.id}
                          aria-label={`Remove ${b.name}`}
                        >
                          {deleteLoading === b.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      <ExpenseFormDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        flatmates={flatmates}
        splitSpaceId={selectedSplitSpace?.id}
        onSaved={fetchAll}
      />

      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingFlatmate ? "Edit member" : "Add a member"}</DialogTitle>
            <DialogDescription>
              {editingFlatmate ? "Update their details." : `They'll be added to ${selectedSplitSpace?.name ?? "this space"}.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMemberSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="member-name">Name</Label>
              <Input
                id="member-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-email">
                Email <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="member-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-phone">
                Phone <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="member-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitLoading}>
              {submitLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : editingFlatmate ? (
                "Save changes"
              ) : (
                "Add member"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Remove ${pendingDelete?.name ?? "member"}?`}
        description={(() => {
          if (!pendingDelete) return null;
          const paid = expenses.filter((e) => e.paid_by === pendingDelete.id).length;
          const shared = expenses.filter(
            (e) => e.paid_by !== pendingDelete.id && e.expense_splits.some((s) => s.flatmate_id === pendingDelete.id)
          ).length;
          if (paid === 0 && shared === 0) return "They aren't part of any expenses. This can't be undone.";
          return (
            <>
              {paid > 0 && (
                <>
                  <span className="font-semibold text-destructive">
                    {paid} {paid === 1 ? "expense" : "expenses"} they paid will be permanently deleted.
                  </span>{" "}
                </>
              )}
              {shared > 0 &&
                `They'll also be dropped from ${shared} shared ${shared === 1 ? "expense" : "expenses"}, which changes everyone else's shares. `}
              This can't be undone.
            </>
          );
        })()}
        confirmLabel="Remove"
        onConfirm={confirmDeleteMember}
      />
    </div>
  );
};

export default Dashboard;
