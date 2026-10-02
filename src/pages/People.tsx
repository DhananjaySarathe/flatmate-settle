import { FormEvent, useMemo, useState } from "react";
import { Loader2, Mail, Pencil, Phone, Plus, RotateCw, Trash2, UserRoundCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { PageHeader } from "@/components/PageHeader";
import { PersonAvatar } from "@/components/PersonAvatar";
import { EmptyState } from "@/components/EmptyState";
import { useRefreshSpaceData, useSpaceData, type Flatmate } from "@/hooks/useSpaceData";
import { useMe } from "@/hooks/useMe";
import { createFlatmate, deleteFlatmate, updateFlatmate, type FlatmateDraft } from "@/lib/mutations";
import { errorMessage } from "@/lib/db";
import { formatMoney, plural } from "@/lib/format";
import { cn } from "@/lib/utils";

const EMPTY: FlatmateDraft = { name: "", email: "", phone: "" };

const People = () => {
  const { flatmates, expenses, space, spaceId, isLoading, error, refetch } = useSpaceData();
  const { meId, setMe } = useMe(flatmates);
  const refresh = useRefreshSpaceData();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Flatmate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const stats = useMemo(() => {
    const map = new Map<string, { paidCount: number; paidTotal: number; splitCount: number; otherSplits: number }>();
    for (const f of flatmates) map.set(f.id, { paidCount: 0, paidTotal: 0, splitCount: 0, otherSplits: 0 });
    for (const e of expenses) {
      const payer = map.get(e.paid_by);
      if (payer) {
        payer.paidCount += 1;
        payer.paidTotal += e.amount;
      }
      for (const s of e.expense_splits) {
        const p = map.get(s.flatmate_id);
        if (!p) continue;
        p.splitCount += 1;
        if (e.paid_by !== s.flatmate_id) p.otherSplits += 1;
      }
    }
    return map;
  }, [flatmates, expenses]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteFlatmate(toDelete.id);
      if (toDelete.id === meId) setMe(null);
      await refresh(["flatmates", "expenses"]);
      toast.success(`Removed ${toDelete.name}`);
      setToDelete(null);
    } catch (err) {
      toast.error(`Couldn't remove ${toDelete.name}: ${errorMessage(err)}`);
    } finally {
      setDeleting(false);
    }
  };

  const deleteStats = toDelete ? stats.get(toDelete.id) : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="People"
        description={
          <>
            {space ? `Everyone splitting costs in ${space.name}. ` : ""}Names are enough: nobody gets an account or an
            invite.
          </>
        }
      />

      <AddPerson spaceId={spaceId} />

      <section className="rounded-2xl border bg-card px-5 sm:px-6">
        {isLoading ? (
          <div className="space-y-3 py-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <EmptyState icon={RotateCw} title="Couldn't load people" action={<Button onClick={refetch}>Try again</Button>}>
            {errorMessage(error)}
          </EmptyState>
        ) : flatmates.length === 0 ? (
          <EmptyState icon={Users} title="No one here yet">
            Add the people you share costs with, starting with yourself.
          </EmptyState>
        ) : (
          <ul className="divide-y">
            {flatmates.map((f) => {
              const s = stats.get(f.id);
              const isMe = f.id === meId;
              if (editingId === f.id) {
                return (
                  <li key={f.id} className="py-4">
                    <EditPerson person={f} onDone={() => setEditingId(null)} />
                  </li>
                );
              }
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-4">
                  <PersonAvatar name={f.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{f.name}</span>
                      {isMe && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          You
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                      {s && s.splitCount + s.paidCount > 0 ? (
                        <span className="tabular-nums">
                          Paid {formatMoney(s.paidTotal)} · in {plural(s.splitCount, "expense")}
                        </span>
                      ) : (
                        <span>No expenses yet</span>
                      )}
                      {f.email && (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <Mail className="size-3.5 shrink-0" />
                          <span className="truncate">{f.email}</span>
                        </span>
                      )}
                      {f.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3.5" />
                          {f.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex w-full items-center justify-end gap-1 sm:w-auto">
                    {!isMe && (
                      <Button variant="ghost" size="sm" onClick={() => setMe(f.id)} className="text-muted-foreground">
                        <UserRoundCheck />
                        This is me
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingId(f.id)}
                      className="size-9 text-muted-foreground"
                      aria-label={`Edit ${f.name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setToDelete(f)}
                      className="size-9 text-muted-foreground hover:bg-negative/10 hover:text-negative"
                      aria-label={`Remove ${f.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {deleteStats && deleteStats.paidCount + deleteStats.otherSplits > 0 ? (
                  <>
                    <p>This also changes the money history:</p>
                    <ul className="list-disc space-y-1 pl-5 text-foreground">
                      {deleteStats.paidCount > 0 && (
                        <li>
                          {plural(deleteStats.paidCount, "expense")} {toDelete?.name} paid (
                          {formatMoney(deleteStats.paidTotal)}) will be deleted.
                        </li>
                      )}
                      {deleteStats.otherSplits > 0 && (
                        <li>
                          They'll be taken out of {plural(deleteStats.otherSplits, "other expense")}, and those costs
                          get split between the people left.
                        </li>
                      )}
                    </ul>
                    <p>Everyone's balances will change. This can't be undone.</p>
                  </>
                ) : (
                  <p>{toDelete?.name} isn't part of any expense yet. This can't be undone.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep {toDelete?.name}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-negative text-white hover:bg-negative/90"
            >
              {deleting && <Loader2 className="animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const AddPerson = ({ spaceId }: { spaceId: string | null }) => {
  const [draft, setDraft] = useState<FlatmateDraft>(EMPTY);
  const [showDetails, setShowDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const refresh = useRefreshSpaceData();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    setSaving(true);
    try {
      await createFlatmate(spaceId, { name, email: draft.email.trim(), phone: draft.phone.trim() });
      await refresh(["flatmates"]);
      toast.success(`Added ${name}`);
      setDraft(EMPTY);
      setShowDetails(false);
    } catch (err) {
      toast.error(`Couldn't add ${name}: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border bg-card p-4 sm:p-5">
      <label htmlFor="new-person" className="text-sm font-medium">
        Add a person
      </label>
      <div className="mt-2 flex gap-2">
        <Input
          id="new-person"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Name"
          autoComplete="off"
          maxLength={60}
          className="h-10"
        />
        <Button type="submit" disabled={saving || !draft.name.trim()}>
          {saving ? <Loader2 className="animate-spin" /> : <Plus />}
          Add
        </Button>
      </div>
      {showDetails ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            placeholder="Email (optional)"
            aria-label="Email (optional)"
            autoComplete="off"
          />
          <Input
            type="tel"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            placeholder="Phone (optional)"
            aria-label="Phone (optional)"
            autoComplete="off"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="mt-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Add email or phone
        </button>
      )}
    </form>
  );
};

const EditPerson = ({ person, onDone }: { person: Flatmate; onDone: () => void }) => {
  const [draft, setDraft] = useState<FlatmateDraft>({
    name: person.name,
    email: person.email ?? "",
    phone: person.phone ?? "",
  });
  const [saving, setSaving] = useState(false);
  const refresh = useRefreshSpaceData();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const name = draft.name.trim();
    if (!name) {
      toast.error("A name is required");
      return;
    }
    setSaving(true);
    try {
      await updateFlatmate(person.id, { name, email: draft.email.trim(), phone: draft.phone.trim() });
      await refresh(["flatmates", "expenses"]);
      toast.success("Saved");
      onDone();
    } catch (err) {
      toast.error(`Couldn't save: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3" onKeyDown={(e) => e.key === "Escape" && onDone()}>
      <div className="flex items-center gap-3">
        <PersonAvatar name={draft.name || person.name} size="lg" />
        <Input
          autoFocus
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          aria-label="Name"
          maxLength={60}
          className="h-10"
        />
      </div>
      <div className={cn("grid gap-2 pl-[3.25rem] sm:grid-cols-2")}>
        <Input
          type="email"
          value={draft.email}
          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          placeholder="Email (optional)"
          aria-label="Email"
        />
        <Input
          type="tel"
          value={draft.phone}
          onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          placeholder="Phone (optional)"
          aria-label="Phone"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  );
};

export default People;
