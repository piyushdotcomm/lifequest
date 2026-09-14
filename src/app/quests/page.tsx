import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { GameShell } from "@/components/game-shell";
import { QuestBoardView } from "@/components/quest-board-view";
import { SheetProvider } from "@/components/sheet-provider";

export const metadata: Metadata = {
  title: "Quest Board",
  description: "Your daily quests, attributes, and streaks.",
};

export default async function QuestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sheet } = await supabase.rpc("get_character_sheet");

  const equippedTitle = sheet?.inventory?.find(
    (i: { kind: string; equipped: boolean }) => i.kind === "title" && i.equipped
  )?.name;
  const equippedThemeSlug = sheet?.inventory?.find(
    (i: { kind: string; equipped: boolean; slug: string }) =>
      i.kind === "theme" && i.equipped
  )?.slug;
  const equippedFrameSlug = sheet?.inventory?.find(
    (i: { kind: string; equipped: boolean; slug: string }) =>
      i.kind === "frame" && i.equipped
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
        <QuestBoardView
          equippedTitle={equippedTitle}
          equippedFrameSlug={equippedFrameSlug}
        />
      </SheetProvider>
    </GameShell>
  );
}
