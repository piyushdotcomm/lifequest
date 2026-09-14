import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { GameShell } from "@/components/game-shell";
import { ShopView } from "@/components/shop-view";

export const metadata: Metadata = {
  title: "Guild Shop",
  description: "Spend your gold on titles, frames, themes, and streak protection.",
};

export default async function ShopPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: catalog }, { data: sheet }] = await Promise.all([
    supabase.from("item_catalog").select("*").order("price"),
    supabase.rpc("get_character_sheet"),
  ]);

  const equippedThemeSlug = sheet?.inventory?.find(
    (i: { kind: string; equipped: boolean }) => i.kind === "theme" && i.equipped
  )?.slug;

  return (
    <GameShell equippedThemeSlug={equippedThemeSlug}>
      <ShopView
        catalog={catalog ?? []}
        gold={sheet?.profile?.gold ?? 0}
        inventory={sheet?.inventory ?? []}
      />
    </GameShell>
  );
}
