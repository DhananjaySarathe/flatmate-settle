import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Layers, Loader2, Pencil, Plus, Receipt, Trash2, Users } from "lucide-react";
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
import { EmptyState } from "@/components/EmptyState";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { db, errorCode, errorMessage } from "@/lib/db";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";

interface SplitSpace {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

interface Counts {
  flatmates: number;
  expenses: number;
}

const fetchCounts = async (spaces: SplitSpace[]): Promise<Record<string, Counts>> => {
  const entries = await Promise.all(
    spaces.map(async (space) => {
      const [flatmatesRes, expensesRes] = await Promise.all([
        db.from("flatmates").select("id", { count: "exact", head: true }).eq("split_space_id", space.id),
        db.from("expenses").select("id", { count: "exact", head: true }).eq("split_space_id", space.id),
      ]);
      return [space.id, { flatmates: flatmatesRes.count || 0, expenses: expensesRes.count || 0 }] as const;
    })
  );
  return Object.fromEntries(entries);
};

const SplitSpaces = () => {
  const { splitSpaces, refreshSplitSpaces, selectedSplitSpace, setSelectedSplitSpace, loading } = useSplitSpace();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<SplitSpace | null>(null);
  const [deleting, setDeleting] = useState(false);
  const createRef = useRef<HTMLInputElement>(null);

  const countsQuery = useQuery({
    queryKey: ["space-counts", splitSpaces.map((s) => s.id).join(",")],
    queryFn: () => fetchCounts(splitSpaces),
    enabled: !loading && splitSpaces.length > 0,
    // Counts gate deletion, so never trust a cached copy.
    staleTime: 0,
    refetchOnMount: "always",
  });
  const counts = countsQuery.data ?? {};

  // The space switcher's "New space" lands here with ?new=1.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      createRef.current?.focus();
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) throw new Error("You're signed out. Sign in again to continue.");
      const { data, error } = await db
        .from("split_spaces")
        .insert({ name, created_by: user.id })
        .select()
        .single();
      if (error) {
        if (errorCode(error) === "23505") {
          toast.error(`You already have a space called “${name}”.`);
          return;
        }
        throw error;
      }
      await refreshSplitSpaces();
      setNewName("");
      const created = data as SplitSpace;
      toast.success(`Created ${name}`, {
        action: {
          label: "Switch to it",
          onClick: () => {
            setSelectedSplitSpace(created);
            navigate("/dashboard");
          },
        },
      });
    } catch (err) {
      toast.error(`Couldn't create the space: ${errorMessage(err)}`);
    } finally {
      setCreating(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    const c = counts[toDelete.id];
    // Same rules as before: Default stays, and spaces with people or expenses must be emptied first.
    if (toDelete.name === "Default" || !c || c.flatmates > 0 || c.expenses > 0) return;
    setDeleting(true);
    try {
      // Deleting a space cascades to its people and expenses, so re-check it's empty right now.
      const fresh = (await fetchCounts([toDelete]))[toDelete.id];
      if (!fresh || fresh.flatmates > 0 || fresh.expenses > 0) {
        await queryClient.invalidateQueries({ queryKey: ["space-counts"] });
        toast.error(`${toDelete.name} isn't empty any more, so it wasn't deleted.`);
        setToDelete(null);
        return;
      }
      const { error } = await db.from("split_spaces").delete().eq("id", toDelete.id);
      if (error) throw error;
      if (selectedSplitSpace?.id === toDelete.id) {
        const remaining = splitSpaces.filter((s) => s.id !== toDelete.id);
        const fallback = remaining.find((s) => s.name === "Default") || remaining[0];
        if (fallback) setSelectedSplitSpace(fallback);
      }
      await refreshSplitSpaces();
      await queryClient.invalidateQueries({ queryKey: ["space-counts"] });
      toast.success(`Deleted ${toDelete.name}`);
      setToDelete(null);
    } catch (err) {
      toast.error(`Couldn't delete the space: ${errorMessage(err)}`);
    } finally {
      setDeleting(false);
    }
  };

  const deleteCounts = toDelete ? counts[toDelete.id] : undefined;
  const blocked =
    !!toDelete && (toDelete.name === "Default" || !deleteCounts || deleteCounts.flatmates > 0 || deleteCounts.expenses > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Spaces" description="Each space keeps its own people, expenses and settled periods." />

      <form onSubmit={create} className="rounded-2xl border bg-card p-4 sm:p-5">
        <label htmlFor="new-space" className="text-sm font-medium">
          New space
        </label>
        <div className="mt-2 flex gap-2">
          <Input
            ref={createRef}
            id="new-space"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Flat 404, Goa trip, Office lunches"
            maxLength={60}
            autoComplete="off"
          />
          <Button type="submit" disabled={creating || !newName.trim()}>
            {creating ? <Loader2 className="animate-spin" /> : <Plus />}
            Create
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : splitSpaces.length === 0 ? (
        <EmptyState icon={Layers} title="No spaces yet" className="rounded-2xl border bg-card">
          Create one above for your flat, a trip or anything else you split.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {splitSpaces.map((space) => {
            const current = selectedSplitSpace?.id === space.id;
            const c = counts[space.id];
            return (
              <li
                key={space.id}
                className={cn("rounded-2xl border bg-card p-4 sm:p-5", current && "border-primary/50 ring-1 ring-primary/30")}
              >
                {renamingId === space.id ? (
                  <RenameForm
                    space={space}
                    onDone={() => setRenamingId(null)}
                    onSaved={async () => {
                      await refreshSplitSpaces();
                      setRenamingId(null);
                    }}
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 font-semibold text-primary">
                      {space.name.trim()[0]?.toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{space.name}</span>
                        {current && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            <Check className="size-3" />
                            Current
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex gap-3 text-sm text-muted-foreground">
                        {c ? (
                          <>
                            <span className="inline-flex items-center gap-1">
                              <Users className="size-3.5" />
                              {plural(c.flatmates, "person", "people")}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Receipt className="size-3.5" />
                              {plural(c.expenses, "expense")}
                            </span>
                          </>
                        ) : (
                          <Skeleton className="h-4 w-40" />
                        )}
                      </div>
                    </div>
                    <div className="flex w-full items-center justify-end gap-1 sm:w-auto">
                      {!current && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedSplitSpace(space);
                            toast.success(`Switched to ${space.name}`);
                          }}
                        >
                          Switch
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 text-muted-foreground"
                        onClick={() => setRenamingId(space.id)}
                        aria-label={`Rename ${space.name}`}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {space.name !== "Default" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 text-muted-foreground hover:bg-negative/10 hover:text-negative"
                          onClick={() => setToDelete(space)}
                          aria-label={`Delete ${space.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-sm text-muted-foreground">
        Your Default space was created when you signed up and can't be deleted.
      </p>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{blocked ? `${toDelete?.name} can't be deleted yet` : `Delete ${toDelete?.name}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {!deleteCounts
                ? "Checking what's in this space…"
                : blocked
                  ? `It still has ${plural(deleteCounts.flatmates, "person", "people")} and ${plural(deleteCounts.expenses, "expense")}. Switch to it and remove those first.`
                  : "The space is empty. Deleting it can't be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{blocked ? "OK" : "Cancel"}</AlertDialogCancel>
            {!blocked && (
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  remove();
                }}
                disabled={deleting}
                className="bg-negative text-white hover:bg-negative/90"
              >
                {deleting && <Loader2 className="animate-spin" />}
                Delete space
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const RenameForm = ({
  space,
  onDone,
  onSaved,
}: {
  space: SplitSpace;
  onDone: () => void;
  onSaved: () => Promise<void>;
}) => {
  const [name, setName] = useState(space.name);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === space.name) return onDone();
    setSaving(true);
    try {
      const { error } = await db.from("split_spaces").update({ name: trimmed }).eq("id", space.id);
      if (error) {
        if (errorCode(error) === "23505") {
          toast.error(`You already have a space called “${trimmed}”.`);
          return;
        }
        throw error;
      }
      toast.success("Renamed");
      await onSaved();
    } catch (err) {
      toast.error(`Couldn't rename: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex gap-2" onKeyDown={(e) => e.key === "Escape" && onDone()}>
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Space name" maxLength={60} />
      <Button type="button" variant="ghost" onClick={onDone} disabled={saving}>
        Cancel
      </Button>
      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="animate-spin" />}
        Save
      </Button>
    </form>
  );
};

export default SplitSpaces;
