import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/common/ResponsiveDialog";
import { useRefreshSpace, useSavedSettlements } from "@/hooks/useSpaceData";
import { db, errorMessage } from "@/lib/db";
import { latestSettledDay, type DateRange } from "@/lib/expenseFilters";
import { addDays, format } from "date-fns";
import { formatMoney, formatRange, parseDay, pluralize, toDayKey } from "@/lib/format";
import type { Settlement } from "@/lib/settlement";

interface MarkSettledDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  range: DateRange;
  settlements: Settlement[];
  /** People/category filters are on: the marker still covers every expense in these dates. */
  filtersActive?: boolean;
}

/**
 * Saves a "this period is settled" marker (the existing settlements table).
 * It records no payments; it moves where "Since last settle-up" starts.
 */
export const MarkSettledDialog = ({
  open,
  onOpenChange,
  spaceId,
  range,
  settlements,
  filtersActive = false,
}: MarkSettledDialogProps) => {
  const refreshSpace = useRefreshSpace();
  const existing = useSavedSettlements(spaceId);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setNote("");
  }, [open]);

  const total = settlements.reduce((sum, s) => sum + s.amount, 0);
  // Home's open period starts after the LATEST marker, which may not be this one.
  const latest = [latestSettledDay(existing.data ?? []), toDayKey(range.to)].filter(Boolean).sort().pop()!;
  const freshFrom = format(addDays(parseDay(latest), 1), "d MMM");

  const save = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) throw new Error("You're signed out. Sign in again to save.");
      const { error } = await db.from("settlements").insert({
        split_space_id: spaceId,
        from_date: toDayKey(range.from),
        to_date: toDayKey(range.to),
        note: note.trim() || null,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Marked as settled", {
        description: `Home now starts from ${freshFrom}.`,
      });
      await refreshSpace(spaceId);
      onOpenChange(false);
    } catch (error) {
      toast.error("Couldn't mark as settled", { description: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Mark {formatRange(range.from, range.to)} as settled?</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Do this once everyone has paid. It saves a marker so Home starts fresh from {freshFrom}. It doesn't
            record payments or change any expense, and you can remove it later under Past settle-ups.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="space-y-4">
          {filtersActive && (
            <p className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm">
              Your filters don't apply to the marker. It covers every expense from{" "}
              {formatRange(range.from, range.to)}.
            </p>
          )}
          {settlements.length > 0 && (
            <p className="rounded-lg bg-secondary px-3 py-2.5 text-sm">
              {pluralize(settlements.length, "payment")} · {formatMoney(total)} in this period
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="settlement-note">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="settlement-note"
              placeholder="e.g. Paid over UPI, Kabir paid in cash"
              value={note}
              maxLength={280}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="hidden sm:inline-flex">
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="h-11 sm:h-10">
            {saving && <Loader2 className="animate-spin" />}
            Mark as settled
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};
