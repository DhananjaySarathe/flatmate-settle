import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Loader2, MoreHorizontal, Pencil, Plus, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader, Panel, Section } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/common/ResponsiveDialog";
import { isDefault, useSplitSpace, type SplitSpace } from "@/contexts/SplitSpaceContext";
import { spaceKeys } from "@/hooks/useSpaceData";
import { errorMessage } from "@/lib/db";
import { pluralize } from "@/lib/format";
import {
  createSpace,
  deleteSpace,
  fetchSpaceCounts,
  isDuplicateNameError,
  renameSpace,
  SpaceNotEmptyError,
  type SpaceCounts,
} from "@/lib/spaceMutations";
import { cn } from "@/lib/utils";

const EMPTY_NAME = "Give the group a name.";
const duplicateName = (name: string) => `You already have a group called “${name}”.`;
const DEFAULT_LOCKED = "The Default group can't be renamed or deleted.";

/** First character for the row's tile; Array.from keeps emoji and other astral characters whole. */
const initialOf = (name: string) => (Array.from(name.trim())[0] ?? "?").toUpperCase();

type CountsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; counts: SpaceCounts };

const SplitSpaces = () => {
  const { splitSpaces, selectedSplitSpace, loading, error, setSelectedSplitSpace, refreshSplitSpaces } =
    useSplitSpace();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // ---- Counts (head-only count queries per group, as before) ----
  const countQueries = useQueries({
    queries: splitSpaces.map((space) => ({
      // Under the space key so any write that refreshes a group also refreshes its counts.
      queryKey: [...spaceKeys.space(space.id), "counts"],
      queryFn: () => fetchSpaceCounts(space.id),
    })),
  });
  const countsFor = (index: number): CountsState => {
    const query = countQueries[index];
    // An errored query keeps status "error" while it retries; show it as loading meanwhile.
    if (!query || query.isPending || (query.isError && query.isFetching)) {
      return { status: "loading" };
    }
    if (query.isError || !query.data) return { status: "error" };
    return { status: "ready", counts: query.data };
  };

  // ---- Create ----
  const createInputRef = useRef<HTMLInputElement>(null);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // "New group…" in the group switcher lands here with { create: true }.
  const wantsCreate = (location.state as { create?: boolean } | null)?.create === true;
  // Lives in a ref, not the effect's cleanup: the effect re-runs as soon as the
  // flag below is cleared, and that must not cancel the reclaim.
  const stopReclaim = useRef<(() => void) | null>(null);
  useEffect(() => () => stopReclaim.current?.(), []);
  useEffect(() => {
    if (!wantsCreate) return;
    const input = createInputRef.current;
    input?.focus();

    // The switcher's menu hands focus back to its trigger when its exit
    // animation ends, which can be after this runs. Take focus back when that
    // happens, until the user presses, taps or clicks anything themselves.
    stopReclaim.current?.();
    let timer = 0;
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.getAttribute("aria-haspopup") === "menu") {
        input?.focus();
      }
    };
    const stop = () => {
      window.clearTimeout(timer);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("pointerdown", stop, true);
      document.removeEventListener("keydown", stop, true);
      stopReclaim.current = null;
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("pointerdown", stop, true);
    document.addEventListener("keydown", stop, true);
    timer = window.setTimeout(stop, 1500);
    stopReclaim.current = stop;

    // Clear the flag so a reload or back-navigation doesn't refocus the field.
    navigate(location.pathname, { replace: true, state: null });
  }, [wantsCreate, location.pathname, navigate]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (creating) return;
    const name = newName.trim();
    if (!name) {
      setCreateError(EMPTY_NAME);
      createInputRef.current?.focus();
      return;
    }
    if (splitSpaces.some((space) => space.name === name)) {
      setCreateError(duplicateName(name));
      createInputRef.current?.focus();
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const id = await createSpace(name);
      await refreshSplitSpaces(id); // reloads the list and switches to the new group
      setNewName("");
      toast.success(`Created ${name}`, { description: "Add the people in it." });
      navigate("/dashboard");
    } catch (error) {
      setCreateError(
        isDuplicateNameError(error)
          ? duplicateName(name)
          : errorMessage(error, "Couldn't create the group. Check your connection and try again.")
      );
      createInputRef.current?.focus();
    } finally {
      setCreating(false);
    }
  };

  // ---- Switch ----
  const openGroup = (space: SplitSpace) => {
    if (space.id !== selectedSplitSpace?.id) {
      setSelectedSplitSpace(space);
      toast.success(`Switched to ${space.name}`);
    }
    navigate("/dashboard");
  };

  // ---- Rename ----
  const [renameTarget, setRenameTarget] = useState<SplitSpace | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  const startRename = (space: SplitSpace) => {
    if (isDefault(space)) return;
    setRenameTarget(space);
    setRenameValue(space.name);
    setRenameError(null);
    setRenameOpen(true);
  };

  const handleRename = async (event: FormEvent) => {
    event.preventDefault();
    if (!renameTarget || renaming) return;
    const name = renameValue.trim();
    if (!name) {
      setRenameError(EMPTY_NAME);
      return;
    }
    if (name === renameTarget.name) {
      setRenameOpen(false);
      return;
    }
    if (splitSpaces.some((space) => space.id !== renameTarget.id && space.name === name)) {
      setRenameError(duplicateName(name));
      return;
    }

    setRenaming(true);
    setRenameError(null);
    try {
      await renameSpace(renameTarget, name);
      await refreshSplitSpaces(); // the header and switcher pick up the new name
      toast.success(`Renamed to ${name}`);
      setRenameOpen(false);
    } catch (error) {
      setRenameError(
        isDuplicateNameError(error)
          ? duplicateName(name)
          : errorMessage(error, "Couldn't rename the group. Check your connection and try again.")
      );
    } finally {
      setRenaming(false);
    }
  };

  // ---- Delete ----
  const [deleteTarget, setDeleteTarget] = useState<SplitSpace | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const startDelete = (space: SplitSpace) => {
    if (isDefault(space)) return;
    setDeleteTarget(space);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    try {
      await deleteSpace(target);
    } catch (error) {
      toast.error("Couldn't delete the group", {
        description: errorMessage(error, "Check your connection and try again."),
      });
      // Re-check what's in it so the row and its menu explain why.
      queryClient.invalidateQueries({ queryKey: spaceKeys.space(target.id) });
      // Someone added people or expenses since the list loaded: retrying can't
      // succeed, so let the dialog close. Anything else keeps it open to retry.
      if (error instanceof SpaceNotEmptyError) return;
      throw error;
    }

    // If you were in it, move to the Default group (or the first one left).
    const wasSelected = selectedSplitSpace?.id === target.id;
    const remaining = splitSpaces.filter((space) => space.id !== target.id);
    const fallback = remaining.find((space) => isDefault(space)) ?? remaining[0];
    await refreshSplitSpaces(wasSelected ? fallback?.id : undefined);
    queryClient.removeQueries({ queryKey: spaceKeys.space(target.id) });

    toast.success(
      `Deleted ${target.name}`,
      wasSelected && fallback ? { description: `You're now in ${fallback.name}.` } : undefined
    );
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Groups" description="Each group has its own people and expenses." />

      <div className="space-y-8">
        <Panel>
          <form onSubmit={handleCreate} noValidate>
            <Label htmlFor="new-group-name" className="text-base font-semibold">
              New group
            </Label>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                id="new-group-name"
                ref={createInputRef}
                value={newName}
                onChange={(event) => {
                  setNewName(event.target.value);
                  if (createError) setCreateError(null);
                }}
                placeholder="e.g. Goa trip"
                autoComplete="off"
                enterKeyHint="done"
                autoFocus={wantsCreate}
                readOnly={creating}
                aria-invalid={!!createError}
                aria-describedby="new-group-hint"
                className={cn("h-11 sm:h-10 sm:flex-1", createError && "border-destructive")}
              />
              <Button type="submit" disabled={creating} className="h-11 w-full sm:h-10 sm:w-auto">
                {creating ? <Loader2 className="animate-spin" /> : <Plus />}
                {creating ? "Creating…" : "Create group"}
              </Button>
            </div>
            {createError ? (
              <p id="new-group-hint" role="alert" className="mt-2 text-[13px] text-destructive">
                {createError}
              </p>
            ) : (
              <p id="new-group-hint" className="mt-2 text-[13px] text-muted-foreground">
                You'll switch to it straight away so you can add people.
              </p>
            )}
          </form>
        </Panel>

        <Section
          id="your-groups"
          title="Your groups"
          description="Open a group to see its people and expenses."
        >
          <Panel className="overflow-hidden p-0 sm:p-0">
            {loading ? (
              <GroupListSkeleton />
            ) : splitSpaces.length === 0 && error ? (
              <ErrorState title="Couldn't load your groups" description={error} onRetry={() => refreshSplitSpaces()} />
            ) : splitSpaces.length === 0 ? (
              <EmptyState
                compact
                title="No groups yet"
                description="Create one above. Each group keeps its own people and expenses."
              />
            ) : (
              <ul className="divide-y">
                {splitSpaces.map((space, index) => (
                  <GroupRow
                    key={space.id}
                    space={space}
                    current={space.id === selectedSplitSpace?.id}
                    counts={countsFor(index)}
                    onRetryCounts={() => countQueries[index]?.refetch()}
                    onOpen={() => openGroup(space)}
                    onRename={() => startRename(space)}
                    onDelete={() => startDelete(space)}
                  />
                ))}
              </ul>
            )}
          </Panel>
        </Section>
      </div>

      <ResponsiveDialog open={renameOpen} onOpenChange={(open) => !renaming && setRenameOpen(open)}>
        <ResponsiveDialogContent>
          <form onSubmit={handleRename} noValidate className="flex min-h-0 flex-1 flex-col">
            <ResponsiveDialogHeader>
              <ResponsiveDialogTitle>Rename group</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                People and expenses stay as they are.
              </ResponsiveDialogDescription>
            </ResponsiveDialogHeader>
            <ResponsiveDialogBody className="space-y-2 pt-1">
              <Label htmlFor="rename-group-name">Name</Label>
              <Input
                id="rename-group-name"
                value={renameValue}
                onChange={(event) => {
                  setRenameValue(event.target.value);
                  if (renameError) setRenameError(null);
                }}
                autoComplete="off"
                enterKeyHint="done"
                autoFocus
                readOnly={renaming}
                aria-invalid={!!renameError}
                aria-describedby={renameError ? "rename-group-error" : undefined}
                className={cn("h-11 sm:h-10", renameError && "border-destructive")}
              />
              {renameError && (
                <p id="rename-group-error" role="alert" className="text-[13px] text-destructive">
                  {renameError}
                </p>
              )}
            </ResponsiveDialogBody>
            <ResponsiveDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameOpen(false)}
                disabled={renaming}
                className="h-11 sm:h-10"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={renaming} className="h-11 sm:h-10">
                {renaming && <Loader2 className="animate-spin" />}
                Save name
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete “${deleteTarget?.name ?? ""}”?`}
        description={
          <>
            <p>This can't be undone.</p>
            <p>Its saved settle-ups go with it, and any public links shared from it stop working.</p>
          </>
        }
        confirmLabel="Delete group"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
};

/* ------------------------------------------------------------------------- */

interface GroupRowProps {
  space: SplitSpace;
  current: boolean;
  counts: CountsState;
  onRetryCounts: () => void;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}

/** Why "Delete" is unavailable for this group, or null when it can be deleted. */
const deleteBlockedReason = (space: SplitSpace, counts: CountsState): string | null => {
  if (isDefault(space)) return DEFAULT_LOCKED;
  if (counts.status === "loading") return "Checking what's in this group…";
  if (counts.status === "error") {
    return "Couldn't check what's in this group, so it can't be deleted yet.";
  }
  if (counts.counts.people > 0) {
    return "Remove its people first. Removing a person also deletes the expenses they paid.";
  }
  if (counts.counts.expenses > 0) return "Delete its expenses first.";
  return null;
};

const GroupRow = ({
  space,
  current,
  counts,
  onRetryCounts,
  onOpen,
  onRename,
  onDelete,
}: GroupRowProps) => {
  const locked = isDefault(space);
  const blocked = deleteBlockedReason(space, counts);
  // Disabled menu items can't take focus, so the reason is also tied to the menu itself.
  const reasonId = useId();
  const describedBy = blocked ? reasonId : undefined;

  return (
    <li className="flex items-center gap-1 pr-2 sm:pr-3">
      <button
        type="button"
        onClick={onOpen}
        aria-current={current ? "true" : undefined}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold",
            current ? "bg-primary/10 text-primary" : "bg-secondary text-foreground"
          )}
        >
          {initialOf(space.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[15px] font-medium">{space.name}</span>
            {current && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Current
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[13px] text-muted-foreground">
            {counts.status === "loading" ? (
              <>
                <span className="mt-1 block h-3.5 w-32 animate-pulse rounded-md bg-muted" aria-hidden="true" />
                <span className="sr-only">Loading counts</span>
              </>
            ) : counts.status === "error" ? (
              "Couldn't load counts"
            ) : (
              `${pluralize(counts.counts.people, "person", "people")} · ${pluralize(
                counts.counts.expenses,
                "expense"
              )}`
            )}
          </span>
        </span>
      </button>

      {/* Non-modal so opening the rename/delete dialog from it can't leave the page inert. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground"
            aria-label={`Options for ${space.name}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64" aria-describedby={describedBy}>
          <DropdownMenuItem
            className="min-h-10 gap-2"
            disabled={locked}
            aria-describedby={locked ? reasonId : undefined}
            onSelect={onRename}
          >
            <Pencil className="h-4 w-4" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-h-10 gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
            disabled={!!blocked}
            aria-describedby={describedBy}
            onSelect={onDelete}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
          {counts.status === "error" && (
            <DropdownMenuItem className="min-h-10 gap-2" onSelect={onRetryCounts}>
              <RotateCw className="h-4 w-4" /> Check again
            </DropdownMenuItem>
          )}
          {blocked && (
            <>
              <DropdownMenuSeparator />
              <p id={reasonId} className="px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
                {blocked}
              </p>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
};

const GroupListSkeleton = () => (
  <ul className="divide-y" aria-label="Loading groups" aria-busy="true">
    {[0, 1, 2].map((key) => (
      <li key={key} className="flex min-h-16 items-center gap-3 px-4 py-3 sm:px-5">
        <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-40 max-w-full" />
          <Skeleton className="h-3.5 w-28 max-w-full" />
        </div>
      </li>
    ))}
  </ul>
);

export default SplitSpaces;
