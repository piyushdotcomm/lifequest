"use client";

import { useEffect } from "react";
import { useGameStore } from "@/lib/game/store";
import type {
  AttributeRow,
  GearMap,
  InventoryItem,
  Profile,
  Zone,
} from "@/lib/game/types";
import type { UnlockedAchievement } from "@/components/achievements-panel";

/** Hydrates the zustand store from the server-loaded sheet, then loads tasks. */
export function SheetProvider({
  initialSheet,
  children,
}: {
  initialSheet: {
    profile: Profile | null;
    attributes: AttributeRow[];
    inventory: InventoryItem[];
    gear?: GearMap;
    zones?: Zone[];
    achievements?: UnlockedAchievement[];
  };
  children: React.ReactNode;
}) {
  const setSheet = useGameStore((s) => s.setSheet);
  const setTasks = useGameStore((s) => s.setTasks);
  const setTasksLoading = useGameStore((s) => s.setTasksLoading);

  useEffect(() => {
    setSheet(initialSheet);
  }, [initialSheet, setSheet]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data, error } = await supabase
          .from("tasks")
          .select("*")
          .order("completed", { ascending: true })
          .order("created_at", { ascending: false });
        if (!cancelled) {
          if (error) throw error;
          setTasks(data ?? []);
        }
      } catch {
        if (!cancelled) {
          setTasks([]);
          useGameStore.getState().pushToast(
            "danger",
            "Could not reach the guild ledger. Check your connection."
          );
        }
      } finally {
        if (!cancelled) setTasksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setTasks, setTasksLoading]);

  return <>{children}</>;
}
