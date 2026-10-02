import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { addDays, format } from "date-fns";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowRight, Loader2, Pencil, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { useExpenseDialog } from "@/contexts/ExpenseDialogContext";
import { useSpaceData, SpaceFlatmate } from "@/hooks/useSpaceData";
import { calculateBalances, calculateSettlements } from "@/lib/settlement";
import { errorMessage, formatMoney, parseDay } from "@/lib/format";
import type { TablesInsert } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/common/PageHeader";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { SettleUpList } from "@/components/balances/SettleUpList";
import { BalanceList } from "@/components/balances/BalanceList";
import { ExpenseRow } from "@/components/expenses/ExpenseRow";
import { cn } from "@/lib/utils";

type Period = "unsettled" | "all";

const Dashboard = () => {
  const { selectedSplitSpace } = useSplitSpace();
  const { openAddExpense, openEditExpense } = useExpenseDialog();
  const { flatmates, expenses, savedSettlements, loading, refetch } = useSpaceData();
  const location = useLocation();

  const [period, setPeriod] = useState<Period>("unsettled");
  const [personDialog, setPersonDialog] = useState<{ open: boolean; editing: SpaceFlatmate | null }>({
    open: false,
    editing: null,
  });
  const [deleting, setDeleting] = useState<SpaceFlatmate | null>(null);

  // Most recent day that's been marked as settled on the Settle up page.
  const lastSettledDay = useMemo(() => {
    if (savedSettlements.length === 0) return null;
    return savedSettlements.map((s) => s.to_date.slice(0, 10)).sort().pop()!;
  }, [savedSettlements]);

  const effectivePeriod: Period = lastSettledDay ? period : "all";

  const periodExpenses = useMemo(
    () =>
      effectivePeriod === "unsettled" && lastSettledDay
        ? expenses.filter((e) => e.date.slice(0, 10) > lastSettledDay)
        : expenses,
    [expenses, effectivePeriod, lastSettledDay]
  );

  const balances = useMemo(() => calculateBalances(flatmates, periodExpenses), [flatmates, periodExpenses]);
  const settlements = useMemo(() => calculateSettlements(balances), [balances]);
  const total = periodExpenses.reduce((s, e) => s + e.amount, 0);

  const nameById = useMemo(() => new Map(flatmates.map((f) => [f.id, f.name])), [flatmates]);
  const nameOf = (id: string) => nameById.get(id) ?? "Unknown";

  // Support /dashboard#people links (e.g. from the add-expense sheet).
  useEffect(() => {
    if (!loading && location.hash === "#people") {
      document.getElementById("people")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading, location.hash]);

  // Deleting a flatmate cascades in the database: expenses they paid and their
  // split entries go with them. Spell that out before anyone confirms.
  const deleteImpact = useMemo(() => {
    if (!deleting) return "";
    const paid = expenses.filter((e) => e.paid_by === deleting.id);
    const splitIn = expenses.filter(
      (e) => e.paid_by !== deleting.id && e.expense_splits.some((s) => s.flatmate_id === deleting.id)
    ).length;
    if (paid.length === 0 && splitIn === 0) {
      return `${deleting.name} isn't part of any expenses, so nothing else changes.`;
    }
    const parts: string[] = [];
    if (paid.length > 0) {
      parts.push(
        `permanently delete the ${paid.length} expense${paid.length === 1 ? "" : "s"} they paid for (${formatMoney(
          paid.reduce((s, e) => s + e.amount, 0)
        )})`
      );
    }
    if (splitIn > 0) {
      parts.push(`take them out of ${splitIn} other split${splitIn === 1 ? "" : "s"}, so others' shares go up`);
    }
    return `This will also ${parts.join(" and ")}. This can't be undone.`;
  }, [deleting, expenses]);

  const handleDeletePerson = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("flatmates").delete().eq("id", deleting.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${deleting.name} removed`);
    refetch();
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-9 w-48" />
        <div className="grid gap-6 lg:grid-cols-5">
          <Skeleton className="h-64 lg:col-span-3" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  const noPeople = flatmates.length === 0;
  const noExpenses = expenses.length === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <PageHeader
        title="Overview"
        description={selectedSplitSpace ? `Where things stand in ${selectedSplitSpace.name}.` : undefined}
      />

      {noPeople ? (
        <GettingStarted step={1} onAddPerson={() => setPersonDialog({ open: true, editing: null })} />
      ) : noExpenses ? (
        <GettingStarted step={2} onAddExpense={openAddExpense} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Who pays whom — the main answer this app gives */}
          <Card className="lg:col-span-3">
            <CardHeader className="space-y-3 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-lg">Settle up</CardTitle>
                {lastSettledDay && (
                  <div className="inline-flex rounded-lg bg-secondary p-0.5 text-xs font-medium" role="tablist">
                    {(
                      [
                        ["unsettled", "Since last settlement"],
                        ["all", "All time"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        role="tab"
                        aria-selected={effectivePeriod === value}
                        onClick={() => setPeriod(value)}
                        className={cn(
                          "rounded-md px-2.5 py-1.5 transition-colors",
                          effectivePeriod === value
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <div>
                  <p className="text-3xl font-bold tabular-nums">{formatMoney(total)}</p>
                  <p className="text-xs text-muted-foreground">
                    {periodExpenses.length} expense{periodExpenses.length === 1 ? "" : "s"}
                    {effectivePeriod === "unsettled" && lastSettledDay
                      ? ` since ${format(addDays(parseDay(lastSettledDay), 1), "d MMM yyyy")}`
                      : " in total"}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettleUpList
                settlements={settlements}
                emptyText={
                  periodExpenses.length === 0
                    ? "Nothing new since the last settlement."
                    : "Everyone's square. No payments needed."
                }
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-sm">
                <p className="text-muted-foreground">
                  {lastSettledDay
                    ? `Last settled up to ${format(parseDay(lastSettledDay), "d MMM yyyy")}.`
                    : "Paid everyone back? Mark it settled so the next round starts fresh."}
                </p>
                <Button asChild variant="link" className="h-auto p-0">
                  <Link to="/reports">
                    Reports & mark settled <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Balances</CardTitle>
              <p className="text-xs text-muted-foreground">What each person paid vs. their share.</p>
            </CardHeader>
            <CardContent>
              <BalanceList balances={balances} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg">Recent expenses</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/expenses">
                  See all <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="divide-y divide-border/70 pt-0">
              {expenses.slice(0, 5).map((e) => (
                <ExpenseRow key={e.id} expense={e} nameOf={nameOf} onSelect={openEditExpense} />
              ))}
            </CardContent>
          </Card>

          <PeopleCard
            className="lg:col-span-2"
            flatmates={flatmates}
            onAdd={() => setPersonDialog({ open: true, editing: null })}
            onEdit={(f) => setPersonDialog({ open: true, editing: f })}
            onDelete={setDeleting}
          />
        </div>
      )}

      {!noPeople && noExpenses && (
        <PeopleCard
          flatmates={flatmates}
          onAdd={() => setPersonDialog({ open: true, editing: null })}
          onEdit={(f) => setPersonDialog({ open: true, editing: f })}
          onDelete={setDeleting}
        />
      )}

      <PersonFormDialog
        open={personDialog.open}
        editing={personDialog.editing}
        onOpenChange={(open) => setPersonDialog((d) => ({ ...d, open }))}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Remove ${deleting?.name ?? "this person"}?`}
        description={deleteImpact}
        confirmLabel="Remove"
        onConfirm={handleDeletePerson}
      />
    </div>
  );
};

const GettingStarted = ({
  step,
  onAddPerson,
  onAddExpense,
}: {
  step: 1 | 2;
  onAddPerson?: () => void;
  onAddExpense?: () => void;
}) => (
  <Card>
    <CardContent className="space-y-6 p-6 sm:p-8">
      <div>
        <h2 className="text-xl font-semibold">
          {step === 1 ? "Start by adding who you share costs with" : "Now log the first expense"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Two steps and you'll see who owes whom — worked out automatically.
        </p>
      </div>
      <ol className="space-y-3">
        {[
          { n: 1, title: "Add people", body: "Flatmates, friends, travel buddies — include yourself." },
          { n: 2, title: "Log expenses", body: "Who paid, how much, and who it's split between." },
        ].map((s) => (
          <li key={s.n} className="flex gap-3">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                s.n < step
                  ? "bg-success text-success-foreground"
                  : s.n === step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {s.n}
            </span>
            <div>
              <p className={cn("font-medium", s.n > step && "text-muted-foreground")}>{s.title}</p>
              <p className="text-sm text-muted-foreground">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      {step === 1 ? (
        <Button onClick={onAddPerson} size="lg">
          <UserPlus className="mr-2 h-4 w-4" />
          Add a person
        </Button>
      ) : (
        <Button onClick={onAddExpense} size="lg">
          <Plus className="mr-2 h-4 w-4" />
          Add an expense
        </Button>
      )}
    </CardContent>
  </Card>
);

const PeopleCard = ({
  flatmates,
  onAdd,
  onEdit,
  onDelete,
  className,
}: {
  flatmates: SpaceFlatmate[];
  onAdd: () => void;
  onEdit: (f: SpaceFlatmate) => void;
  onDelete: (f: SpaceFlatmate) => void;
  className?: string;
}) => (
  <Card id="people" className={cn("scroll-mt-20", className)}>
    <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="flex items-center gap-2 text-lg">
        <Users className="h-4 w-4 text-muted-foreground" />
        People
        <span className="text-sm font-normal text-muted-foreground">({flatmates.length})</span>
      </CardTitle>
      <Button variant="outline" size="sm" onClick={onAdd}>
        <UserPlus className="mr-1.5 h-4 w-4" />
        Add
      </Button>
    </CardHeader>
    <CardContent className="pt-0">
      <ul className="divide-y divide-border/70">
        {flatmates.map((f) => (
          <li key={f.id} className="group flex items-center gap-3 py-2.5">
            <PersonAvatar name={f.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{f.name}</p>
              {(f.email || f.phone) && (
                <p className="truncate text-xs text-muted-foreground">{f.email || f.phone}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-0.5 sm:opacity-60 sm:group-hover:opacity-100">
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onEdit(f)} aria-label={`Edit ${f.name}`}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(f)}
                aria-label={`Remove ${f.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
);

const PersonFormDialog = ({
  open,
  editing,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  editing: SpaceFlatmate | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) => {
  const { selectedSplitSpace } = useSplitSpace();
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData({
        name: editing?.name ?? "",
        email: editing?.email ?? "",
        phone: editing?.phone ?? "",
      });
    }
  }, [open, editing]);

  const handleSubmit = async (e: React.FormEvent, addAnother = false) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editing) {
        const { error } = await supabase
          .from("flatmates")
          .update({
            name: formData.name.trim(),
            email: formData.email || null,
            phone: formData.phone || null,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Saved");
      } else {
        const flatmateDataToInsert: TablesInsert<"flatmates"> & { split_space_id?: string } = {
          name: formData.name.trim(),
          email: formData.email || null,
          phone: formData.phone || null,
          created_by: user.id,
        };
        if (selectedSplitSpace) {
          flatmateDataToInsert.split_space_id = selectedSplitSpace.id;
        }
        const { error } = await supabase.from("flatmates").insert(flatmateDataToInsert);
        if (error) throw error;
        toast.success(`${formData.name.trim()} added`);
      }

      onSaved();
      if (addAnother && !editing) {
        setFormData({ name: "", email: "", phone: "" });
        document.getElementById("person-name")?.focus();
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      toast.error(errorMessage(error));
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.name}` : "Add a person"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update their details."
              : `They'll be available to split expenses with${selectedSplitSpace ? ` in ${selectedSplitSpace.name}` : ""}.`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="person-name">Name</Label>
            <Input
              id="person-name"
              autoFocus
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Priya"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="person-email">
                Email <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="person-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-phone">
                Phone <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="person-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            {!editing && (
              <Button type="button" variant="outline" disabled={submitting} onClick={(e) => handleSubmit(e, true)}>
                Save & add another
              </Button>
            )}
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save" : "Add person"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default Dashboard;
