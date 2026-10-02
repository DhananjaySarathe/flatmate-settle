import { db, errorCode, type Category, type Expense, type Flatmate } from "@/lib/db";
import { buildShareSnapshot, type Balance, type Settlement } from "@/lib/settlement";
import { toDateOnly } from "@/lib/format";

/**
 * Every write the UI makes. These issue the same inserts/updates/deletes the pages
 * always have; the only additions are rollbacks so a failed split write can't leave
 * an expense without splits.
 */

const requireUserId = async () => {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("You're signed out. Sign in again to continue.");
  return user.id;
};

export interface ExpenseDraft {
  title: string;
  amount: number;
  date: Date;
  paidBy: string;
  splitBetween: string[];
  categoryId: string | null;
}

export const createExpense = async (spaceId: string | null, draft: ExpenseDraft): Promise<string> => {
  const userId = await requireUserId();
  const row: Record<string, unknown> = {
    title: draft.title,
    amount: draft.amount,
    date: toDateOnly(draft.date),
    paid_by: draft.paidBy,
    created_by: userId,
    category_id: draft.categoryId,
  };
  if (spaceId) row.split_space_id = spaceId;

  const { data, error } = await db.from("expenses").insert(row).select().single();
  if (error) throw error;
  const expenseId = (data as { id: string }).id;

  const { error: splitsError } = await db
    .from("expense_splits")
    .insert(draft.splitBetween.map((flatmateId) => ({ expense_id: expenseId, flatmate_id: flatmateId })));
  if (splitsError) {
    await db.from("expenses").delete().eq("id", expenseId);
    throw splitsError;
  }
  return expenseId;
};

export const updateExpense = async (expense: Expense, draft: ExpenseDraft) => {
  await requireUserId();
  const { error } = await db
    .from("expenses")
    .update({
      title: draft.title,
      amount: draft.amount,
      date: toDateOnly(draft.date),
      paid_by: draft.paidBy,
      category_id: draft.categoryId,
    })
    .eq("id", expense.id);
  if (error) throw error;

  const { error: deleteError } = await db.from("expense_splits").delete().eq("expense_id", expense.id);
  if (deleteError) throw deleteError;

  const { error: insertError } = await db
    .from("expense_splits")
    .insert(draft.splitBetween.map((flatmateId) => ({ expense_id: expense.id, flatmate_id: flatmateId })));
  if (insertError) {
    // Put the previous split back rather than leave the expense owed by no one.
    await db
      .from("expense_splits")
      .insert(expense.expense_splits.map((s) => ({ expense_id: expense.id, flatmate_id: s.flatmate_id })));
    throw insertError;
  }
};

/** Splits go with it (ON DELETE CASCADE). */
export const deleteExpense = async (id: string) => {
  const { error } = await db.from("expenses").delete().eq("id", id);
  if (error) throw error;
};

export interface FlatmateDraft {
  name: string;
  email: string;
  phone: string;
}

export const createFlatmate = async (spaceId: string | null, draft: FlatmateDraft): Promise<Flatmate> => {
  const userId = await requireUserId();
  const row: Record<string, unknown> = {
    name: draft.name,
    email: draft.email || null,
    phone: draft.phone || null,
    created_by: userId,
  };
  if (spaceId) row.split_space_id = spaceId;
  const { data, error } = await db.from("flatmates").insert(row).select().single();
  if (error) throw error;
  return data as Flatmate;
};

export const updateFlatmate = async (id: string, draft: FlatmateDraft) => {
  const { error } = await db
    .from("flatmates")
    .update({ name: draft.name, email: draft.email || null, phone: draft.phone || null })
    .eq("id", id);
  if (error) throw error;
};

/** The database also deletes every expense they paid and their split rows. */
export const deleteFlatmate = async (id: string) => {
  const { error } = await db.from("flatmates").delete().eq("id", id);
  if (error) throw error;
};

export class DuplicateCategoryError extends Error {}

export const createCategory = async (name: string): Promise<Category> => {
  const userId = await requireUserId();
  const { data, error } = await db
    .from("categories")
    .insert({ name, created_by: userId, is_default: false })
    .select()
    .single();
  if (error) {
    if (errorCode(error) === "23505") throw new DuplicateCategoryError(`"${name}" already exists`);
    throw error;
  }
  return data as Category;
};

export const markSettled = async (spaceId: string, range: { from: Date; to: Date }, note: string) => {
  const userId = await requireUserId();
  const { data, error } = await db
    .from("settlements")
    .insert({
      split_space_id: spaceId,
      from_date: toDateOnly(range.from),
      to_date: toDateOnly(range.to),
      note: note.trim() || null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
};

export const deleteSettlement = async (id: string) => {
  const { error } = await db.from("settlements").delete().eq("id", id);
  if (error) throw error;
};

interface ShareInput {
  space: { id: string; name: string };
  range: { from: Date; to: Date };
  balances: Balance[];
  settlements: Settlement[];
  expenses: Expense[];
  flatmates: Flatmate[];
}

/** Freezes the current view into shared_reports and returns the public URL. */
export const createShareLink = async ({ space, range, balances, settlements, expenses, flatmates }: ShareInput) => {
  const userId = await requireUserId();
  const dateRange = { from: toDateOnly(range.from), to: toDateOnly(range.to) };
  const snapshot = buildShareSnapshot({
    splitSpaceName: space.name,
    dateRange,
    balances,
    settlements,
    expenses,
    flatmates,
  });
  const token = crypto.randomUUID().replace(/-/g, "");
  const { error } = await db.from("shared_reports").insert({
    token,
    split_space_id: space.id,
    split_space_name: space.name,
    from_date: dateRange.from,
    to_date: dateRange.to,
    snapshot,
    created_by: userId,
  });
  if (error) throw error;
  return `${window.location.origin}/share/${token}`;
};
