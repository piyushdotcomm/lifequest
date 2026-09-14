"use client";

import { useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/lib/game/store";
import type { Task } from "@/lib/game/types";
import { TIER_META } from "@/lib/game/types";
import { AttributesPanel } from "@/components/attributes-panel";
import { CharacterCard } from "@/components/character-card";
import { QuestBoard } from "@/components/quest-board";
import { LevelUpOverlay, XPOrbBurst, CritBanner } from "@/components/celebration";
import { DailyChest } from "@/components/daily-chest";
import { AchievementsPanel } from "@/components/achievements-panel";
import { playLevelUpFanfare, playCritSting } from "@/lib/audio/fanfare";
import { MapTrifold, BookOpen } from "@phosphor-icons/react";

/**
 * The quest board page composition: character card + attributes + quest list,
 * with celebration FX, daily chest, and crit banners wired in.
 */
export function QuestBoardView({
  equippedTitle,
  equippedFrameSlug,
}: {
  equippedTitle?: string;
  equippedFrameSlug?: string | null;
}) {
  const profile = useGameStore((s) => s.profile);
  const attributes = useGameStore((s) => s.attributes);
  const gear = useGameStore((s) => s.gear);
  const achievements = useGameStore((s) => s.achievements);
  const celebrateLevelUp = useGameStore((s) => s.celebrateLevelUp);
  const lastCompletion = useGameStore((s) => s.lastCompletion);
  const clearCelebration = useGameStore((s) => s.clearCelebration);
  const [orb, setOrb] = useState<{
    origin: { x: number; y: number };
    xpGained: number;
  } | null>(null);
  const [critRoll, setCritRoll] = useState<number | null>(null);

  function handleCompleted(task: Task, origin: { x: number; y: number }) {
    const result = useGameStore.getState().lastCompletion;
    if (result?.crit) {
      setCritRoll(result.crit_roll ?? 20);
      playCritSting();
      setTimeout(() => setCritRoll(null), 2600);
    }
    setOrb({ origin, xpGained: result?.xp_gained ?? TIER_META[task.tier].xp });
    setTimeout(() => setOrb(null), 900);
  }

  if (!profile) return null;

  return (
    <div className="page-field">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
        {/* header row */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="pixel-text text-sm sm:text-base leading-relaxed text-ink">
              Quest Board
            </h1>
            <p className="mt-1 text-sm text-ink-faint font-body">
              Complete quests, earn gold, keep the streak alive.
            </p>
          </div>
          <nav aria-label="Game" className="flex items-center gap-2">
            <Link href="/map" className="btn-jrpg btn-ghost px-4 py-2 text-[10px]">
              <MapTrifold size={12} weight="duotone" aria-hidden="true" /> World Map
            </Link>
            <Link href="/shop" className="btn-jrpg btn-ghost px-4 py-2 text-[10px]">
              Guild Shop
            </Link>
            <Link href="/chronicle" className="btn-jrpg btn-ghost px-4 py-2 text-[10px]">
              <BookOpen size={12} weight="duotone" aria-hidden="true" /> Chronicle
            </Link>
          </nav>
        </div>

        {/* board grid */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* left column: character */}
          <div className="flex flex-col gap-6">
            <CharacterCard
              profile={profile}
              equippedTitle={equippedTitle}
              equippedFrameSlug={equippedFrameSlug}
              gear={gear}
              attributes={attributes}
              newGear={lastCompletion?.gear_granted}
            />
            <AttributesPanel attributes={attributes} />
            <DailyChest profile={profile} />
            <AchievementsPanel achievements={achievements} />
          </div>

          {/* right column: quests */}
          <QuestBoard onCompleted={handleCompleted} />
        </div>
      </div>

      {/* celebration FX */}
      {orb && <XPOrbBurst origin={orb.origin} xpGained={orb.xpGained} />}
      {critRoll !== null && (
        <CritBanner roll={critRoll} onDone={() => setCritRoll(null)} />
      )}
      {celebrateLevelUp && lastCompletion && (
        <LevelUpOverlay
          result={lastCompletion}
          onDone={() => {
            playLevelUpFanfare();
            clearCelebration();
          }}
        />
      )}
    </div>
  );
}
