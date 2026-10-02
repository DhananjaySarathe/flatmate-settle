import { db } from "@/lib/db";
import { isDefault, type SplitSpace } from "@/contexts/SplitSpaceContext";

/**
 * Group (split space) writes used by the Groups page. Same table, columns and
 * operations the page always used: insert {name, created_by}, update name,
 * delete by id. The Default group is protected here as well as in the UI
 * (RLS already blocks deleting it; renaming it is blocked client-side).
 */

export interface SpaceCounts {
  people: number;
  expenses: number;
}

/** Postgres unique violation: UNIQUE(name, created_by) on split_spaces. */
export const isDuplicateNameError = (error: unknown) =>
  !!error && typeof error === "object" && (error as { code?: unknown }).code === "23505";

const PROTECTED_MESSAGE = "The Default group can't be renamed or deleted.";

/** Thrown by deleteSpace when the group still has people or expenses in it. */
export class SpaceNotEmptyError extends Error {
  constructor(readonly counts: SpaceCounts) {
    super(
      counts.people > 0
        ? "This group still has people in it. Remove its people first."
        : "This group still has expenses in it. Delete them first."
    );
    this.name = "SpaceNotEmptyError";
  }
}

const currentUserId = async () => {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("You're signed out. Sign in again to manage groups.");
  return user.id;
};

/** People and expenses filed under this group (head count queries, no rows fetched). */
export async function fetchSpaceCounts(spaceId: string): Promise<SpaceCounts> {
  const [people, expenses] = await Promise.all([
    db.from("flatmates").select("id", { count: "exact", head: true }).eq("split_space_id", spaceId),
    db.from("expenses").select("id", { count: "exact", head: true }).eq("split_space_id", spaceId),
  ]);
  if (people.error) throw people.error;
  if (expenses.error) throw expenses.error;
  return { people: people.count ?? 0, expenses: expenses.count ?? 0 };
}

/** Creates a group and returns its id. */
export async function createSpace(name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Give the group a name.");
  const userId = await currentUserId();

  const { data, error } = await db
    .from("split_spaces")
    .insert({ name: trimmed, created_by: userId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function renameSpace(space: SplitSpace, name: string): Promise<void> {
  if (isDefault(space)) throw new Error(PROTECTED_MESSAGE);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Give the group a name.");

  const { data, error } = await db
    .from("split_spaces")
    .update({ name: trimmed })
    .eq("id", space.id)
    .select("id");
  if (error) throw error;
  // RLS turns a refused update into "0 rows" rather than an error.
  if (!data || data.length === 0) {
    throw new Error("Couldn't rename this group. Reload the page and try again.");
  }
}

/**
 * Deletes an empty group. Like the page always did, a group that still has
 * people or expenses is refused; the counts are re-checked here so a stale
 * list can't delete a group someone has since added to.
 */
export async function deleteSpace(space: SplitSpace): Promise<void> {
  if (isDefault(space)) throw new Error(PROTECTED_MESSAGE);

  const counts = await fetchSpaceCounts(space.id);
  if (counts.people > 0 || counts.expenses > 0) throw new SpaceNotEmptyError(counts);

  const { data, error } = await db.from("split_spaces").delete().eq("id", space.id).select("id");
  if (error) throw error;
  // RLS turns a refused delete into "0 rows" rather than an error.
  if (!data || data.length === 0) {
    throw new Error("Couldn't delete this group. Reload the page and try again.");
  }
}
