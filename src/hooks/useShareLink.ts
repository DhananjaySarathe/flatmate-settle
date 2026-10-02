import { useState } from "react";
import { toast } from "sonner";
import { createShareLink } from "@/lib/mutations";
import { copyText } from "@/lib/shareText";
import { errorMessage, type Expense, type Flatmate } from "@/lib/db";
import type { Balance, Settlement } from "@/lib/settlement";

interface ShareInput {
  space: { id: string; name: string } | null;
  range: { from: Date; to: Date };
  balances: Balance[];
  settlements: Settlement[];
  expenses: Expense[];
  flatmates: Flatmate[];
}

/** Creates a read-only snapshot link and copies it. */
export const useShareLink = () => {
  const [url, setUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const create = async (input: ShareInput) => {
    if (!input.space) {
      toast.error("Choose a space first");
      return;
    }
    if (input.expenses.length === 0) {
      toast.error("Nothing to share: there are no expenses in this period.");
      return;
    }
    setCreating(true);
    try {
      const link = await createShareLink({ ...input, space: input.space });
      setUrl(link);
      const copied = await copyText(link);
      toast.success(copied ? "Share link copied" : "Share link ready", {
        description: "Anyone with the link can view this snapshot.",
      });
    } catch (error) {
      toast.error(`Couldn't create a share link: ${errorMessage(error)}`);
    } finally {
      setCreating(false);
    }
  };

  return { url, creating, create, reset: () => setUrl(null) };
};
