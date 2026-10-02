import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/format";

interface Category {
  id: string;
  name: string;
  is_default: boolean;
}

interface CategorySelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  splitSpaceId?: string;
  /** Pick "Misc" when nothing is selected yet (new expenses). */
  autoDefault?: boolean;
}

export const CategorySelector = ({
  value,
  onValueChange,
  autoDefault = true,
}: CategorySelectorProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCategories(autoDefault);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const fetchCategories = async (applyDefault: boolean) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("categories")
        .select("id, name, is_default")
        .eq("created_by", user.id)
        .order("is_default", { ascending: false })
        .order("name");

      if (error) throw error;
      setCategories(data || []);

      // If no value selected and categories exist, set default to Misc
      if (applyDefault && !value && data && data.length > 0) {
        const miscCategory = data.find((cat) => cat.name === "Misc");
        if (miscCategory) {
          onValueChange(miscCategory.id);
        }
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Couldn't load categories");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setAdding(false);
      return;
    }

    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("categories")
        .insert({
          name,
          created_by: user.id,
          is_default: false,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error(`You already have a "${name}" category`);
          return;
        }
        throw error;
      }

      toast.success(`Added "${name}"`);
      setNewCategoryName("");
      setAdding(false);
      await fetchCategories(false);
      if (data) {
        onValueChange(data.id);
      }
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't create category"));
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-wrap gap-1.5" aria-busy>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="h-8 w-20 animate-pulse rounded-full bg-secondary" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
      {categories.map((category) => {
        const selected = value === category.id;
        return (
          <button
            key={category.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onValueChange(selected ? "" : category.id)}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-foreground/30 hover:bg-secondary"
            )}
          >
            {selected && <Check className="h-3.5 w-3.5" />}
            {category.name}
          </button>
        );
      })}

      {adding ? (
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="New category"
            className="h-8 w-36 rounded-full px-3 text-sm"
            maxLength={40}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateCategory();
              }
              if (e.key === "Escape") {
                e.stopPropagation();
                setAdding(false);
                setNewCategoryName("");
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={handleCreateCategory}
            disabled={creating}
            aria-label="Save category"
          >
            {creating ? <Loader2 className="animate-spin" /> : <Check />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full"
            onClick={() => {
              setAdding(false);
              setNewCategoryName("");
            }}
            aria-label="Cancel"
          >
            <X />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-border px-3 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      )}
    </div>
  );
};
