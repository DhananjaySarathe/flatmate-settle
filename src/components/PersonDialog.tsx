import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { ResponsiveModal } from "@/components/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { errorMessage, formatMoney, plural } from "@/lib/format";

export interface PersonRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface ExpenseRef {
  amount: number;
  paid_by: string;
  expense_splits: { flatmate_id: string }[];
}

interface PersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Person to edit; null to add someone new. */
  person: PersonRecord | null;
  /** All expenses in the space — used to spell out what a delete removes. */
  expenses: ExpenseRef[];
  onSaved: () => void;
}

export const PersonDialog = ({ open, onOpenChange, person, expenses, onSaved }: PersonDialogProps) => {
  const { selectedSplitSpace } = useSplitSpace();
  const [form, setForm] = useState({
    name: person?.name ?? "",
    email: person?.email ?? "",
    phone: person?.phone ?? "",
  });
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const nameError = !form.name.trim() ? "Name is required" : null;

  // Deleting a flatmate cascades in the database: expenses they paid are
  // deleted, and they drop out of every split they were in.
  const paid = person ? expenses.filter((e) => e.paid_by === person.id) : [];
  const paidTotal = paid.reduce((sum, e) => sum + e.amount, 0);
  const splitOnly = person
    ? expenses.filter(
        (e) => e.paid_by !== person.id && e.expense_splits.some((s) => s.flatmate_id === person.id)
      )
    : [];
  const hasHistory = paid.length > 0 || splitOnly.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nameError) {
      setShowErrors(true);
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (person) {
        const { error } = await supabase
          .from("flatmates")
          .update({
            name: form.name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
          })
          .eq("id", person.id);
        if (error) throw error;
        toast.success("Saved");
      } else {
        const flatmateDataToInsert: Record<string, unknown> = {
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          created_by: user.id,
        };
        // Only add split_space_id if it exists and is selected
        if (selectedSplitSpace) {
          flatmateDataToInsert.split_space_id = selectedSplitSpace.id;
        }
        const { error } = await supabase.from("flatmates").insert(flatmateDataToInsert as never);
        if (error) throw error;
        toast.success(`Added ${form.name.trim()}`);
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(errorMessage(error, "Couldn't save"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!person) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("flatmates").delete().eq("id", person.id);
      if (error) throw error;
      toast.success(`Removed ${person.name}`);
      setConfirmDelete(false);
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error(errorMessage(error, "Couldn't remove this person"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={(next) => !saving && onOpenChange(next)}
        title={person ? `Edit ${person.name}` : "Add a person"}
        description={
          person
            ? undefined
            : `They'll be available to split expenses in ${selectedSplitSpace?.name ?? "this space"}.`
        }
        footer={
          <div className="flex items-center gap-2">
            {person && (
              <Button
                type="button"
                variant="ghost"
                className="text-negative hover:bg-negative-soft hover:text-negative"
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
              >
                <Trash2 />
                Remove
              </Button>
            )}
            <div className="flex-1" />
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="hidden sm:inline-flex">
              Cancel
            </Button>
            <Button type="submit" form="person-form" disabled={saving} className="flex-1 sm:flex-none">
              {saving ? <Loader2 className="animate-spin" /> : null}
              {person ? "Save" : "Add person"}
            </Button>
          </div>
        }
      >
        <form id="person-form" onSubmit={handleSubmit} className="space-y-4 pt-1" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="person-name">Name</Label>
            <Input
              id="person-name"
              value={form.name}
              autoFocus
              autoComplete="off"
              maxLength={60}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              aria-invalid={showErrors && !!nameError}
              className={showErrors && nameError ? "border-negative" : undefined}
            />
            {showErrors && nameError && <p className="text-sm text-negative">{nameError}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="person-email">
                Email <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="person-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="person-phone">
                Phone <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="person-phone"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
        </form>
      </ResponsiveModal>

      <AlertDialog open={confirmDelete} onOpenChange={(next) => !deleting && setConfirmDelete(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {person?.name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {hasHistory ? (
                  <>
                    <p>This also changes the shared history:</p>
                    <ul className="list-disc space-y-1 pl-5">
                      {paid.length > 0 && (
                        <li>
                          <span className="font-medium text-foreground">
                            {plural(paid.length, "expense")} they paid ({formatMoney(paidTotal)})
                          </span>{" "}
                          will be deleted.
                        </li>
                      )}
                      {splitOnly.length > 0 && (
                        <li>
                          They'll be dropped from {plural(splitOnly.length, "other split")}, so everyone
                          else's share goes up.
                        </li>
                      )}
                    </ul>
                    <p>Balances are recalculated. This can't be undone.</p>
                  </>
                ) : (
                  <p>They aren't part of any expense yet. This can't be undone.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep {person?.name}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="animate-spin" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
