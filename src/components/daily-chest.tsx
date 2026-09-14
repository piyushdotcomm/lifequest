"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { TreasureChest, Coins, Sparkle } from "@phosphor-icons/react";
import type { ClaimChestResult, Profile } from "@/lib/game/types";
import { RARITY_CLASS, type Rarity } from "@/lib/game/types";
import { Window, WindowTitle } from "@/components/ui";
import { useGameStore } from "@/lib/game/store";
import { createClient } from "@/lib/supabase/client";
import { playChestSound, playAchievementFanfare } from "@/lib/audio/fanfare";

/**
 * The Daily Adventurer's Chest — one claim per UTC day.
 * Streak-scaled gold + a weighted loot roll, paid by claim_chest().
 */
export function DailyChest({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const reduce = useReducedMotion();
  const pushToast = useGameStore((s) => s.pushToast);
  const setProfile = useGameStore((s) => s.setProfile);

  const today = new Date().toISOString().slice(0, 10);
  const claimedToday = profile.chest_last_claimed === today;

  const [busy, setBusy] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [result, setResult] = useState<ClaimChestResult | null>(null);

  async function claim() {
    if (busy || claimedToday) return;
    setBusy(true);
    if (!reduce) {
      setShaking(true);
      await new Promise((r) => setTimeout(r, 600));
      setShaking(false);
    }
    try {
      const { data, error } = await supabase.rpc("claim_chest");
      if (error) throw error;
      if (data) {
        const res = data as ClaimChestResult;
        setResult(res);
        playChestSound();
        setProfile(res.profile);
        for (const a of res.achievements ?? []) {
          playAchievementFanfare();
          pushToast(
            "success",
            `Achievement unlocked: ${a.name}${a.gold_reward ? ` (+${a.gold_reward}g)` : ""}`
          );
        }
      }
    } catch (err) {
      pushToast("danger", err instanceof Error ? err.message : "The chest would not open.");
    } finally {
      setBusy(false);
    }
  }

  const streakBonus = Math.min(Math.floor((profile.streak_count ?? 0) / 3), 20);
  const projected = 15 + streakBonus;

  return (
    <Window as="section" className="overflow-hidden">
      <WindowTitle
        right={
          <span className="pixel-text ledger-nums text-[10px] text-ink-dim">
            {claimedToday ? "opens tomorrow" : `+${projected}g today`}
          </span>
        }
      >
        Daily Adventurer&apos;s Chest
      </WindowTitle>

      <div className="flex flex-col items-center gap-4 p-5 text-center">
        {/* the chest */}
        <button
          onClick={claim}
          disabled={busy || claimedToday}
          aria-label={
            claimedToday
              ? "Chest already claimed today"
              : "Open the daily adventurer's chest"
          }
          className={`flex h-20 w-20 items-center justify-center rounded-[8px] border-2 border-window-border bg-parchment-deep transition-transform hover:scale-105 disabled:hover:scale-100 ${
            claimedToday ? "opacity-50" : ""
          }`}
        >
          <span className={shaking ? "chest-shake-anim inline-block" : "inline-block"}>
            <TreasureChest
              size={40}
              weight={claimedToday ? "regular" : "duotone"}
              className={claimedToday ? "text-ink-faint" : "text-gold"}
              aria-hidden="true"
            />
          </span>
        </button>

        {claimedToday && !result && (
          <p className="text-sm text-ink-faint font-body">
            Empty for today. The scribes refill it at midnight UTC — keep your
            streak alive for a richer chest.
          </p>
        )}
        {!claimedToday && (
          <p className="text-sm text-ink-dim font-body">
            Streak-scaled gold{streakBonus > 0 && <> — <strong className="text-rarity-epic">+{streakBonus}</strong> from your {profile.streak_count}-day streak</>}{". "}
            Sometimes it holds more.
          </p>
        )}

        {/* result reveal */}
        <AnimatePresence>
          {result && (
            <motion.div
              key="chest-result"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="wax-stamp-anim w-full rounded-[4px] border-2 border-gold-deep/60 bg-parchment-deep/60 px-4 py-3"
              role="status"
            >
              <p className="pixel-text text-[10px] text-gold">The chest held:</p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-ink font-bold tabular-nums">
                <Coins size={15} weight="duotone" className="text-gold" aria-hidden="true" />
                +{result.gold_gained} gold
              </p>
              {result.item_name ? (
                <p className={`mt-1 inline-flex items-center gap-1.5 text-sm font-bold ${
                  result.item_rarity ? RARITY_CLASS[result.item_rarity as Rarity] : ""
                }`}>
                  <Sparkle size={13} weight="fill" aria-hidden="true" />
                  {result.item_name} — yours!
                </p>
              ) : (
                <p className="mt-1 text-xs text-ink-faint font-body">
                  Gold, and the quiet satisfaction of consistency.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Window>
  );
}
