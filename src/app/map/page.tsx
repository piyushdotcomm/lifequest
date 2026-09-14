import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { GameShell } from "@/components/game-shell";
import { SheetProvider } from "@/components/sheet-provider";
import { WorldMap } from "@/components/world-map";

export const metadata: Metadata = {
  title: "World Map",
  description: "The Sunken Road — zones of your chronicle, unlocked by levels.",
};

export default async function MapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sheet } = await supabase.rpc("get_character_sheet");

  const equippedThemeSlug = sheet?.inventory?.find(
    (i: { kind: string; equipped: boolean }) => i.kind === "theme" && i.equipped
  )?.slug;

  return (
    <GameShell equippedThemeSlug={equippedThemeSlug}>
      <SheetProvider
        initialSheet={{
          profile: sheet?.profile ?? null,
          attributes: sheet?.attributes ?? [],
          inventory: sheet?.inventory ?? [],
          gear: sheet?.gear ?? {},
          zones: sheet?.zones ?? [],
          achievements: sheet?.achievements ?? [],
        }}
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="pixel-text text-base sm:text-lg leading-tight text-ink">
                  World Map
                </h1>
                <span className="pixel-text text-[10px] rounded bg-gold/15 text-gold border border-gold/40 px-2 py-0.5 font-bold">
                  The Sunken Road
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-faint font-body">
                Every level you earn walks the road further. Explore the sovereign biomes, master your attributes, and lift the fog of war.
              </p>
            </div>
            {sheet?.profile && (
              <div className="flex items-center gap-3 pixel-text text-xs text-ink-dim">
                <span className="border-2 border-window-border bg-window px-2.5 py-1 rounded">
                  Lv {sheet.profile.level} {sheet.profile.class_name}
                </span>
              </div>
            )}
          </div>
          {sheet?.profile ? (
            <WorldMap
              zones={sheet?.zones ?? []}
              profile={sheet.profile}
              attributes={sheet?.attributes ?? []}
            />
          ) : (
            <p className="text-sm text-ink-dim font-body">
              Character sheet not found.
            </p>
          )}
        </div>
      </SheetProvider>
    </GameShell>
  );
}
