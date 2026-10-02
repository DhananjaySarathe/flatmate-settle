import { useEffect } from "react";

/** Sets the browser tab title while the page is mounted. */
export const useDocumentTitle = (title?: string) => {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} · ExpenseWaale`;
    return () => {
      document.title = previous;
    };
  }, [title]);
};
