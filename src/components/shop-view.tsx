"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import {
  Coins,
  Snowflake,
  Scroll,
  Circle,
  Trophy,
  Palette,
  Seal,
  SealCheck,
  Sparkle,
  ArrowLeft,
} from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import {
  RARITY_CLASS,
  RARITY_ORDER,
  type InventoryItem,
  type ShopItem,
} from "@/lib/game/types";
import { Chip, Window, WindowTitle } from "@/components/ui";
import { Toaster } from "@/components/toaster";
import { useGameStore } from "@/lib/game/store";
import { playPurchaseChime, playErrorBuzz } from "@/lib/audio/fanfare";
import Link from "next/link";

const GLYPH_ICONS: Record<string, React.ReactNode> = {
  star: <Sparkle size={22} weight="duotone" aria-hidden="true" />,
  seal: <Seal size={22} weight="duotone" aria-hidden="true" />,
  scroll: <Scroll size={22} weight="duotone" aria-hidden="true" />,
  trophy: <Trophy size={22} weight="duotone" aria-hidden="true" />,
  circle: <Circle size={22} weight="duotone" aria-hidden="true" />,
  palette: <Palette size={22} weight="duotone" aria-hidden="true" />,
  snowflake: <Snowflake size={22} weight="duotone" aria-hidden="true" />,
};

const RARITY_BORDER: Record<string, string> = {
  common: "border-window-border",
  uncommon: "border-rarity-uncommon/50",
  rare: "border-rarity-rare/50",
  epic: "border-rarity-epic/50",
  legendary: "border-rarity-legendary/60",
};

function ShopCard({
  item,
  owned,
  equipped,
  gold,
  onDone,
}: {
  item: ShopItem;
  owned: boolean;
  equipped: boolean;
  gold: number;
  onDone: () => void;
}) {
  const supabase = createClient();
  const pushToast = useGameStore((s) => s.pushToast);
  const [busy, setBusy] = useState(false);
  const [justBought, setJustBought] = useState(false);
  const [isEquipped, setIsEquipped] = useState(equipped);
  const canAfford = gold >= item.price;
  const equipable =
    owned && (item.kind === "frame" || item.kind === "title" || item.kind === "theme");

  async function buy() {
    if (busy || owned) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("purchase_item", { item_id: item.id });
      if (error) throw error;
      playPurchaseChime();
      setJustBought(true);
      pushToast("success", `${item.name} acquired!`);
      onDone();
    } catch (err) {
      playErrorBuzz();
      pushToast("danger", err instanceof Error ? err.message : "Purchase failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEquip() {
    if (busy || !equipable) return;
    setBusy(true);
    const want = !isEquipped;
    try {
      const { error } = await supabase.rpc("equip_item", {
        item_id: item.id,
        want_equipped: want,
      });
      if (error) throw error;
      playPurchaseChime();
      setIsEquipped(want);
      pushToast(
        "success",
        want
          ? `${item.name} equipped.`
          : `${item.name} unequipped.`
      );
      onDone();
    } catch (err) {
      playErrorBuzz();
      pushToast("danger", err instanceof Error ? err.message : "Could not change equipment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.li
      initial={false}
      className={`jrpg-window p-4 sm:p-5 ${RARITY_BORDER[item.rarity]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-11 w-11 items-center justify-center rounded-[8px] border-2 ${RARITY_BORDER[item.rarity]} bg-window-deep ${RARITY_CLASS[item.rarity]}`}>
          {GLYPH_ICONS[item.glyph] ?? GLYPH_ICONS.star}
        </span>
        {owned && (
          <span className="inline-flex items-center gap-1 text-rarity-uncommon text-xs font-bold">
            {isEquipped ? (
              <>
                <SealCheck size={14} weight="fill" aria-hidden="true" /> Equipped
              </>
            ) : (
              <>
                <SealCheck size={14} weight="fill" aria-hidden="true" /> Owned
              </>
            )}
          </span>
        )}
      </div>

      <h3 className={`mt-3 text-sm font-bold ${RARITY_CLASS[item.rarity]}`}>
        {item.name}
      </h3>
      <p className="mt-1.5 min-h-[2.5rem] text-xs leading-relaxed text-ink-dim font-body">
        {item.description}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-gold text-sm font-bold tabular-nums">
          <Coins size={14} weight="duotone" aria-hidden="true" />
          {item.price === 0 ? "Free" : item.price.toLocaleString()}
        </span>
        {justBought ? (
          <span className="pixel-text text-[9px] text-rarity-uncommon">Sold!</span>
        ) : equipable ? (
          <button
            onClick={toggleEquip}
            disabled={busy}
            className={`btn-jrpg px-3.5 py-1.5 text-[9px] ${
              isEquipped ? "btn-ghost" : "btn-primary"
            }`}
            aria-label={
              isEquipped
                ? `Unequip ${item.name}`
                : `Equip ${item.name}`
            }
          >
            {busy ? "…" : isEquipped ? "Unequip" : "Equip"}
          </button>
        ) : (
          <button
            onClick={buy}
            disabled={busy || owned || !canAfford}
            className={`btn-jrpg px-3.5 py-1.5 text-[9px] ${
              owned ? "btn-ghost" : canAfford ? "btn-primary" : "btn-ghost"
            }`}
            aria-label={
              owned
                ? `${item.name} already owned`
                : `Buy ${item.name} for ${item.price} gold`
            }
          >
            {owned ? "Owned" : busy ? "Buying…" : canAfford ? "Buy" : "Need Gold"}
          </button>
        )}
      </div>
    </motion.li>
  );
}

export function ShopView({
  catalog,
  gold,
  inventory,
}: {
  catalog: ShopItem[];
  gold: number;
  inventory: InventoryItem[];
}) {
  const [myGold, setMyGold] = useState(gold);
  const [myInventory, setMyInventory] = useState(inventory);
  const reduce = useReducedMotion();

  const ownedIds = useMemo(
    () => new Set(myInventory.map((i) => i.id)),
    [myInventory]
  );
  const equippedIds = useMemo(
    () => new Set(myInventory.filter((i) => i.equipped).map((i) => i.id)),
    [myInventory]
  );

  const byKind = useMemo(
    () => ({
      title: catalog.filter((i) => i.kind === "title" && i.purchasable),
      frame: catalog.filter((i) => i.kind === "frame" && i.purchasable),
      theme: catalog.filter((i) => i.kind === "theme" && i.purchasable),
      consumable: catalog.filter((i) => i.kind === "consumable" && i.purchasable),
      badge: catalog.filter((i) => i.kind === "badge" && i.purchasable),
    }),
    [catalog]
  );

  const sections: { key: keyof typeof byKind; label: string; blurb: string }[] = [
    { key: "title", label: "Titles", blurb: "Worn beside your name on the guild rolls." },
    { key: "frame", label: "Avatar Frames", blurb: "The ring around your sigil." },
    { key: "theme", label: "Board Themes", blurb: "Alternate palettes for your quest board." },
    { key: "consumable", label: "Consumables", blurb: "One-time protections and boosts." },
    { key: "badge", label: "Badges", blurb: "Proof of deeds, earned and displayed." },
  ];

  function refresh() {
    (async () => {
      const supabase = createClient();
      const { data: sheet } = await supabase.rpc("get_character_sheet");
      if (sheet) {
        setMyGold(sheet.profile?.gold ?? myGold);
        setMyInventory(sheet.inventory ?? []);
      }
    })();
  }

  return (
    <div className="page-field">
      <Toaster />
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
        {/* header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="pixel-text text-sm sm:text-base leading-relaxed text-ink">
              Guild Shop
            </h1>
            <p className="mt-1 text-sm text-ink-faint font-body">
              Gold earned from quests, spent on glory.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-[8px] border-2 border-gold-deep/60 bg-window px-3.5 py-2 text-gold font-bold tabular-nums">
              <Coins size={16} weight="duotone" aria-hidden="true" />
              {myGold.toLocaleString()}
            </span>
            <Link href="/quests" className="btn-jrpg btn-ghost px-4 py-2 text-[10px]">
              <ArrowLeft size={12} weight="bold" aria-hidden="true" /> Board
            </Link>
          </div>
        </div>

        {/* rarity legend */}
        <div className="mb-8 flex flex-wrap items-center gap-2" aria-label="Rarity legend">
          {RARITY_ORDER.map((r) => (
            <Chip key={r} colorClass={RARITY_CLASS[r]}>
              {r}
            </Chip>
          ))}
        </div>

        {/* sections */}
        <div className="space-y-10">
          {sections
            .filter((s) => byKind[s.key].length > 0)
            .map((s, si) => (
              <Window key={s.key} as="section" className="overflow-hidden">
                <WindowTitle>
                  {s.label} <span className="text-ink-faint normal-case">— {s.blurb}</span>
                </WindowTitle>
                <motion.ul
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: si * 0.04 }}
                  className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3 xl:grid-cols-4"
                >
                  <AnimatePresence initial={false}>
                    {byKind[s.key].map((item) => (
                      <ShopCard
                        key={item.id}
                        item={item}
                        owned={ownedIds.has(item.id)}
                        equipped={equippedIds.has(item.id)}
                        gold={myGold}
                        onDone={refresh}
                      />
                    ))}
                  </AnimatePresence>
                </motion.ul>
              </Window>
            ))}
        </div>
      </div>
    </div>
  );
}
