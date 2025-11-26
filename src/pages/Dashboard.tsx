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
import { toast } from "sonner";
import { Plus, Users, Trash2, Edit, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";

interface Flatmate {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

const Dashboard = () => {
  const { selectedSplitSpace } = useSplitSpace();
  const [flatmates, setFlatmates] = useState<Flatmate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFlatmate, setEditingFlatmate] = useState<Flatmate | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "" });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchFlatmates();
  }, [selectedSplitSpace]);

  const fetchFlatmates = async () => {
    try {
      let query = supabase
        .from("flatmates")
        .select("*")
        .order("created_at", { ascending: true });

      // If split_space_id column exists and we have a selected space, filter by it
      if (selectedSplitSpace) {
        try {
          const { data, error } = await query
            .or(`split_space_id.eq.${selectedSplitSpace.id},split_space_id.is.null`);
          if (error) throw error;
          setFlatmates(data || []);
        } catch (filterError: any) {
          // If filter fails (column doesn't exist), try without filter
          if (filterError.message?.includes("column") || filterError.code === "42703") {
            const { data, error } = await supabase
              .from("flatmates")
              .select("*")
              .order("created_at", { ascending: true });
            if (error) throw error;
            setFlatmates(data || []);
          } else {
            throw filterError;
          }
        }
      } else {
        // No split space selected, fetch all
        const { data, error } = await query;
        if (error) throw error;
        setFlatmates(data || []);
      }
    } catch (error: any) {
      toast.error("Error fetching flatmates");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error("Name is required");
      return;
    }

    setSubmitLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editingFlatmate) {
        const { error } = await supabase
          .from("flatmates")
          .update({
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
          })
          .eq("id", editingFlatmate.id);

        if (error) throw error;
        toast.success("Flatmate updated successfully");
      } else {
        const flatmateDataToInsert: any = {
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          created_by: user.id,
        };

        // Only add split_space_id if it exists and is selected
        if (selectedSplitSpace) {
          flatmateDataToInsert.split_space_id = selectedSplitSpace.id;
        }

        const { error } = await supabase.from("flatmates").insert(flatmateDataToInsert);

        if (error) throw error;
        toast.success("Flatmate added successfully");
      }

      setDialogOpen(false);
      setFormData({ name: "", email: "", phone: "" });
      setEditingFlatmate(null);
      fetchFlatmates();
    } catch (error: any) {
      toast.error(error.message);
      console.error(error);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEdit = (flatmate: Flatmate) => {
    setEditingFlatmate(flatmate);
    setFormData({
      name: flatmate.name,
      email: flatmate.email || "",
      phone: flatmate.phone || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this flatmate?")) return;

    setDeleteLoading(id);
    try {
      const { error } = await supabase.from("flatmates").delete().eq("id", id);

      if (error) throw error;
      toast.success("Flatmate deleted");
      fetchFlatmates();
    } catch (error: any) {
      toast.error(error.message);
      console.error(error);
    } finally {
      setDeleteLoading(null);
    }
  };

  const resetForm = () => {
    setFormData({ name: "", email: "", phone: "" });
    setEditingFlatmate(null);
  };

  // Allow page to work even without SplitSpace selected (for backward compatibility)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold gradient-text mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your flatmates and view expense overview
          </p>
          {selectedSplitSpace && (
            <p className="text-sm text-muted-foreground mt-1">SplitSpace: {selectedSplitSpace.name}</p>
          )}
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90 shadow-lg shadow-primary/30">
              <Plus className="w-4 h-4 mr-2" />
              Add Flatmate
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>
                {editingFlatmate ? "Edit Flatmate" : "Add New Flatmate"}
              </DialogTitle>
              <DialogDescription>
                {editingFlatmate
                  ? "Update flatmate information"
                  : "Add a new flatmate to your group"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="bg-secondary/50"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="bg-secondary/50"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-blue-500"
                disabled={submitLoading}
              >
                {submitLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {editingFlatmate ? "Updating..." : "Adding..."}
                  </>
                ) : editingFlatmate ? (
                  "Update Flatmate"
                ) : (
                  "Add Flatmate"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass-card hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2 text-primary" />
            Flatmates ({flatmates.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {flatmates.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                No flatmates added yet
              </p>
              <Button
                onClick={() => setDialogOpen(true)}
                variant="outline"
                className="border-primary/30 hover:bg-primary/10"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Flatmate
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {flatmates.map((flatmate, index) => (
                <motion.div
                  key={flatmate.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="bg-secondary/50 border-border/50 hover:border-primary/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">
                            {flatmate.name}
                          </h3>
                          {flatmate.email && (
                            <p className="text-sm text-muted-foreground">
                              {flatmate.email}
                            </p>
                          )}
                          {flatmate.phone && (
                            <p className="text-sm text-muted-foreground">
                              {flatmate.phone}
                            </p>
                          )}
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(flatmate)}
                            className="hover:bg-primary/10 hover:text-primary"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(flatmate.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                            disabled={deleteLoading === flatmate.id}
                          >
                            {deleteLoading === flatmate.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
