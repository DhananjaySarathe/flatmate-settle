import { useCallback, useEffect, useState } from "react";
import type { Flatmate } from "@/lib/db";
import { useSpaceScope } from "@/hooks/useSpaceData";

/**
 * Which person in the current space is the signed-in user. People are names,
 * not accounts, so this is a per-device preference: { [spaceId]: flatmateId }.
 */
const STORAGE_KEY = "expensewaale:me";
const CHANGE_EVENT = "expensewaale:me-change";

const readMap = (): Record<string, string> => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const useMe = (flatmates: Flatmate[]) => {
  const { scope } = useSpaceScope();
  const [map, setMap] = useState(readMap);

  useEffect(() => {
    const sync = () => setMap(readMap());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const meId = scope ? map[scope] : undefined;
  const me = flatmates.find((f) => f.id === meId) ?? null;
  /** The user said they aren't one of the people in this space. */
  const notInGroup = meId === NOT_IN_GROUP;

  const setMe = useCallback(
    (flatmateId: string | null) => {
      if (!scope) return;
      const next = readMap();
      if (flatmateId) next[scope] = flatmateId;
      else delete next[scope];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Without storage the choice lasts for this page view only.
      }
      setMap(next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [scope]
  );

  return { me, meId: me?.id ?? null, notInGroup, setMe };
};

/** Stored instead of a flatmate id when the user isn't part of the group. */
export const NOT_IN_GROUP = "none";

/** Display name for a person, "You" when it's the current user. */
export const useNameFor = (flatmates: Flatmate[], meId: string | null) =>
  useCallback(
    (id: string) => (id === meId ? "You" : flatmates.find((f) => f.id === id)?.name ?? "Unknown"),
    [flatmates, meId]
  );
