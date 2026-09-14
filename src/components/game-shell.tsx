"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOut, Sword, Storefront, MapTrifold, BookOpen } from "@phosphor-icons/react";
import { Toaster } from "@/components/toaster";
import { OfflineBanner } from "@/components/offline-banner";
import { ThemeApplier } from "@/components/theme-applier";

/**
 * Shell for authenticated game pages: top nav + toaster + equipped theme.
 */
export function GameShell({
  children,
  equippedThemeSlug,
}: {
  children: React.ReactNode;
  equippedThemeSlug?: string | null;
}) {
  const pathname = usePathname();

  const links = [
    { href: "/quests", label: "Quests", icon: <Sword size={14} weight="duotone" aria-hidden="true" /> },
    { href: "/map", label: "Map", icon: <MapTrifold size={14} weight="duotone" aria-hidden="true" /> },
    { href: "/shop", label: "Shop", icon: <Storefront size={14} weight="duotone" aria-hidden="true" /> },
    { href: "/chronicle", label: "Chronicle", icon: <BookOpen size={14} weight="duotone" aria-hidden="true" /> },
  ];

  return (
    <div className="page-field flex min-h-[100dvh] flex-col">
      <ThemeApplier equippedThemeSlug={equippedThemeSlug} />
      <OfflineBanner />
      <header className="sticky top-0 z-30 border-b-2 border-window-border/60 bg-field/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/quests"
            className="pixel-text text-gold text-[11px] sm:text-xs leading-none transition-opacity hover:opacity-80"
          >
            Life<span className="text-ink">Quest</span>
          </Link>

          <nav aria-label="Game" className="flex items-center gap-1 sm:gap-2">
            {links.map((l) => {
              const active = pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`btn-jrpg px-2.5 py-1.5 text-[10px] ${
                    active ? "btn-primary" : "btn-ghost"
                  }`}
                >
                  {l.icon}
                  <span className="hidden min-[460px]:inline">{l.label}</span>
                </Link>
              );
            })}
            {/* Sign out = POST to route handler, no JS required */}
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="btn-jrpg btn-ghost px-2.5 py-1.5 text-[10px]"
                aria-label="Sign out"
                title="Sign out"
              >
                <SignOut size={14} weight="bold" aria-hidden="true" />
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <Toaster />
    </div>
  );
}
