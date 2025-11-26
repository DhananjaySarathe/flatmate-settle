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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Receipt,
  Trash2,
  Edit,
  Loader2,
  Calendar as CalendarIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { useSplitSpace } from "@/contexts/SplitSpaceContext";

interface Flatmate {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paid_by: string;
  flatmates: {
    name: string;
  };
  expense_splits: {
    flatmate_id: string;
  }[];
}

const Expenses = () => {
  const { selectedSplitSpace, splitSpaces, loading: contextLoading } = useSplitSpace();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [flatmates, setFlatmates] = useState<Flatmate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    date: new Date(),
    paidBy: "",
    splitBetween: [] as string[],
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  const fetchDataWithoutSplitSpace = async () => {
    setLoading(true);
    try {
      const [flatmatesRes, expensesRes] = await Promise.all([
        supabase.from("flatmates").select("id, name").order("name"),
        supabase
          .from("expenses")
          .select(
            `
            *,
            flatmates!expenses_paid_by_fkey (name),
            expense_splits (flatmate_id)
          `
          )
          .order("date", { ascending: false }),
      ]);

      if (flatmatesRes.error) throw flatmatesRes.error;
      if (expensesRes.error) throw expensesRes.error;

      setFlatmates(flatmatesRes.data || []);
      setExpenses(expensesRes.data || []);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error("Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for context to finish loading
    if (contextLoading) {
      console.log("Expenses: Context still loading, waiting...");
      return;
    }
    
    console.log("Expenses: Context loaded. SplitSpaces:", splitSpaces.length, "Selected:", selectedSplitSpace?.name);
    
    // If no split spaces exist (migrations not run), fetch without filter
    if (splitSpaces.length === 0) {
      console.log("Expenses: No split spaces, fetching without filter");
      fetchDataWithoutSplitSpace();
    } else if (selectedSplitSpace) {
      console.log("Expenses: Fetching with SplitSpace:", selectedSplitSpace.name);
      fetchData();
    } else {
      console.log("Expenses: No SplitSpace selected, fetching without filter as fallback");
      fetchDataWithoutSplitSpace();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSplitSpace?.id, splitSpaces.length, contextLoading]);

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log("Expenses: fetchData called. SplitSpace:", selectedSplitSpace?.id);
      
      // Try to fetch with split_space_id filter if available
      let flatmatesRes, expensesRes;
      
      if (selectedSplitSpace) {
        try {
          [flatmatesRes, expensesRes] = await Promise.all([
            supabase
              .from("flatmates")
              .select("id, name")
              .or(`split_space_id.eq.${selectedSplitSpace.id},split_space_id.is.null`)
              .order("name"),
            supabase
              .from("expenses")
              .select(
                `
                *,
                flatmates!expenses_paid_by_fkey (name),
                expense_splits (flatmate_id)
              `
              )
              .or(`split_space_id.eq.${selectedSplitSpace.id},split_space_id.is.null`)
              .order("date", { ascending: false }),
          ]);
        } catch (queryError: any) {
          // If query syntax error, try without the or filter
          console.warn("Expenses: Query with split_space_id failed, trying without filter:", queryError);
          [flatmatesRes, expensesRes] = await Promise.all([
            supabase
              .from("flatmates")
              .select("id, name")
              .order("name"),
            supabase
              .from("expenses")
              .select(
                `
                *,
                flatmates!expenses_paid_by_fkey (name),
                expense_splits (flatmate_id)
              `
              )
              .order("date", { ascending: false }),
          ]);
        }
      } else {
        // No split space, fetch all
        [flatmatesRes, expensesRes] = await Promise.all([
          supabase
            .from("flatmates")
            .select("id, name")
            .order("name"),
          supabase
            .from("expenses")
            .select(
              `
              *,
              flatmates!expenses_paid_by_fkey (name),
              expense_splits (flatmate_id)
            `
            )
            .order("date", { ascending: false }),
        ]);
      }

      if (flatmatesRes.error) {
        console.error("Flatmates error:", flatmatesRes.error);
        // If it's a column error, try without filter
        if (flatmatesRes.error.message?.includes("column") || flatmatesRes.error.code === "42703") {
          const { data, error } = await supabase
            .from("flatmates")
            .select("id, name")
            .order("name");
          if (error) throw error;
          setFlatmates(data || []);
        } else {
          throw flatmatesRes.error;
        }
      } else {
        setFlatmates(flatmatesRes.data || []);
      }

      if (expensesRes.error) {
        console.error("Expenses error:", expensesRes.error);
        // If it's a column error, try without filter
        if (expensesRes.error.message?.includes("column") || expensesRes.error.code === "42703") {
          const { data, error } = await supabase
            .from("expenses")
            .select(
              `
              *,
              flatmates!expenses_paid_by_fkey (name),
              expense_splits (flatmate_id)
            `
            )
            .order("date", { ascending: false });
          if (error) throw error;
          setExpenses(data || []);
        } else {
          throw expensesRes.error;
        }
      } else {
        setExpenses(expensesRes.data || []);
      }

      console.log("Flatmates fetched:", flatmatesRes.data?.length || 0);
      console.log("Expenses fetched:", expensesRes.data?.length || 0);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error(`Error fetching data: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.title ||
      !formData.amount ||
      !formData.paidBy ||
      formData.splitBetween.length === 0
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (editingExpense) {
        // Update expense
        const { error: expenseError } = await supabase
          .from("expenses")
          .update({
            title: formData.title,
            amount: parseFloat(formData.amount),
            date: format(formData.date, "yyyy-MM-dd"),
            paid_by: formData.paidBy,
          })
          .eq("id", editingExpense.id);

        if (expenseError) throw expenseError;

        // Delete old splits
        await supabase
          .from("expense_splits")
          .delete()
          .eq("expense_id", editingExpense.id);

        // Insert new splits
        const { error: splitsError } = await supabase
          .from("expense_splits")
          .insert(
            formData.splitBetween.map((flatmateId) => ({
              expense_id: editingExpense.id,
              flatmate_id: flatmateId,
            }))
          );

        if (splitsError) throw splitsError;
        toast.success("Expense updated successfully");
      } else {
        // Create new expense
        const expenseDataToInsert: any = {
          title: formData.title,
          amount: parseFloat(formData.amount),
          date: format(formData.date, "yyyy-MM-dd"),
          paid_by: formData.paidBy,
          created_by: user.id,
        };

        // Only add split_space_id if it exists and is selected
        if (selectedSplitSpace) {
          expenseDataToInsert.split_space_id = selectedSplitSpace.id;
        }

        const { data: expenseData, error: expenseError } = await supabase
          .from("expenses")
          .insert(expenseDataToInsert)
          .select()
          .single();

        if (expenseError) throw expenseError;

        // Insert splits
        const { error: splitsError } = await supabase
          .from("expense_splits")
          .insert(
            formData.splitBetween.map((flatmateId) => ({
              expense_id: expenseData.id,
              flatmate_id: flatmateId,
            }))
          );

        if (splitsError) throw splitsError;
        toast.success("Expense added successfully");
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
      console.error(error);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      title: expense.title,
      amount: expense.amount.toString(),
      date: new Date(expense.date),
      paidBy: expense.paid_by,
      splitBetween: expense.expense_splits.map((s) => s.flatmate_id),
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    setDeleteLoading(id);
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      toast.success("Expense deleted");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
      console.error(error);
    } finally {
      setDeleteLoading(null);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      amount: "",
      date: new Date(),
      paidBy: "",
      splitBetween: [],
    });
    setEditingExpense(null);
  };

  const toggleSplitMember = (flatmateId: string) => {
    setFormData((prev) => ({
      ...prev,
      splitBetween: prev.splitBetween.includes(flatmateId)
        ? prev.splitBetween.filter((id) => id !== flatmateId)
        : [...prev.splitBetween, flatmateId],
    }));
  };

  // Allow page to work even if SplitSpaces feature isn't fully set up
  if (!selectedSplitSpace && splitSpaces.length > 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-muted-foreground">Please select a SplitSpace to continue.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold gradient-text mb-2">Expenses</h1>
          <p className="text-muted-foreground">
            Track and manage all your shared expenses
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
            <Button
              className="bg-gradient-to-r from-primary to-blue-500 hover:opacity-90 shadow-lg shadow-primary/30"
              disabled={flatmates.length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-border/50 max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingExpense ? "Edit Expense" : "Add New Expense"}
              </DialogTitle>
              <DialogDescription>
                {editingExpense
                  ? "Update expense details"
                  : "Create a new shared expense"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Groceries, Rent, Utilities..."
                  className="bg-secondary/50"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  placeholder="0.00"
                  className="bg-secondary/50"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-secondary/50",
                        !formData.date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.date
                        ? format(formData.date, "PPP")
                        : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0 glass-card pointer-events-auto"
                    align="start"
                  >
                    <Calendar
                      mode="single"
                      selected={formData.date}
                      onSelect={(date) =>
                        date && setFormData({ ...formData, date })
                      }
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paidBy">Paid By *</Label>
                <Select
                  value={formData.paidBy}
                  onValueChange={(value) =>
                    setFormData({ ...formData, paidBy: value })
                  }
                >
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue placeholder="Select who paid" />
                  </SelectTrigger>
                  <SelectContent className="glass-card">
                    {flatmates.map((flatmate) => (
                      <SelectItem key={flatmate.id} value={flatmate.id}>
                        {flatmate.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Split Between * (select all involved)</Label>
                <div className="space-y-2 max-h-40 overflow-y-auto p-3 bg-secondary/30 rounded-lg border border-border/50">
                  {flatmates.map((flatmate) => (
                    <div
                      key={flatmate.id}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`split-${flatmate.id}`}
                        checked={formData.splitBetween.includes(flatmate.id)}
                        onCheckedChange={() => toggleSplitMember(flatmate.id)}
                      />
                      <Label
                        htmlFor={`split-${flatmate.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {flatmate.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-blue-500"
                disabled={submitLoading}
              >
                {submitLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {editingExpense ? "Updating..." : "Adding..."}
                  </>
                ) : editingExpense ? (
                  "Update Expense"
                ) : (
                  "Add Expense"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {flatmates.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-12 text-center">
            <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Please add flatmates first before creating expenses
            </p>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/dashboard")}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Receipt className="w-5 h-5 mr-2 text-primary" />
              All Expenses ({expenses.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenses.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No expenses recorded yet
                </p>
                <Button
                  onClick={() => setDialogOpen(true)}
                  variant="outline"
                  className="border-primary/30 hover:bg-primary/10"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Expense
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map((expense, index) => {
                  const splitCount = expense.expense_splits.length;
                  const sharePerPerson = expense.amount / splitCount;

                  return (
                    <motion.div
                      key={expense.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="bg-secondary/30 border-border/50 hover:border-primary/30 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-lg truncate">
                                  {expense.title}
                                </h3>
                                <span className="text-sm text-muted-foreground whitespace-nowrap">
                                  {format(
                                    new Date(expense.date),
                                    "MMM dd, yyyy"
                                  )}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Paid by{" "}
                                <span className="text-foreground font-medium">
                                  {expense.flatmates.name}
                                </span>
                                {" • "}
                                Split between {splitCount}{" "}
                                {splitCount === 1 ? "person" : "people"}
                                {" • "}${sharePerPerson.toFixed(2)} each
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-bold text-primary whitespace-nowrap">
                                ${expense.amount.toFixed(2)}
                              </span>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(expense)}
                                  className="hover:bg-primary/10 hover:text-primary"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(expense.id)}
                                  className="hover:bg-destructive/10 hover:text-destructive"
                                  disabled={deleteLoading === expense.id}
                                >
                                  {deleteLoading === expense.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Expenses;
