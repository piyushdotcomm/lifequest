import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { GameShell } from "@/components/game-shell";
import { ChronicleView } from "@/components/chronicle-view";
import type { ChronicleData } from "@/lib/game/types";

export const metadata: Metadata = {
  title: "The Chronicle",
  description:
    "Your ledger of deeds — activity heatmap, weekly attribute training, and lifetime totals.",
};

export default async function ChroniclePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: sheet }, { data: chronicle }] = await Promise.all([
    supabase.rpc("get_character_sheet"),
    supabase.rpc("get_chronicle"),
  ]);

  const equippedThemeSlug = sheet?.inventory?.find(
    (i: { kind: string; equipped: boolean }) => i.kind === "theme" && i.equipped
  )?.slug;

  return (
    <GameShell equippedThemeSlug={equippedThemeSlug}>
      {chronicle ? (
        <ChronicleView data={chronicle as ChronicleData} />
      ) : (
        <div className="mx-auto max-w-xl px-4 py-16">
          <p className="text-center text-sm text-ink-dim font-body">
            The scribes could not open your ledger. Check your connection and
            try again.
          </p>
        </div>
      )}
    </GameShell>
  );
}
