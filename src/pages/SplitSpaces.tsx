import { useState, useEffect } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { Plus, Building2, Edit, Trash2, Loader2, Users, Receipt } from "lucide-react";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";
import { useNavigate } from "react-router-dom";
import { PageHeader, Panel, SkeletonRows } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/format";

interface SplitSpace {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

interface SplitSpaceWithCounts extends SplitSpace {
  flatmatesCount: number;
  expensesCount: number;
}

const SplitSpaces = () => {
  const { splitSpaces, refreshSplitSpaces, selectedSplitSpace, setSelectedSplitSpace } = useSplitSpace();
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSplitSpace, setEditingSplitSpace] = useState<SplitSpace | null>(null);
  const [formData, setFormData] = useState({ name: "" });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [splitSpaceToDelete, setSplitSpaceToDelete] = useState<SplitSpaceWithCounts | null>(null);
  const [splitSpacesWithCounts, setSplitSpacesWithCounts] = useState<SplitSpaceWithCounts[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSplitSpacesWithCounts();
  }, [splitSpaces]);

  const fetchSplitSpacesWithCounts = async () => {
    try {
      const counts = await Promise.all(
        splitSpaces.map(async (splitSpace) => {
          const [flatmatesRes, expensesRes] = await Promise.all([
            supabase
              .from("flatmates")
              .select("id", { count: "exact", head: true })
              .eq("split_space_id", splitSpace.id),
            supabase
              .from("expenses")
              .select("id", { count: "exact", head: true })
              .eq("split_space_id", splitSpace.id),
          ]);

          return {
            ...splitSpace,
            flatmatesCount: flatmatesRes.count || 0,
            expensesCount: expensesRes.count || 0,
          };
        })
      );

      setSplitSpacesWithCounts(counts);
    } catch (error) {
      console.error("Error fetching counts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSubmitLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editingSplitSpace) {
        const { error } = await supabase
          .from("split_spaces")
          .update({ name: formData.name.trim() })
          .eq("id", editingSplitSpace.id);

        if (error) throw error;
        toast.success("Space renamed");
      } else {
        const { error } = await supabase.from("split_spaces").insert({
          name: formData.name.trim(),
          created_by: user.id,
        });

        if (error) {
          if (error.code === "23505") {
            toast.error("You already have a space with that name");
            return;
          }
          throw error;
        }
        toast.success(`Created ${formData.name.trim()}`);
      }

      setDialogOpen(false);
      setFormData({ name: "" });
      setEditingSplitSpace(null);
      await refreshSplitSpaces();
      await fetchSplitSpacesWithCounts();
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't save the space"));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!splitSpaceToDelete) return;

    // Prevent deletion of default split space
    if (splitSpaceToDelete.name === "Default") {
      toast.error("Cannot delete the default SplitSpace. This is your primary space.");
      setDeleteDialogOpen(false);
      setSplitSpaceToDelete(null);
      return;
    }

    setDeleteLoading(splitSpaceToDelete.id);
    try {
      // Check if it has flatmates or expenses
      if (splitSpaceToDelete.flatmatesCount > 0 || splitSpaceToDelete.expensesCount > 0) {
        toast.error(
          "Cannot delete SplitSpace with existing flatmates or expenses. Please remove them first."
        );
        setDeleteLoading(null);
        setDeleteDialogOpen(false);
        return;
      }

      const { error } = await supabase
        .from("split_spaces")
        .delete()
        .eq("id", splitSpaceToDelete.id);

      if (error) throw error;

      // If deleted space was selected, switch to default or first available
      if (selectedSplitSpace?.id === splitSpaceToDelete.id) {
        const remaining = splitSpaces.filter((ss) => ss.id !== splitSpaceToDelete.id);
        const defaultSpace = remaining.find((ss) => ss.name === "Default") || remaining[0];
        if (defaultSpace) {
          setSelectedSplitSpace(defaultSpace);
        }
      }

      toast.success("Space deleted");
      setDeleteDialogOpen(false);
      setSplitSpaceToDelete(null);
      await refreshSplitSpaces();
      await fetchSplitSpacesWithCounts();
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't delete the space"));
    } finally {
      setDeleteLoading(null);
    }
  };

  const openEditDialog = (splitSpace: SplitSpace) => {
    setEditingSplitSpace(splitSpace);
    setFormData({ name: splitSpace.name });
    setDialogOpen(true);
  };

  const openDeleteDialog = (splitSpace: SplitSpaceWithCounts) => {
    setSplitSpaceToDelete(splitSpace);
    setDeleteDialogOpen(true);
  };

  const openSpace = (splitSpace: SplitSpace) => {
    setSelectedSplitSpace(splitSpace);
    navigate("/dashboard");
  };

  const deleteBlockedReason = (splitSpace: SplitSpaceWithCounts) => {
    if (splitSpace.name === "Default") return "Your Default space can't be deleted";
    if (splitSpace.flatmatesCount > 0 || splitSpace.expensesCount > 0)
      return "Remove its people and expenses first";
    return null;
  };

  return (
    <div>
      <PageHeader
        title="Spaces"
        description="Each space keeps its own people, expenses and settle-ups: a flat, a trip, an office."
        actions={
          <Button
            onClick={() => {
              setEditingSplitSpace(null);
              setFormData({ name: "" });
              setDialogOpen(true);
            }}
          >
            <Plus />
            New space
          </Button>
        }
      />

      {loading ? (
        <Panel>
          <SkeletonRows rows={3} />
        </Panel>
      ) : splitSpacesWithCounts.length === 0 ? (
        <Panel>
          <div className="py-4">
            <p className="font-medium">No spaces yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create one for each group you split costs with.
            </p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus />
              Create a space
            </Button>
          </div>
        </Panel>
      ) : (
        <Panel bodyClassName="py-1">
          <ul className="divide-y divide-border/70">
            {splitSpacesWithCounts.map((splitSpace) => {
              const active = selectedSplitSpace?.id === splitSpace.id;
              const blocked = deleteBlockedReason(splitSpace);
              return (
                <li key={splitSpace.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => openSpace(splitSpace)}
                    className="-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1 text-left transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                        active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      )}
                    >
                      <Building2 className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{splitSpace.name}</span>
                        {active && (
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                            Current
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {splitSpace.flatmatesCount} {splitSpace.flatmatesCount === 1 ? "person" : "people"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Receipt className="h-3.5 w-3.5" />
                          {splitSpace.expensesCount} {splitSpace.expensesCount === 1 ? "expense" : "expenses"}
                        </span>
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center gap-1 pl-[3.25rem] sm:pl-0">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(splitSpace)}>
                      <Edit />
                      Rename
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-negative hover:bg-negative-soft hover:text-negative"
                      onClick={() => openDeleteDialog(splitSpace)}
                      disabled={deleteLoading === splitSpace.id || splitSpace.name === "Default"}
                      title={blocked ?? undefined}
                    >
                      {deleteLoading === splitSpace.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSplitSpace ? "Rename space" : "New space"}</DialogTitle>
            <DialogDescription>
              {editingSplitSpace
                ? "People and expenses stay as they are."
                : "You'll add people to it next. Expenses never mix between spaces."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ name: e.target.value })}
                placeholder="e.g. Koramangala flat, Goa trip"
                maxLength={60}
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setEditingSplitSpace(null);
                  setFormData({ name: "" });
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitLoading}>
                {submitLoading ? <Loader2 className="animate-spin" /> : null}
                {editingSplitSpace ? "Save" : "Create space"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {splitSpaceToDelete && deleteBlockedReason(splitSpaceToDelete)
                ? `"${splitSpaceToDelete.name}" can't be deleted yet`
                : `Delete "${splitSpaceToDelete?.name}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {splitSpaceToDelete?.name === "Default" ? (
                "Default is your primary space and can't be removed."
              ) : splitSpaceToDelete &&
                (splitSpaceToDelete.flatmatesCount > 0 || splitSpaceToDelete.expensesCount > 0) ? (
                <>
                  It still has {splitSpaceToDelete.flatmatesCount}{" "}
                  {splitSpaceToDelete.flatmatesCount === 1 ? "person" : "people"} and{" "}
                  {splitSpaceToDelete.expensesCount}{" "}
                  {splitSpaceToDelete.expensesCount === 1 ? "expense" : "expenses"}. Remove them first so
                  nothing is lost by accident.
                </>
              ) : (
                "The space is empty. Deleting it can't be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {splitSpaceToDelete && deleteBlockedReason(splitSpaceToDelete) ? "OK" : "Cancel"}
            </AlertDialogCancel>
            {splitSpaceToDelete && !deleteBlockedReason(splitSpaceToDelete) && (
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete space
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SplitSpaces;
