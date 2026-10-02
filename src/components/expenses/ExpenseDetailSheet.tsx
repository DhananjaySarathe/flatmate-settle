import { useState } from "react";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/common/ResponsiveDialog";
import { PersonAvatar } from "@/components/common/PersonAvatar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useRefreshSpace, type Person, type SavedSettlement, type SpaceExpense } from "@/hooks/useSpaceData";
import { deleteExpense } from "@/lib/mutations";
import { errorMessage } from "@/lib/db";
import { formatDay, formatMoney, formatRange, parseDay, pluralize } from "@/lib/format";

interface ExpenseDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string | undefined;
  expense: SpaceExpense | null;
  people: Person[];
  settlements: SavedSettlement[];
  onEdit: (expense: SpaceExpense) => void;
}

/** How one expense splits: who paid, each person's share, and who owes whom for it. */
export const ExpenseDetailSheet = ({
  open,
  onOpenChange,
  spaceId,
  expense,
  people,
  settlements,
  onEdit,
}: ExpenseDetailSheetProps) => {
  const refreshSpace = useRefreshSpace();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!expense) return null;

  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? "Someone";
  const payer = nameOf(expense.paid_by);
  const splitIds = expense.expense_splits.map((s) => s.flatmate_id);
  const count = splitIds.length;
  const share = count > 0 ? expense.amount / count : 0;
  const payerInSplit = splitIds.includes(expense.paid_by);
  const covering = settlements.find((s) => s.from_date <= expense.date && expense.date <= s.to_date);

  const handleDelete = async () => {
    try {
      await deleteExpense(expense.id);
      toast.success(`Deleted “${expense.title}”`);
      await refreshSpace(spaceId);
      onOpenChange(false);
    } catch (error) {
      toast.error("Couldn't delete the expense", { description: errorMessage(error) });
      throw error;
    }
  };

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="break-words">{expense.title}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {formatDay(expense.date, "EEE, d MMM yyyy")}
              {expense.categories?.name ? ` · ${expense.categories.name}` : ""}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <ResponsiveDialogBody className="space-y-5">
            <div>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">{formatMoney(expense.amount)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Paid by <span className="font-medium text-foreground">{payer}</span>
                {count > 0 &&
                  ` · split equally between ${pluralize(count, "person", "people")}${
                    count > 1 ? `, ${formatMoney(share)} each` : ""
                  }`}
              </p>
            </div>

            {count === 0 ? (
              <div className="flex gap-3 rounded-lg bg-debit-soft px-4 py-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-debit" aria-hidden="true" />
                <p>
                  Nobody is in this split, so {payer} is credited the full {formatMoney(expense.amount)} and nobody
                  owes anything for it. Edit it to pick who shares it.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">What each person owes for this</h3>
                <ul className="divide-y rounded-lg border bg-background">
                  {splitIds.map((id) => {
                    const name = nameOf(id);
                    const isPayer = id === expense.paid_by;
                    return (
                      <li key={id} className="flex items-center gap-3 px-3 py-2.5">
                        <PersonAvatar name={name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{name}</p>
                          <p className="text-xs text-muted-foreground">
                            {isPayer
                              ? `Paid ${formatMoney(expense.amount)} · share ${formatMoney(share)}`
                              : `Owes ${payer} ${formatMoney(share)}`}
                          </p>
                        </div>
                        {isPayer ? (
                          count > 1 ? (
                            <p className="shrink-0 text-right text-sm font-semibold text-credit tabular-nums">
                              <span className="block text-[11px] font-medium leading-none">gets back</span>
                              {formatMoney(expense.amount - share)}
                            </p>
                          ) : (
                            <p className="shrink-0 text-sm text-muted-foreground">their own cost</p>
                          )
                        ) : (
                          <p className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(share)}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {!payerInSplit && (
                  <p className="text-sm text-muted-foreground">
                    {payer} isn't in the split, so they get back the full {formatMoney(expense.amount)}.
                  </p>
                )}
              </div>
            )}

            {covering && (
              <p className="rounded-lg bg-secondary px-3 py-2.5 text-sm text-muted-foreground">
                Covered by your settle-up of {formatRange(parseDay(covering.from_date), parseDay(covering.to_date))}.
              </p>
            )}
          </ResponsiveDialogBody>

          <ResponsiveDialogFooter className="sm:justify-between">
            <Button
              variant="ghost"
              className="text-debit hover:bg-debit-soft hover:text-debit"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 /> Delete
            </Button>
            <Button variant="outline" className="h-11 sm:h-10" onClick={() => onEdit(expense)}>
              <Pencil /> Edit
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete “${expense.title}”?`}
        description={
          <p>
            {formatMoney(expense.amount)} paid by {payer}
            {count > 0 ? `, split between ${pluralize(count, "person", "people")}` : ""}. Balances update right
            away. This can't be undone.
          </p>
        }
        confirmLabel="Delete expense"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
};
