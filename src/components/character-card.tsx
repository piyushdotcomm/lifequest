"use client";

import { Coins, Flame, Sparkle, DiceFive } from "@phosphor-icons/react";
import type { AttributeRow, GearMap, Profile } from "@/lib/game/types";
import { StatBar, Window, WindowTitle } from "@/components/ui";
import { PaperDollAvatar, GearSlots } from "@/components/paper-doll";

/** Needed XP for the next profile level (mirror of the server curve). */
export function xpNeeded(level: number): number {
  return Math.round(100 * Math.pow(level, 1.5));
}

/** Map of purchasable frame slugs to plaque ring colors. */
const FRAME_STYLES: Record<string, { ring: string; label: string }> = {
  "frame-bronze": { ring: "oklch(62% 0.09 65)", label: "Bronze Frame" },
  "frame-silver": { ring: "oklch(78% 0.02 250)", label: "Silver Frame" },
  "frame-gold": { ring: "oklch(72% 0.14 92)", label: "Gold-Leaf Frame" },
  "frame-rainbow": { ring: "oklch(60% 0.16 330)", label: "Prismatic Frame" },
};

/** The character sheet header card. */
export function CharacterCard({
  profile,
  equippedTitle,
  equippedFrameSlug,
  gear,
  attributes,
  newGear,
}: {
  profile: Profile;
  equippedTitle?: string;
  equippedFrameSlug?: string | null;
  gear: GearMap;
  attributes: AttributeRow[];
  newGear?: string | null;
}) {
  const need = xpNeeded(profile.level);
  const frame = equippedFrameSlug ? FRAME_STYLES[equippedFrameSlug] : undefined;

  return (
    <Window as="article" className="overflow-hidden">
      <WindowTitle>Character</WindowTitle>
      <div className="p-4 sm:p-6">
        <div className="flex items-start gap-4">
          {/* Paper-doll avatar (with equipped frame ring) */}
          <div className="relative shrink-0">
            {frame && (
              <span
                className="absolute -inset-1.5 rounded-[6px] border-[3px]"
                style={{ borderColor: frame.ring }}
                title={`${frame.label} — equipped`}
                aria-hidden="true"
              />
            )}
            <PaperDollAvatar
              gear={gear}
              level={profile.level}
              size={96}
              animateNewGear={newGear}
            />
          </div>

          {/* Name + class + title */}
          <div className="min-w-0 flex-1">
            <h3 className="pixel-text truncate text-sm sm:text-base leading-relaxed text-ink">
              {profile.display_name}
            </h3>
            <p className="mt-1 text-sm text-ink-dim font-body">
              {profile.class_name}
              {equippedTitle && (
                <span className="text-rarity-rare"> · {equippedTitle}</span>
              )}
            </p>

            {/* Gold + streak + crits */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-1.5 text-gold tabular-nums">
                <Coins size={16} weight="duotone" aria-hidden="true" />
                {profile.gold.toLocaleString()}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 tabular-nums ${
                  profile.streak_count > 0 ? "text-rarity-epic" : "text-ink-faint"
                }`}
                title="Consecutive active days"
              >
                <Flame
                  size={16}
                  weight={profile.streak_count > 0 ? "fill" : "duotone"}
                  aria-hidden="true"
                />
                {profile.streak_count}d streak
              </span>
              {(profile.crit_count ?? 0) > 0 && (
                <span
                  className="inline-flex items-center gap-1 text-gold tabular-nums text-xs font-bold"
                  title="Natural 20s rolled"
                >
                  <DiceFive size={14} weight="fill" aria-hidden="true" />
                  {profile.crit_count} crit{profile.crit_count === 1 ? "" : "s"}
                </span>
              )}
              {profile.streak_best > 1 && (
                <span className="inline-flex items-center gap-1 text-ink-faint tabular-nums text-xs">
                  best {profile.streak_best}d
                </span>
              )}
            </div>
          </div>
        </div>

        {/* XP to next level */}
        <div className="mt-5">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="pixel-text inline-flex items-center gap-1.5 text-[9px] text-ink-dim">
              <Sparkle size={11} weight="fill" aria-hidden="true" />
              Next Level
            </span>
            <span className="text-xs text-ink-faint tabular-nums">
              {profile.xp} / {need} XP
            </span>
          </div>
          <StatBar value={profile.xp} max={need} size="lg" label={undefined} showNumbers={false} />
        </div>

        {/* Equipment pips */}
        <div className="mt-5">
          <p className="pixel-text mb-2 text-[9px] text-ink-dim">Equipment</p>
          <GearSlots gear={gear} attributes={attributes} />
        </div>
      </div>
    </Window>
  );
}

