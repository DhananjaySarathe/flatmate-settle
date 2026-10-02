import { useMemo, useState } from "react";
import { Pencil, UserMinus } from "lucide-react";
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
import { useRefreshSpace, type Person, type SpaceExpense } from "@/hooks/useSpaceData";
import type { Balance, Settlement } from "@/lib/settlement";
import { deletePerson } from "@/lib/mutations";
import { errorMessage } from "@/lib/db";
import { balanceStatus, formatDay, formatMoney, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PersonSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  spaceName: string;
  person: Person | null;
  /** This person's balance for the period shown on the page. */
  balance: Balance | null;
  settlements: Settlement[];
  /** Expenses in the period shown on the page. */
  periodExpenses: SpaceExpense[];
  /** Every expense in the space, to explain what removing them deletes. */
  allExpenses: SpaceExpense[];
  periodLabel: string;
  nameOf: (id: string) => string;
  /** Omit (or pass readOnly) where the page shouldn't offer edit/remove. */
  onEdit?: (person: Person) => void;
  readOnly?: boolean;
}

export const PersonSheet = ({
  open,
  onOpenChange,
  spaceId,
  spaceName,
  person,
  balance,
  settlements,
  periodExpenses,
  allExpenses,
  periodLabel,
  nameOf,
  onEdit,
  readOnly = false,
}: PersonSheetProps) => {
  const refreshSpace = useRefreshSpace();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const theirExpenses = useMemo(
    () =>
      person
        ? periodExpenses.filter(
            (e) => e.paid_by === person.id || e.expense_splits.some((s) => s.flatmate_id === person.id)
          )
        : [],
    [person, periodExpenses]
  );

  // What the database cascade will take with them (all time, not just this period).
  const impact = useMemo(() => {
    if (!person) return { paidCount: 0, paidTotal: 0, sharedCount: 0 };
    const paid = allExpenses.filter((e) => e.paid_by === person.id);
    const shared = allExpenses.filter(
      (e) => e.paid_by !== person.id && e.expense_splits.some((s) => s.flatmate_id === person.id)
    );
    return {
      paidCount: paid.length,
      paidTotal: paid.reduce((sum, e) => sum + e.amount, 0),
      sharedCount: shared.length,
    };
  }, [person, allExpenses]);

  if (!person) return null;

  const status = balance ? balanceStatus(balance.balance) : "settled";
  const pays = settlements.filter((s) => s.from === person.name);
  const receives = settlements.filter((s) => s.to === person.name);

  const handleRemove = async () => {
    try {
      await deletePerson(person.id);
      toast.success(`Removed ${person.name}`, {
        description:
          impact.paidCount > 0 ? `${pluralize(impact.paidCount, "expense")} they paid were deleted too.` : undefined,
      });
      await refreshSpace(spaceId);
      onOpenChange(false);
    } catch (error) {
      toast.error(`Couldn't remove ${person.name}`, { description: errorMessage(error) });
      throw error;
    }
  };

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader className="flex items-center gap-3 space-y-0">
            <PersonAvatar name={person.name} size="lg" />
            <div className="min-w-0">
              <ResponsiveDialogTitle className="truncate">{person.name}</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {status === "gets-back" && (
                  <span className="font-medium text-credit">Gets back {formatMoney(balance!.balance)}</span>
                )}
                {status === "owes" && (
                  <span className="font-medium text-debit">Owes {formatMoney(Math.abs(balance!.balance))}</span>
                )}
                {status === "settled" && "Settled up"}
                <span className="text-muted-foreground"> · {periodLabel}</span>
              </ResponsiveDialogDescription>
            </div>
          </ResponsiveDialogHeader>

          <ResponsiveDialogBody className="space-y-5">
            <dl className="grid grid-cols-3 divide-x rounded-lg border bg-background text-center">
              {[
                { label: "Paid", value: balance?.totalPaid ?? 0 },
                { label: "Share", value: balance?.totalOwed ?? 0 },
                { label: "Net", value: balance?.balance ?? 0, signed: true },
              ].map((item) => (
                <div key={item.label} className="px-2 py-3">
                  <dt className="text-xs text-muted-foreground">{item.label}</dt>
                  <dd
                    className={cn(
                      "mt-1 text-sm font-semibold tabular-nums sm:text-base",
                      item.signed && status === "gets-back" && "text-credit",
                      item.signed && status === "owes" && "text-debit"
                    )}
                  >
                    {formatMoney(item.value, { signed: item.signed })}
                  </dd>
                </div>
              ))}
            </dl>

            {(pays.length > 0 || receives.length > 0) && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">To settle up</h3>
                <ul className="space-y-1.5 text-sm">
                  {pays.map((s, i) => (
                    <li key={`p-${i}`} className="flex justify-between gap-3">
                      <span>
                        Pays <span className="font-medium">{s.to}</span>
                      </span>
                      <span className="font-semibold tabular-nums text-debit">{formatMoney(s.amount)}</span>
                    </li>
                  ))}
                  {receives.map((s, i) => (
                    <li key={`r-${i}`} className="flex justify-between gap-3">
                      <span>
                        Gets from <span className="font-medium">{s.from}</span>
                      </span>
                      <span className="font-semibold tabular-nums text-credit">{formatMoney(s.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                Expenses they're part of{" "}
                <span className="font-normal text-muted-foreground">({theirExpenses.length})</span>
              </h3>
              {theirExpenses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing in this period.</p>
              ) : (
                <ul className="divide-y rounded-lg border bg-background">
                  {theirExpenses.map((e) => {
                    const inSplit = e.expense_splits.some((s) => s.flatmate_id === person.id);
                    const share = inSplit ? e.amount / e.expense_splits.length : 0;
                    return (
                      <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{e.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatDay(e.date, "d MMM")} ·{" "}
                            {e.paid_by === person.id ? "they paid" : `${nameOf(e.paid_by)} paid`}{" "}
                            {formatMoney(e.amount)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums">{formatMoney(share)}</p>
                          <p className="text-[11px] text-muted-foreground">their share</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </ResponsiveDialogBody>

          {!readOnly && (
            <ResponsiveDialogFooter className="sm:justify-between">
              <Button
                variant="ghost"
                className="text-debit hover:bg-debit-soft hover:text-debit"
                onClick={() => setConfirmRemove(true)}
              >
                <UserMinus /> Remove
              </Button>
              {onEdit && (
                <Button variant="outline" onClick={() => onEdit(person)}>
                  <Pencil /> Edit details
                </Button>
              )}
            </ResponsiveDialogFooter>
          )}
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${person.name} from ${spaceName}?`}
        description={
          impact.paidCount === 0 && impact.sharedCount === 0 ? (
            <p>{person.name} isn't part of any expenses, so no balances change.</p>
          ) : (
            <>
              <p>This can't be undone. Removing {person.name} also:</p>
              <ul className="list-disc space-y-1 pl-5 text-foreground">
                {impact.paidCount > 0 && (
                  <li>
                    <strong>deletes {pluralize(impact.paidCount, "expense")}</strong> they paid (
                    {formatMoney(impact.paidTotal)} in total)
                  </li>
                )}
                {impact.sharedCount > 0 && (
                  <li>
                    takes them out of {pluralize(impact.sharedCount, "other expense")}, so everyone else's
                    shares go up
                  </li>
                )}
              </ul>
            </>
          )
        }
        confirmLabel={
          impact.paidCount > 0 ? `Remove and delete ${pluralize(impact.paidCount, "expense")}` : `Remove ${person.name}`
        }
        destructive
        onConfirm={handleRemove}
      />
    </>
  );
};
