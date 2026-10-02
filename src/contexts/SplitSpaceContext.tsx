import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { db, errorMessage } from "@/lib/db";

export interface SplitSpace {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

interface SplitSpaceContextType {
  selectedSplitSpace: SplitSpace | null;
  splitSpaces: SplitSpace[];
  loading: boolean;
  /** Set when the last load failed; the previous list (if any) is kept. */
  error: string | null;
  setSelectedSplitSpace: (splitSpace: SplitSpace | null) => void;
  /** Reloads the list. Pass `selectId` to switch to a space that was just created. */
  refreshSplitSpaces: (selectId?: string) => Promise<void>;
}

const SplitSpaceContext = createContext<SplitSpaceContextType | undefined>(undefined);

const STORAGE_KEY = "selectedSplitSpaceId";

export const DEFAULT_SPACE_NAME = "Default";

/** The auto-created "Default" group can't be renamed or deleted (RLS blocks the delete). */
// eslint-disable-next-line react-refresh/only-export-components
export const isDefault = (space: { name: string } | null | undefined) => space?.name === DEFAULT_SPACE_NAME;

const readStoredId = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const storeId = (id: string | null) => {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); selection still works in memory.
  }
};

/** Keep the current choice if it still exists, else the stored one, else "Default", else the first. */
const pickSpace = (spaces: SplitSpace[], currentId: string | null, preferId?: string) =>
  spaces.find((s) => s.id === preferId) ??
  spaces.find((s) => s.id === currentId) ??
  spaces.find((s) => s.id === readStoredId()) ??
  spaces.find((s) => s.name === DEFAULT_SPACE_NAME) ??
  spaces[0] ??
  null;

export const SplitSpaceProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [selectedSplitSpace, setSelectedSplitSpaceState] = useState<SplitSpace | null>(null);
  const [splitSpaces, setSplitSpaces] = useState<SplitSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null | undefined>(undefined);

  const select = useCallback((space: SplitSpace | null) => {
    selectedIdRef.current = space?.id ?? null;
    setSelectedSplitSpaceState(space);
    storeId(space?.id ?? null);
  }, []);

  const refreshSplitSpaces = useCallback(
    async (selectId?: string) => {
      try {
        const {
          data: { user },
        } = await db.auth.getUser();
        if (!user) {
          setSplitSpaces([]);
          selectedIdRef.current = null;
          setSelectedSplitSpaceState(null);
          return;
        }

        const { data, error } = await db
          .from("split_spaces")
          .select("id, name, created_by, created_at")
          .eq("created_by", user.id)
          .order("created_at", { ascending: true });
        if (error) throw error;

        const spaces = data ?? [];
        setError(null);
        setSplitSpaces(spaces);
        select(pickSpace(spaces, selectedIdRef.current, selectId));
      } catch (error) {
        // Keep whatever was loaded before; an empty list would wrongly suggest "create your first group".
        console.error("Error fetching split spaces:", error);
        setError(errorMessage(error, "Couldn't load your groups."));
      } finally {
        setLoading(false);
      }
    },
    [select]
  );

  useEffect(() => {
    refreshSplitSpaces();

    // The provider sits above the router, so it is already mounted on /auth.
    // Reload when the session changes instead of only on first mount.
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, session) => {
      const userId = session?.user?.id ?? null;
      if (event === "INITIAL_SESSION") {
        userIdRef.current = userId;
        return;
      }
      // SIGNED_IN also fires when an existing session is recovered (e.g. on tab
      // focus); only reload when the signed-in user actually changes.
      if (userId === userIdRef.current) return;
      userIdRef.current = userId;
      queryClient.clear();
      setLoading(true);
      // Defer: calling Supabase inside the auth callback can deadlock the client.
      setTimeout(() => refreshSplitSpaces(), 0);
    });
    return () => subscription.unsubscribe();
  }, [refreshSplitSpaces, queryClient]);

  return (
    <SplitSpaceContext.Provider
      value={{
        selectedSplitSpace,
        splitSpaces,
        loading,
        error,
        setSelectedSplitSpace: select,
        refreshSplitSpaces,
      }}
    >
      {children}
    </SplitSpaceContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSplitSpace = () => {
  const context = useContext(SplitSpaceContext);
  if (context === undefined) {
    throw new Error("useSplitSpace must be used within a SplitSpaceProvider");
  }
  return context;
};
