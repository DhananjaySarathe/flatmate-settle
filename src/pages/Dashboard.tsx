import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  UserPlus,
  Users,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ExpenseFormDialog } from "@/components/ExpenseFormDialog";
import { PersonAvatar } from "@/components/PersonAvatar";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { SpaceFlatmate, useSpaceData } from "@/hooks/useSpaceData";
import { calculateBalances, calculateSettlements } from "@/lib/settlement";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

type Period = "unsettled" | "all";

const Dashboard = () => {
  const navigate = useNavigate();
  const { selectedSplitSpace } = useSplitSpace();
  const { flatmates, expenses, settlements, loading, needsSpace, refresh } = useSpaceData({
    withSettlements: true,
  });

  const [period, setPeriod] = useState<Period>("unsettled");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<SpaceFlatmate | null>(null);
  const [personForm, setPersonForm] = useState({ name: "", email: "", phone: "" });
  const [savingPerson, setSavingPerson] = useState(false);
  const [deletingPerson, setDeletingPerson] = useState<SpaceFlatmate | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // The most recent marked settlement closes the books up to its end date.
  const lastSettledThrough = settlements[0]?.to_date ?? null;

  const periodExpenses = useMemo(() => {
    if (period === "all" || !lastSettledThrough) return expenses;
    return expenses.filter((e) => e.date > lastSettledThrough);
  }, [expenses, period, lastSettledThrough]);

  const balances = useMemo(
    () => calculateBalances(flatmates, periodExpenses),
    [flatmates, periodExpenses]
  );
  const transfers = useMemo(() => calculateSettlements(balances), [balances]);
  const totalSpent = periodExpenses.reduce((sum, e) => sum + e.amount, 0);
  const maxAbsBalance = Math.max(1, ...balances.map((b) => Math.abs(b.balance)));
  const nameToId = useMemo(() => new Map(flatmates.map((f) => [f.name, f.id])), [flatmates]);

  // Deleting a person cascades in the database: their paid expenses and splits go with them.
  const deletingImpact = useMemo(() => {
    if (!deletingPerson) return { paid: 0, paidTotal: 0, splitIn: 0 };
    const paid = expenses.filter((e) => e.paid_by === deletingPerson.id);
    const splitIn = expenses.filter(
      (e) => e.paid_by !== deletingPerson.id && e.expense_splits.some((s) => s.flatmate_id === deletingPerson.id)
    );
    return {
      paid: paid.length,
      paidTotal: paid.reduce((sum, e) => sum + e.amount, 0),
      splitIn: splitIn.length,
    };
  }, [deletingPerson, expenses]);

  const openAddPerson = () => {
    setEditingPerson(null);
    setPersonForm({ name: "", email: "", phone: "" });
    setPersonOpen(true);
  };

  const openEditPerson = (person: SpaceFlatmate) => {
    setEditingPerson(person);
    setPersonForm({ name: person.name, email: person.email || "", phone: person.phone || "" });
    setPersonOpen(true);
  };

  const savePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = personForm.name.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    setSavingPerson(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editingPerson) {
        const { error } = await supabase
          .from("flatmates")
          .update({ name, email: personForm.email || null, phone: personForm.phone || null })
          .eq("id", editingPerson.id);
        if (error) throw error;
        toast.success(`${name} updated`);
      } else {
        const insert: any = {
          name,
          email: personForm.email || null,
          phone: personForm.phone || null,
          created_by: user.id,
        };
        if (selectedSplitSpace) insert.split_space_id = selectedSplitSpace.id;
        const { error } = await supabase.from("flatmates").insert(insert);
        if (error) throw error;
        toast.success(`${name} added`);
      }
      setPersonOpen(false);
      refresh();
    } catch (error: any) {
      toast.error(error.message);
      console.error(error);
    } finally {
      setSavingPerson(false);
    }
  };

  const confirmDeletePerson = async () => {
    if (!deletingPerson) return;
    setDeleteBusy(true);
    try {
      const { error } = await supabase.from("flatmates").delete().eq("id", deletingPerson.id);
      if (error) throw error;
      toast.success(`${deletingPerson.name} removed`);
      setDeletingPerson(null);
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

  const periodLabel =
    period === "all" || !lastSettledThrough
      ? "All time"
      : `After ${format(parseISO(lastSettledThrough), "d MMM yyyy")}`;

  const personDialog = (
    <Dialog open={personOpen} onOpenChange={setPersonOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingPerson ? "Edit person" : "Add a person"}</DialogTitle>
          <DialogDescription>
            Only the name is needed. Email lets you send them reports later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={savePerson} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="person-name">Name</Label>
            <Input
              id="person-name"
              autoFocus
              value={personForm.name}
              onChange={(e) => setPersonForm({ ...personForm, name: e.target.value })}
              placeholder="e.g. Priya"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="person-email">Email (optional)</Label>
              <Input
                id="person-email"
                type="email"
                value={personForm.email}
                onChange={(e) => setPersonForm({ ...personForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-phone">Phone (optional)</Label>
              <Input
                id="person-phone"
                type="tel"
                value={personForm.phone}
                onChange={(e) => setPersonForm({ ...personForm, phone: e.target.value })}
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={savingPerson}>
            {savingPerson && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingPerson ? "Save changes" : "Add person"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );

  // First run: nobody to split with yet.
  if (flatmates.length === 0) {
    return (
      <div className="mx-auto max-w-xl animate-fade-in py-6">
        <Card className="overflow-hidden">
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div>
              <p className="text-sm font-medium text-primary">
                {selectedSplitSpace?.name ?? "Your group"}
              </p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Let's set up your group</h1>
              <p className="mt-2 text-muted-foreground">
                Two steps and you'll always know who owes whom.
              </p>
            </div>
            <ol className="space-y-3">
              <li className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  1
                </span>
                <div className="flex-1">
                  <p className="font-medium">Add the people you split with</p>
                  <p className="text-sm text-muted-foreground">Include yourself, so your share counts too.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-xl border p-4 opacity-70">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  2
                </span>
                <div>
                  <p className="font-medium">Log what someone paid for</p>
                  <p className="text-sm text-muted-foreground">We work out each person's share.</p>
                </div>
              </li>
            </ol>
            <Button size="lg" className="w-full" onClick={openAddPerson}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add first person
            </Button>
          </CardContent>
        </Card>
        {personDialog}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Overview</p>
          <h1 className="truncate text-2xl font-bold sm:text-3xl">
            {selectedSplitSpace?.name ?? "Your group"}
          </h1>
        </div>
        <Button className="hidden shadow-md shadow-primary/20 md:inline-flex" onClick={() => setExpenseOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add expense
        </Button>
      </div>

      {/* Period switch + headline numbers */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-8">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Spent · {periodLabel}</p>
              <p className="text-2xl font-bold tabular-nums sm:text-3xl">{formatINR(totalSpent)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Expenses</p>
              <p className="text-2xl font-bold tabular-nums sm:text-3xl">{periodExpenses.length}</p>
            </div>
          </div>
          {lastSettledThrough && (
            <ToggleGroup
              type="single"
              value={period}
              onValueChange={(v) => v && setPeriod(v as Period)}
              className="self-start rounded-lg bg-secondary p-1 sm:self-auto"
            >
              <ToggleGroupItem value="unsettled" className="h-8 px-3 text-xs data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm">
                Since last settle-up
              </ToggleGroupItem>
              <ToggleGroupItem value="all" className="h-8 px-3 text-xs data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm">
                All time
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Who pays whom */}
        <Card className="min-w-0 lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-lg">Who pays whom</CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-primary">
              <Link to={period === "unsettled" && lastSettledThrough ? "/reports?period=unsettled" : "/reports"}>
                Settle up <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {transfers.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl bg-accent/10 p-4">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-accent" />
                <div>
                  <p className="font-medium">Everyone's square</p>
                  <p className="text-sm text-muted-foreground">
                    {periodExpenses.length === 0 ? "No expenses in this period yet." : "No payments needed."}
                  </p>
                </div>
              </div>
            ) : (
              <ul className="divide-y">
                {transfers.map((t, i) => (
                  <li key={i} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <PersonAvatar id={nameToId.get(t.from) ?? t.from} name={t.from} />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate font-semibold">{t.from}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        pays <span className="font-medium text-foreground">{t.to}</span>
                      </p>
                    </div>
                    <span className="whitespace-nowrap font-bold tabular-nums">{formatINR(t.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Net balances */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Balances</CardTitle>
            <p className="text-xs text-muted-foreground">Paid minus their share of the split</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[...balances]
                .sort((a, b) => b.balance - a.balance)
                .map((b) => {
                  const settled = Math.abs(b.balance) < 0.01;
                  const positive = b.balance > 0;
                  const width = settled ? 0 : (Math.abs(b.balance) / maxAbsBalance) * 50;
                  return (
                    <li key={b.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{b.name}</span>
                        <span
                          className={cn(
                            "whitespace-nowrap text-xs font-semibold tabular-nums",
                            settled ? "text-muted-foreground" : positive ? "text-accent" : "text-destructive"
                          )}
                        >
                          {settled ? "Settled" : positive ? `Is owed ${formatINR(b.balance)}` : `Owes ${formatINR(-b.balance)}`}
                        </span>
                      </div>
                      <div className="relative h-1.5 rounded-full bg-secondary">
                        <span className="absolute left-1/2 top-0 h-full w-px bg-border" />
                        {!settled && (
                          <span
                            className={cn(
                              "absolute top-0 h-full rounded-full",
                              positive ? "left-1/2 bg-accent" : "right-1/2 bg-destructive/80"
                            )}
                            style={{ width: `${width}%` }}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Recent expenses */}
        <Card className="min-w-0 lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-lg">Recent expenses</CardTitle>
            {expenses.length > 0 && (
              <Button variant="ghost" size="sm" asChild className="text-primary">
                <Link to="/expenses">
                  See all <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <div className="py-8 text-center">
                <Receipt className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
                <p className="mb-4 text-muted-foreground">Nothing logged yet.</p>
                <Button onClick={() => setExpenseOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add the first expense
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                {expenses.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => navigate("/expenses")}
                      className="flex w-full items-center gap-3 py-3 text-left first:pt-0"
                    >
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-secondary text-[10px] font-medium uppercase leading-tight text-muted-foreground">
                        <span>{format(parseISO(e.date), "MMM")}</span>
                        <span className="text-sm font-bold text-foreground">{format(parseISO(e.date), "d")}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{e.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {e.flatmates?.name ?? "Someone"} paid · split {e.expense_splits.length} ways
                        </p>
                      </div>
                      <span className="whitespace-nowrap font-semibold tabular-nums">{formatINR(e.amount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* People */}
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-4 w-4 text-muted-foreground" />
              People <span className="text-sm font-normal text-muted-foreground">{flatmates.length}</span>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={openAddPerson}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              Add
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {flatmates.map((f) => (
                <li key={f.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                  <PersonAvatar id={f.id} name={f.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    {(f.email || f.phone) && (
                      <p className="truncate text-xs text-muted-foreground">{f.email || f.phone}</p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Options for ${f.name}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditPerson(f)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingPerson(f)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <ExpenseFormDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        flatmates={flatmates}
        onSaved={refresh}
      />
      {personDialog}

      <AlertDialog open={!!deletingPerson} onOpenChange={(open) => !open && setDeletingPerson(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deletingPerson?.name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {deletingImpact.paid > 0 ? (
                  <p>
                    <span className="font-semibold text-destructive">
                      {deletingImpact.paid} expense{deletingImpact.paid === 1 ? "" : "s"} they paid (
                      {formatINR(deletingImpact.paidTotal)}) will be deleted too.
                    </span>
                  </p>
                ) : null}
                {deletingImpact.splitIn > 0 && (
                  <p>
                    They'll also be dropped from {deletingImpact.splitIn} other split
                    {deletingImpact.splitIn === 1 ? "" : "s"}, which changes everyone else's shares.
                  </p>
                )}
                <p>This can't be undone.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDeletePerson();
              }}
              disabled={deleteBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
