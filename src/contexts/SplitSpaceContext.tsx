import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export const SplitSpaceProvider = ({ children }: { children: ReactNode }) => {
  const [selectedSplitSpace, setSelectedSplitSpaceState] = useState<SplitSpace | null>(null);
  const [splitSpaces, setSplitSpaces] = useState<SplitSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const hasSpacesRef = useRef(false);
  hasSpacesRef.current = splitSpaces.length > 0;

  const fetchSplitSpaces = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("split_spaces")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        // If table doesn't exist yet, that's okay - migrations haven't run
        if (error.message?.includes("does not exist") || error.code === "42P01") {
          console.warn("split_spaces table doesn't exist yet. Run migrations first.");
          setSplitSpaces([]);
          setLoading(false);
          return;
        }
        throw error;
      }

      setSplitSpaces(data || []);

      // If no split space is selected, select the first one (or default)
      if (!selectedSplitSpace && data && data.length > 0) {
        const storedId = localStorage.getItem(STORAGE_KEY);
        const splitSpaceToSelect = storedId
          ? data.find((ss) => ss.id === storedId) || data[0]
          : data.find((ss) => ss.name === "Default") || data[0];
        setSelectedSplitSpaceState(splitSpaceToSelect);
        localStorage.setItem(STORAGE_KEY, splitSpaceToSelect.id);
      }
    } catch (error) {
      console.error("Error fetching split spaces:", error);
      setSplitSpaces([]);
    } finally {
      setLoading(false);
    }
  };

  const setSelectedSplitSpace = (splitSpace: SplitSpace | null) => {
    setSelectedSplitSpaceState(splitSpace);
    if (splitSpace) {
      localStorage.setItem(STORAGE_KEY, splitSpace.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  useEffect(() => {
    fetchSplitSpaces();

    // The provider mounts before login, so reload spaces once a user signs in
    // (and forget them on sign-out) instead of waiting for a page refresh.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        // Fresh login: show loading so pages don't query before a space is picked.
        // (SIGNED_IN also fires on session recovery — don't flash loaders then.)
        if (!hasSpacesRef.current) setLoading(true);
        fetchSplitSpaces();
      } else if (event === "SIGNED_OUT") {
        setSplitSpaces([]);
        setSelectedSplitSpaceState(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load selected split space from localStorage on mount
  useEffect(() => {
    if (splitSpaces.length > 0 && !selectedSplitSpace) {
      const storedId = localStorage.getItem(STORAGE_KEY);
      if (storedId) {
        const found = splitSpaces.find((ss) => ss.id === storedId);
        if (found) {
          setSelectedSplitSpaceState(found);
        } else {
          // If stored ID doesn't exist, select default or first
          const defaultSpace = splitSpaces.find((ss) => ss.name === "Default") || splitSpaces[0];
          setSelectedSplitSpaceState(defaultSpace);
          localStorage.setItem(STORAGE_KEY, defaultSpace.id);
        }
      } else {
        // No stored selection, select default or first
        const defaultSpace = splitSpaces.find((ss) => ss.name === "Default") || splitSpaces[0];
        setSelectedSplitSpaceState(defaultSpace);
        localStorage.setItem(STORAGE_KEY, defaultSpace.id);
      }
    }
  }, [splitSpaces]);

  return (
    <SplitSpaceContext.Provider
      value={{
        selectedSplitSpace,
        splitSpaces,
        loading,
        setSelectedSplitSpace,
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

