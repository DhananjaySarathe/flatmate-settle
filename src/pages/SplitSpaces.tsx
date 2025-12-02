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
import { motion } from "framer-motion";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";

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
        toast.success("SplitSpace updated successfully");
      } else {
        const { error } = await supabase.from("split_spaces").insert({
          name: formData.name.trim(),
          created_by: user.id,
        });

        if (error) {
          if (error.code === "23505") {
            toast.error("A SplitSpace with this name already exists");
            return;
          }
          throw error;
        }
        toast.success("SplitSpace created successfully");
      }

      setDialogOpen(false);
      setFormData({ name: "" });
      setEditingSplitSpace(null);
      await refreshSplitSpaces();
      await fetchSplitSpacesWithCounts();
    } catch (error: any) {
      toast.error(error.message || "Error saving SplitSpace");
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

      toast.success("SplitSpace deleted successfully");
      setDeleteDialogOpen(false);
      setSplitSpaceToDelete(null);
      await refreshSplitSpaces();
      await fetchSplitSpacesWithCounts();
    } catch (error: any) {
      toast.error(error.message || "Error deleting SplitSpace");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SplitSpaces</h1>
          <p className="text-muted-foreground mt-1">
            Manage your expense groups. Each SplitSpace has its own flatmates and expenses.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingSplitSpace(null);
              setFormData({ name: "" });
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Create SplitSpace
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSplitSpace ? "Edit SplitSpace" : "Create New SplitSpace"}
              </DialogTitle>
              <DialogDescription>
                {editingSplitSpace
                  ? "Update the name of your SplitSpace."
                  : "Create a new SplitSpace to organize your expenses separately."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  placeholder="e.g., Apartment, Vacation, Office"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
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
                  {submitLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingSplitSpace ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    editingSplitSpace ? "Update" : "Create"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {splitSpacesWithCounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No SplitSpaces yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first SplitSpace to start organizing expenses.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create SplitSpace
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {splitSpacesWithCounts.map((splitSpace) => (
            <motion.div
              key={splitSpace.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  selectedSplitSpace?.id === splitSpace.id
                    ? "ring-2 ring-primary"
                    : ""
                }`}
                onClick={() => setSelectedSplitSpace(splitSpace)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-primary" />
                      <CardTitle className="text-lg">{splitSpace.name}</CardTitle>
                    </div>
                    {selectedSplitSpace?.id === splitSpace.id && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                        Active
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>Flatmates</span>
                      </div>
                      <span className="font-semibold">{splitSpace.flatmatesCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Receipt className="w-4 h-4" />
                        <span>Expenses</span>
                      </div>
                      <span className="font-semibold">{splitSpace.expensesCount}</span>
                    </div>
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(splitSpace);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteDialog(splitSpace);
                        }}
                        disabled={deleteLoading === splitSpace.id || splitSpace.name === "Default"}
                        title={splitSpace.name === "Default" ? "Cannot delete default SplitSpace" : ""}
                      >
                        {deleteLoading === splitSpace.id ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-1" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {splitSpaceToDelete?.name === "Default" ? (
                <span className="text-destructive font-semibold">
                  Cannot delete the default SplitSpace. This is your primary space and cannot be removed.
                </span>
              ) : (
                <>
                  This will permanently delete the SplitSpace "{splitSpaceToDelete?.name}". This action
                  cannot be undone.
                  {splitSpaceToDelete &&
                    (splitSpaceToDelete.flatmatesCount > 0 || splitSpaceToDelete.expensesCount > 0) && (
                      <span className="block mt-2 text-destructive font-semibold">
                        Warning: This SplitSpace has {splitSpaceToDelete.flatmatesCount} flatmate(s) and{" "}
                        {splitSpaceToDelete.expensesCount} expense(s). You must remove them first.
                      </span>
                    )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={
                splitSpaceToDelete
                  ? splitSpaceToDelete.name === "Default" ||
                    splitSpaceToDelete.flatmatesCount > 0 ||
                    splitSpaceToDelete.expensesCount > 0
                  : false
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SplitSpaces;

