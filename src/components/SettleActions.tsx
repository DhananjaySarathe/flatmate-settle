import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { useRefreshSpaceData } from "@/hooks/useSpaceData";
import { deleteSettlement, markSettled } from "@/lib/mutations";
import { copyText } from "@/lib/shareText";
import { errorMessage, type SavedSettlement } from "@/lib/db";
import { formatRange, parseDateOnly } from "@/lib/format";

interface MarkSettledDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  range: { from: Date; to: Date };
  /** People/category filters don't get saved with a settled period; say so when they're on. */
  filtersActive?: boolean;
  /** Already-settled periods this range overlaps. */
  overlapping?: SavedSettlement[];
}

export const MarkSettledDialog = ({
  open,
  onOpenChange,
  spaceId,
  range,
  filtersActive,
  overlapping = [],
}: MarkSettledDialogProps) => {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const refresh = useRefreshSpaceData();

  const save = async () => {
    setSaving(true);
    try {
      const id = await markSettled(spaceId, range, note);
      await refresh(["settlements"]);
      toast.success("Marked as settled", {
        description: formatRange(range.from, range.to),
        duration: 8000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await deleteSettlement(id);
              await refresh(["settlements"]);
              toast("Settled period removed");
            } catch (error) {
              toast.error(`Couldn't undo: ${errorMessage(error)}`);
            }
          },
        },
      });
      setNote("");
      onOpenChange(false);
    } catch (error) {
      toast.error(`Couldn't mark as settled: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => !saving && onOpenChange(next)}
      title="Mark as settled?"
      description={formatRange(range.from, range.to)}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="min-w-32">
            {saving && <Loader2 className="animate-spin" />}
            Mark as settled
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          This records that everyone has paid up for these dates. Nothing is deleted, and the next settle-up starts the
          day after.
        </p>
        {overlapping.length > 0 && (
          <p className="rounded-lg bg-negative/10 px-3 py-2.5 text-negative">
            This overlaps{" "}
            {overlapping.map((o) => formatRange(parseDateOnly(o.from_date), parseDateOnly(o.to_date))).join(", ")}, which
            {overlapping.length === 1 ? " is" : " are"} already marked settled. Check nobody pays for those expenses twice.
          </p>
        )}
        {filtersActive && (
          <p className="rounded-lg bg-secondary px-3 py-2.5">
            Filters aren't saved with a settled period. The whole date range is marked as settled.
          </p>
        )}
        <div className="space-y-1.5">
          <label htmlFor="settlement-note" className="font-medium">
            Note <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="settlement-note"
            placeholder="e.g. Paid over UPI, Kabir still owes ₹200"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={280}
          />
        </div>
      </div>
    </ResponsiveDialog>
  );
};

/** Inline result after creating a link, so nobody has to dig through a dialog. */
export const ShareLinkResult = ({ url, onDismiss }: { url: string; onDismiss: () => void }) => {
  const [copied, setCopied] = useState(true);
  return (
    <div className="rounded-lg border bg-secondary/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Read-only link</p>
        <button type="button" onClick={onDismiss} className="text-xs text-muted-foreground hover:text-foreground">
          Done
        </button>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        A snapshot of this period. Later changes won't show up for people who open it.
      </p>
      <div className="mt-2.5 flex items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Share link"
          className="h-9 min-w-0 flex-1 rounded-md border bg-card px-2.5 text-sm text-muted-foreground outline-none focus:border-primary"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const ok = await copyText(url);
            setCopied(ok);
            if (ok) toast.success("Link copied");
            else toast.error("Couldn't copy. Select the link and copy it manually.");
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink />
            <span className="sr-only">Open link</span>
          </a>
        </Button>
      </div>
    </div>
  );
};
