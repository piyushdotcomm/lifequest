"use client";

import { motion, useReducedMotion } from "motion/react";
import { Medal } from "@phosphor-icons/react";
import type { Rarity } from "@/lib/game/types";
import { RARITY_CLASS } from "@/lib/game/types";
import { Window, WindowTitle } from "@/components/ui";

/** A guild achievement unlocked by this hero. */
export interface UnlockedAchievement {
  slug: string;
  name: string;
  description: string;
  rarity: Rarity;
  unlocked_at: string;
}

/**
 * The guild honors panel — scroll of unlocked achievements.
 * Locked ones stay hidden; deeds speak when they happen.
 */
export function AchievementsPanel({
  achievements,
}: {
  achievements: UnlockedAchievement[];
}) {
  const reduce = useReducedMotion();

  return (
    <Window as="section" className="overflow-hidden">
      <WindowTitle
        right={
          <span className="pixel-text ledger-nums text-[10px] text-ink-dim">
            {achievements.length}
          </span>
        }
      >
        Guild Honors
      </WindowTitle>
      {achievements.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-ink-faint font-body">
          No honors yet. Complete quests, keep streaks, roll crits — the guild
          is watching.
        </p>
      ) : (
        <ul
          className="divide-y divide-window-border/40"
          aria-label="Unlocked achievements"
        >
          {achievements.map((a, i) => (
            <motion.li
              key={a.slug}
              initial={reduce ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.4) }}
              className="flex items-center gap-3 px-4 py-3 sm:px-5"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border-2 border-window-border bg-window-deep ${RARITY_CLASS[a.rarity]}`}
                aria-hidden="true"
              >
                <Medal size={18} weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-tight">{a.name}</p>
                <p className="mt-0.5 text-xs text-ink-dim font-body">
                  {a.description}
                </p>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </Window>
  );
}
