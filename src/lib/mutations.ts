import { db } from "@/lib/db";

/**
 * Writes used by the expense composer and people management. They issue the
 * same inserts/updates/deletes the pages always did, ordered so a failure
 * part-way never leaves an expense without anyone in its split (which would
 * credit the payer while nobody owes anything).
 */

export interface ExpenseDraft {
  title: string;
  amount: number;
  /** "yyyy-MM-dd" */
  date: string;
  paidBy: string;
  categoryId: string | null;
  splitBetween: string[];
}

const currentUserId = async () => {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("You're signed out. Sign in again to save changes.");
  return user.id;
};

export async function createExpense(spaceId: string, draft: ExpenseDraft): Promise<string> {
  const userId = await currentUserId();

  const { data: expense, error } = await db
    .from("expenses")
    .insert({
      title: draft.title,
      amount: draft.amount,
      date: draft.date,
      paid_by: draft.paidBy,
      created_by: userId,
      category_id: draft.categoryId,
      split_space_id: spaceId,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: splitsError } = await db
    .from("expense_splits")
    .insert(draft.splitBetween.map((flatmateId) => ({ expense_id: expense.id, flatmate_id: flatmateId })));

  if (splitsError) {
    // Roll back so a half-saved expense can't skew balances.
    await db.from("expenses").delete().eq("id", expense.id);
    throw splitsError;
  }
  return expense.id;
}

export async function updateExpense(
  expenseId: string,
  previousSplit: string[],
  draft: ExpenseDraft
): Promise<void> {
  const { error } = await db
    .from("expenses")
    .update({
      title: draft.title,
      amount: draft.amount,
      date: draft.date,
      paid_by: draft.paidBy,
      category_id: draft.categoryId,
    })
    .eq("id", expenseId);
  if (error) throw error;

  // Splits can't be updated in place (no update policy), so add the new
  // people first and only then remove the ones who left the split.
  const toAdd = draft.splitBetween.filter((id) => !previousSplit.includes(id));
  const toRemove = previousSplit.filter((id) => !draft.splitBetween.includes(id));

  if (toAdd.length > 0) {
    const { error: addError } = await db
      .from("expense_splits")
      .insert(toAdd.map((flatmateId) => ({ expense_id: expenseId, flatmate_id: flatmateId })));
    if (addError) throw addError;
  }

  if (toRemove.length > 0) {
    const { error: removeError } = await db
      .from("expense_splits")
      .delete()
      .eq("expense_id", expenseId)
      .in("flatmate_id", toRemove);
    if (removeError) throw removeError;
  }
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const { error } = await db.from("expenses").delete().eq("id", expenseId);
  if (error) throw error;
}

export interface PersonDraft {
  name: string;
  email: string | null;
  phone: string | null;
}

export async function createPerson(spaceId: string, draft: PersonDraft): Promise<string> {
  const userId = await currentUserId();
  const { data, error } = await db
    .from("flatmates")
    .insert({ ...draft, created_by: userId, split_space_id: spaceId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function updatePerson(personId: string, draft: PersonDraft): Promise<void> {
  const { error } = await db.from("flatmates").update(draft).eq("id", personId);
  if (error) throw error;
}

/** Note: the database cascades this to every expense the person paid and every split they are in. */
export async function deletePerson(personId: string): Promise<void> {
  const { error } = await db.from("flatmates").delete().eq("id", personId);
  if (error) throw error;
}

export async function createCategory(name: string): Promise<{ id: string; name: string }> {
  const userId = await currentUserId();
  const { data, error } = await db
    .from("categories")
    .insert({ name, created_by: userId, is_default: false })
    .select("id, name")
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error(`A category called "${name}" already exists.`);
    }
    throw error;
  }
  return data;
}
