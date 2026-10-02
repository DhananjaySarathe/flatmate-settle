import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Share } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/common/ResponsiveDialog";
import type { Json } from "@/integrations/supabase/types";
import { buildShareSnapshot, type BuildSnapshotInput } from "@/lib/settlement";
import { db, errorMessage } from "@/lib/db";
import { copyText } from "@/lib/clipboard";
import { formatRange, parseDay } from "@/lib/format";

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  space: { id: string; name: string };
  /** Exactly what the Settle up page is showing; frozen into the snapshot. */
  snapshotInput: BuildSnapshotInput;
}

/**
 * Creating a public link writes a shared_reports row, so it's a deliberate
 * second step rather than something a single menu tap does.
 */
export const ShareLinkDialog = ({ open, onOpenChange, space, snapshotInput }: ShareLinkDialogProps) => {
  const [creating, setCreating] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    if (open) {
      setUrl(null);
      setCopied(false);
      setCopyFailed(false);
    }
  }, [open]);

  const period = formatRange(parseDay(snapshotInput.dateRange.from), parseDay(snapshotInput.dateRange.to));
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const create = async () => {
    setCreating(true);
    try {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) throw new Error("You're signed out. Sign in again to share.");

      const snapshot = buildShareSnapshot(snapshotInput);
      const token = crypto.randomUUID().replace(/-/g, "");
      const { error } = await db.from("shared_reports").insert({
        token,
        split_space_id: space.id,
        split_space_name: space.name,
        from_date: snapshotInput.dateRange.from,
        to_date: snapshotInput.dateRange.to,
        snapshot: snapshot as unknown as Json,
        created_by: user.id,
      });
      if (error) throw error;

      const link = `${window.location.origin}/share/${token}`;
      setUrl(link);
      const ok = await copyText(link);
      setCopied(ok);
      setCopyFailed(!ok);
    } catch (err) {
      toast.error("Couldn't create a link", { description: errorMessage(err) });
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    const ok = await copyText(url);
    setCopied(ok);
    setCopyFailed(!ok);
  };

  const share = async () => {
    if (!url) return;
    try {
      await navigator.share({ title: `${space.name} · settle up`, text: `Who pays whom for ${period}`, url });
    } catch {
      // Dismissed by the user; nothing to do.
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={(next) => !creating && onOpenChange(next)}>
      <ResponsiveDialogContent>
        {url === null ? (
          <>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Create a public link?</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                Anyone with the link can see names, payments, balances and expenses for {period}. It's a snapshot,
                so later changes won't show up.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <ResponsiveDialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating} className="hidden sm:inline-flex">
                Cancel
              </Button>
              <Button onClick={create} disabled={creating} className="h-11 sm:h-10">
                {creating && <Loader2 className="animate-spin" />}
                {creating ? "Creating…" : "Create link"}
              </Button>
            </ResponsiveDialogFooter>
          </>
        ) : (
          <>
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Link ready</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {copied ? "Copied to your clipboard. " : ""}Send it to anyone who needs to see {period}.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <ResponsiveDialogBody className="space-y-2">
              <div className="flex gap-2">
                <Input value={url} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Public link" />
                <Button variant="outline" onClick={copy} className="shrink-0">
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              {copyFailed && (
                <p className="text-sm text-muted-foreground">Couldn't copy. Select the link and copy it manually.</p>
              )}
            </ResponsiveDialogBody>
            <ResponsiveDialogFooter>
              {canShare && (
                <Button variant="outline" onClick={share}>
                  <Share /> Share…
                </Button>
              )}
              <Button onClick={() => onOpenChange(false)} className="h-11 sm:h-10">
                Done
              </Button>
            </ResponsiveDialogFooter>
          </>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};
