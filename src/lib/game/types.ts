// Shared game vocabulary — one source of truth for client + server shapes.

export type DifficultyTier = "trivial" | "easy" | "medium" | "hard" | "epic";
export type AttributeKey = "str" | "int" | "vit" | "dis" | "cha" | "cra";
export type ItemKind = "frame" | "title" | "badge" | "theme" | "consumable";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type Recurrence = "none" | "daily" | "weekly";

export const RECURRENCE_META: Record<
  Recurrence,
  { label: string; blurb: string }
> = {
  none: { label: "One-shot", blurb: "A single deed, entered once." },
  daily: { label: "Daily", blurb: "Resets at UTC midnight; builds a streak." },
  weekly: { label: "Weekly", blurb: "Resets each week; builds a streak." },
};

export const ATTRIBUTE_META: Record<
  AttributeKey,
  { label: string; blurb: string; colorVar: string; examples: string }
> = {
  str: {
    label: "Strength",
    blurb: "Body and vigor",
    colorVar: "--color-str",
    examples: "gym, sports, chores",
  },
  int: {
    label: "Intellect",
    blurb: "Mind and study",
    colorVar: "--color-int",
    examples: "coding, reading, puzzles",
  },
  vit: {
    label: "Vitality",
    blurb: "Health and rest",
    colorVar: "--color-vit",
    examples: "sleep, cooking, hydration",
  },
  dis: {
    label: "Discipline",
    blurb: "Order and follow-through",
    colorVar: "--color-dis",
    examples: "admin, planning, deep work",
  },
  cha: {
    label: "Charisma",
    blurb: "Bonds and words",
    colorVar: "--color-cha",
    examples: "calls, socializing, outreach",
  },
  cra: {
    label: "Craft",
    blurb: "Making and art",
    colorVar: "--color-cra",
    examples: "music, drawing, building",
  },
};

export const TIER_META: Record<
  DifficultyTier,
  { label: string; xp: number; gold: number }
> = {
  trivial: { label: "Trivial", xp: 10, gold: 5 },
  easy: { label: "Easy", xp: 25, gold: 10 },
  medium: { label: "Medium", xp: 50, gold: 20 },
  hard: { label: "Hard", xp: 100, gold: 45 },
  epic: { label: "Epic", xp: 200, gold: 100 },
};

export const RARITY_ORDER: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

export const RARITY_CLASS: Record<Rarity, string> = {
  common: "text-rarity-common",
  uncommon: "text-rarity-uncommon",
  rare: "text-rarity-rare",
  epic: "text-rarity-epic",
  legendary: "text-rarity-legendary",
};

// ——— DB row shapes (what PostgREST returns) ———

export interface Profile {
  id: string;
  display_name: string;
  class_name: string;
  level: number;
  xp: number;
  gold: number;
  streak_count: number;
  streak_best: number;
  last_active_date: string | null;
  crit_count?: number;
  chest_last_claimed?: string | null;
  created_at: string;
}

/** Gear tier per attribute slot (0 = plain clothes). */
export type GearMap = Partial<Record<AttributeKey, number>>;

export interface Zone {
  id: number;
  name: string;
  lore: string;
  unlock_level: number;
  order_index: number;
}

export interface Task {
  id: string;
  profile_id: string;
  title: string;
  notes: string | null;
  tier: DifficultyTier;
  attribute: AttributeKey;
  recurrence: Recurrence;
  completed: boolean;
  /** True when done for the current period (dailies/weeklies roll over). */
  done_now?: boolean;
  rewards_paid?: boolean;
  task_streak?: number;
  best_streak?: number;
  last_paid_period?: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttributeRow {
  attribute: AttributeKey;
  xp: number;
  level: number;
  xp_needed: number;
}

export interface InventoryItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  kind: ItemKind;
  rarity: Rarity;
  glyph: string;
  price: number;
  quantity: number;
  equipped: boolean;
}

export interface ShopItem extends Omit<InventoryItem, "quantity" | "equipped"> {
  purchasable: boolean;
}

// ——— RPC result shapes ———

export interface CompleteTaskResult {
  xp_gained: number;
  gold_gained: number;
  attribute: AttributeKey;
  attribute_levels_gained: number;
  leveled_up: boolean;
  levels_gained: number;
  new_level: number;
  streak_increased: boolean;
  streak_frozen: boolean;
  crit?: boolean;
  crit_roll?: number;
  gear_granted?: string | null;
  reopened_no_reward?: boolean;
  quest_streak?: number;
  quest_multiplier?: number;
  achievements?: Achievement[];
  profile: Profile;
  attributes: AttributeRow[];
  gear?: GearMap;
}

/** An achievement unlocked in the same transaction as the action. */
export interface Achievement {
  slug: string;
  name: string;
  description: string;
  rarity: Rarity;
  gold_reward: number;
}

// ——— Chronicle shapes (get_chronicle RPC) ———

export interface HeatmapCell {
  day: string; // YYYY-MM-DD
  quests: number;
  xp: number;
}

export interface WeeklyBucket {
  week: string; // YYYY-MM-DD (week start, Monday)
  xp: Partial<Record<AttributeKey, number>>;
  quests: number;
}

export interface ChronicleTotals {
  quests: number;
  xp: number;
  gold: number;
  crits: number;
  active_days: number;
}

export interface ChronicleEvent {
  event: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface ChronicleData {
  heatmap: HeatmapCell[];
  weekly: WeeklyBucket[];
  totals: ChronicleTotals;
  events: ChronicleEvent[];
  profile: Profile;
}

export interface ClaimChestResult {
  gold_gained: number;
  item_slug: string | null;
  item_name: string | null;
  item_rarity: string | null;
  achievements?: Achievement[];
  profile: Profile;
}

/** Gear tier earned per attribute level (mirror of the server rule). */
export function gearTierForLevel(level: number): number {
  if (level >= 10) return 3;
  if (level >= 6) return 2;
  if (level >= 3) return 1;
  return 0;
}

/** Slot each attribute owns on the paper-doll. */
export const GEAR_SLOT_META: Record<
  AttributeKey,
  { label: string; thresholds: [number, number, number] }
> = {
  str: { label: "Weapon", thresholds: [3, 6, 10] },
  int: { label: "Tome", thresholds: [3, 6, 10] },
  vit: { label: "Armor", thresholds: [3, 6, 10] },
  dis: { label: "Helm", thresholds: [3, 6, 10] },
  cha: { label: "Cloak", thresholds: [3, 6, 10] },
  cra: { label: "Instrument", thresholds: [3, 6, 10] },
};
