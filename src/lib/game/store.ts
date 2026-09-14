"use client";

import { create } from "zustand";
import type {
  AttributeRow,
  Profile,
  Task,
  InventoryItem,
  CompleteTaskResult,
  GearMap,
  Zone,
} from "@/lib/game/types";
import type { UnlockedAchievement } from "@/components/achievements-panel";

// ——— Types ———

export type ToastKind = "info" | "success" | "danger";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface GameStore {
  // sheet
  profile: Profile | null;
  attributes: AttributeRow[];
  inventory: InventoryItem[];
  gear: GearMap;
  zones: Zone[];
  achievements: UnlockedAchievement[];
  tasks: Task[];
  tasksLoading: boolean;
  sheetLoading: boolean;
  lastCompletion: CompleteTaskResult | null;

  // ui
  toasts: Toast[];
  celebrateLevelUp: number | null; // new level to celebrate, cleared on view

  // actions
  setSheet: (sheet: {
    profile: Profile | null;
    attributes: AttributeRow[];
    inventory: InventoryItem[];
    gear?: GearMap;
    zones?: Zone[];
    achievements?: UnlockedAchievement[];
  }) => void;
  setTasks: (tasks: Task[]) => void;
  setTasksLoading: (loading: boolean) => void;
  setSheetLoading: (loading: boolean) => void;
  setProfile: (profile: Profile) => void;
  applyCompletion: (result: CompleteTaskResult) => void;
  clearCelebration: () => void;
  pushToast: (kind: ToastKind, message: string) => void;
  dismissToast: (id: number) => void;
}

// ——— Store ———

let toastId = 0;

export const useGameStore = create<GameStore>((set) => ({
  profile: null,
  attributes: [],
  inventory: [],
  gear: {},
  zones: [],
  achievements: [],
  tasks: [],
  tasksLoading: true,
  sheetLoading: true,
  lastCompletion: null,

  toasts: [],
  celebrateLevelUp: null,

  setSheet: ({ profile, attributes, inventory, gear, zones, achievements }) =>
    set({
      profile,
      attributes,
      inventory,
      gear: gear ?? {},
      zones: zones ?? [],
      achievements: achievements ?? [],
      sheetLoading: false,
    }),

  setTasks: (tasks) => set({ tasks, tasksLoading: false }),
  setTasksLoading: (loading) => set({ tasksLoading: loading }),
  setSheetLoading: (loading) => set({ sheetLoading: loading }),
  setProfile: (profile) => set({ profile }),

  applyCompletion: (result) => {
    set({
      profile: result.profile,
      attributes: result.attributes,
      ...(result.gear ? { gear: result.gear } : {}),
      lastCompletion: result,
    });
    if (result.leveled_up) {
      set({ celebrateLevelUp: result.new_level });
    }
  },

  clearCelebration: () => set({ celebrateLevelUp: null, lastCompletion: null }),

  pushToast: (kind, message) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4200);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
