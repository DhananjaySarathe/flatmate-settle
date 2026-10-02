import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { db, errorCode } from "@/lib/db";

interface SplitSpace {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

interface SplitSpaceContextType {
  selectedSplitSpace: SplitSpace | null;
  splitSpaces: SplitSpace[];
  loading: boolean;
  setSelectedSplitSpace: (splitSpace: SplitSpace | null) => void;
  refreshSplitSpaces: () => Promise<void>;
}

const SplitSpaceContext = createContext<SplitSpaceContextType | undefined>(undefined);

const STORAGE_KEY = "selectedSplitSpaceId";

const readStoredId = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeStoredId = (id: string | null) => {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); selection still works in memory.
  }
};

/** Keep the current pick if it still exists, else the stored pick, else "Default", else the first. */
const pickSpace = (spaces: SplitSpace[], currentId: string | null): SplitSpace | null => {
  if (spaces.length === 0) return null;
  const byId = (id: string | null) => (id ? spaces.find((s) => s.id === id) : undefined);
  return byId(currentId) ?? byId(readStoredId()) ?? spaces.find((s) => s.name === "Default") ?? spaces[0];
};

export const SplitSpaceProvider = ({ children }: { children: ReactNode }) => {
  const [selectedSplitSpace, setSelectedSplitSpaceState] = useState<SplitSpace | null>(null);
  const [splitSpaces, setSplitSpaces] = useState<SplitSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedIdRef = useRef<string | null>(null);
  // Whose spaces are loaded; lets a repeated SIGNED_IN for the same user skip the reload.
  const userIdRef = useRef<string | null>(null);

  const select = useCallback((space: SplitSpace | null) => {
    selectedIdRef.current = space?.id ?? null;
    setSelectedSplitSpaceState(space);
    writeStoredId(space?.id ?? null);
  }, []);

  const fetchSplitSpaces = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await db.auth.getUser();
      userIdRef.current = user?.id ?? null;
      if (!user) {
        setSplitSpaces([]);
        selectedIdRef.current = null;
        setSelectedSplitSpaceState(null);
        return;
      }

      const { data, error } = await db
        .from("split_spaces")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        // The table only exists once the split-space migrations have run.
        if (error.message?.includes("does not exist") || errorCode(error) === "42P01") {
          console.warn("split_spaces table doesn't exist yet. Run migrations first.");
          setSplitSpaces([]);
          return;
        }
        throw error;
      }

      const spaces = (data ?? []) as SplitSpace[];
      setSplitSpaces(spaces);
      // Replace the selected object too, so a rename shows up immediately.
      const next = pickSpace(spaces, selectedIdRef.current);
      if (next) select(next);
    } catch (error) {
      console.error("Error fetching split spaces:", error);
      setSplitSpaces([]);
    } finally {
      setLoading(false);
    }
  }, [select]);

  useEffect(() => {
    fetchSplitSpaces();

    // The provider sits above the router, so it must follow sign-in and sign-out
    // that happen without a page reload.
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user.id !== userIdRef.current) {
        // Hold pages in their loading state so nothing queries without a space.
        setLoading(true);
        fetchSplitSpaces();
      } else if (event === "SIGNED_OUT") {
        userIdRef.current = null;
        setSplitSpaces([]);
        selectedIdRef.current = null;
        setSelectedSplitSpaceState(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchSplitSpaces]);

  return (
    <SplitSpaceContext.Provider
      value={{
        selectedSplitSpace,
        splitSpaces,
        loading,
        setSelectedSplitSpace: select,
        refreshSplitSpaces: fetchSplitSpaces,
      }}
    >
      {children}
    </SplitSpaceContext.Provider>
  );
};

export const useSplitSpace = () => {
  const context = useContext(SplitSpaceContext);
  if (context === undefined) {
    throw new Error("useSplitSpace must be used within a SplitSpaceProvider");
  }
  return context;
};
