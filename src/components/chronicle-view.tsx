"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  BookOpen,
  ChartBar,
  Fire,
  Sparkle,
  Coins,
  DiceFive,
  Medal,
  TreasureChest,
  Sword,
  CalendarBlank,
} from "@phosphor-icons/react";
import type {
  ChronicleData,
  ChronicleEvent,
  ChronicleTotals,
  HeatmapCell,
  WeeklyBucket,
  AttributeKey,
} from "@/lib/game/types";
import { ATTRIBUTE_META } from "@/lib/game/types";
import { Chip, Window, WindowTitle } from "@/components/ui";

/** Heatmap intensity level for a day (0–4). */
function heatLevel(quests: number): 0 | 1 | 2 | 3 | 4 {
  if (quests <= 0) return 0;
  if (quests === 1) return 1;
  if (quests <= 3) return 2;
  if (quests <= 5) return 3;
  return 4;
}

const HEAT_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-window-deep/60",
  1: "bg-gold/30",
  2: "bg-gold/55",
  3: "bg-gold/75",
  4: "bg-gold",
};

const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const DAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

function fmtDate(day: string): string {
  const d = new Date(day + "T00:00:00Z");
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** The 26-week contribution heatmap — a scribe's calendar of deeds. */
function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  // cells arrive sorted ascending, exactly 26 full weeks (Mon..Sun columns)
  const weeks: HeatmapCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  // month labels above the grid (first week a month appears in)
  const monthMarks: { col: number; label: string }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, col) => {
    const first = week[0];
    if (!first) return;
    const m = new Date(first.day + "T00:00:00Z").getUTCMonth();
    if (m !== lastMonth) {
      monthMarks.push({ col, label: MONTH_LABELS[m] });
      lastMonth = m;
    }
  });

  return (
    <div role="img" aria-label="Activity heatmap of the last 26 weeks. Rows are weekdays Monday through Sunday; darker squares mean more quests completed that day.">
      <div className="flex gap-2">
        {/* weekday labels */}
        <div className="flex flex-col gap-[3px] pt-[18px]" aria-hidden="true">
          {DAY_LABELS.map((d, i) => (
            <span
              key={i}
              className="h-[13px] text-[8px] leading-[13px] text-ink-faint w-6 text-right"
            >
              {d}
            </span>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="min-w-max">
            {/* month labels */}
            <div className="relative mb-1 h-[14px]" aria-hidden="true">
              {monthMarks.map((m) => (
                <span
                  key={m.col}
                  className="absolute text-[9px] font-bold text-ink-faint"
                  style={{ left: `${m.col * 16}px` }}
                >
                  {m.label}
                </span>
              ))}
            </div>
            {/* grid: columns = weeks, rows = weekdays */}
            <div className="flex gap-[3px]">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((cell) => {
                    const level = heatLevel(cell.quests);
                    return (
                      <span
                        key={cell.day}
                        className={`h-[13px] w-[13px] rounded-[2px] border border-window-border/40 ${HEAT_CLASSES[level]}`}
                        title={`${fmtDate(cell.day)} — ${cell.quests} quest${cell.quests === 1 ? "" : "s"}, ${cell.xp} XP`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* legend */}
      <div className="mt-3 flex items-center justify-end gap-1.5" aria-hidden="true">
        <span className="text-[9px] text-ink-faint">fewer</span>
        {([0, 1, 2, 3, 4] as const).map((l) => (
          <span
            key={l}
            className={`h-[11px] w-[11px] rounded-[2px] border border-window-border/40 ${HEAT_CLASSES[l]}`}
          />
        ))}
        <span className="text-[9px] text-ink-faint">more</span>
      </div>
    </div>
  );
}

/** Weekly XP per attribute — stacked ink bars over the trailing 8 weeks. */
function WeeklyBars({ weekly }: { weekly: WeeklyBucket[] }) {
  const attrs: AttributeKey[] = ["str", "int", "vit", "dis", "cha", "cra"];
  const max = Math.max(
    1,
    ...weekly.map((w) =>
      attrs.reduce((sum, a) => sum + (w.xp[a] ?? 0), 0)
    )
  );

  return (
    <div
      className="flex items-end gap-2 sm:gap-3"
      role="img"
      aria-label={
        "Weekly experience per attribute over the last " +
        weekly.length +
        " weeks. " +
        weekly
          .map((w) => {
            const parts = attrs
              .filter((a) => (w.xp[a] ?? 0) > 0)
              .map((a) => `${ATTRIBUTE_META[a].label} ${w.xp[a]}`);
            return `Week of ${w.week}: ${parts.length ? parts.join(", ") : "no activity"}.`;
          })
          .join(" ")
      }
    >
      {weekly.map((w) => {
        const total = attrs.reduce((sum, a) => sum + (w.xp[a] ?? 0), 0);
        const h = (total / max) * 100;
        return (
          <div key={w.week} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex h-32 w-full items-end justify-center" aria-hidden="true">
              <div
                className="flex w-full max-w-[42px] flex-col-reverse overflow-hidden rounded-[2px] border-2 border-window-border"
                style={{ height: `${Math.max(total > 0 ? 8 : 0, h)}%` }}
                title={`Week of ${w.week} — ${total} XP, ${w.quests} quests`}
              >
                {attrs.map((a) => {
                  const v = w.xp[a] ?? 0;
                  if (v <= 0) return null;
                  return (
                    <div
                      key={a}
                      style={{
                        height: `${(v / Math.max(total, 1)) * 100}%`,
                        backgroundColor: `var(${ATTRIBUTE_META[a].colorVar})`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
            <span className="text-[8px] text-ink-faint tabular-nums">
              {w.week.slice(5).replace("-", "/")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TotalStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[4px] border-2 border-window-border bg-parchment-deep/50 px-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-window-border bg-window-deep text-gold">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-none tabular-nums">{value}</p>
        <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-ink-faint">
          {label}
        </p>
      </div>
    </div>
  );
}

/** Render one ledger entry as a readable line. */
function EventLine({ ev }: { ev: ChronicleEvent }) {
  const d = ev.detail;
  const when = new Date(ev.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const what = ev.event;

  let text: React.ReactNode;
  let icon: React.ReactNode;

  if (what === "task_completed") {
    const reopened = d.reopened_no_reward === true;
    text = (
      <>
        Completed{" "}
        <strong className="font-bold">{String(d.title ?? "a quest")}</strong>
        {reopened ? (
          <span className="text-ink-faint"> (deed re-entered, no reward)</span>
        ) : (
          <>
            {" "}— +{String(d.xp ?? 0)}xp, +{String(d.gold ?? 0)}g
            {d.crit === true && (
              <span className="text-gold font-bold"> · CRIT (nat {String(d.crit_roll)})</span>
            )}
            {typeof d.quest_multiplier === "number" && d.quest_multiplier > 1 && (
              <span className="text-rarity-rare"> · ×{d.quest_multiplier} streak bonus</span>
            )}
          </>
        )}
      </>
    );
    icon = <Sword size={14} weight="duotone" className="text-gold" aria-hidden="true" />;
  } else if (what === "achievement_unlocked") {
    text = (
      <>
        Unlocked the honor{" "}
        <strong className="font-bold">{String(d.achievement ?? "Unknown")}</strong>
        {typeof d.gold === "number" && d.gold > 0 && (
          <span> · +{d.gold}g bounty</span>
        )}
      </>
    );
    icon = <Medal size={14} weight="duotone" className="text-rarity-rare" aria-hidden="true" />;
  } else if (what === "chest_claimed") {
    text = (
      <>
        Claimed the daily chest — +{String(d.gold ?? 0)}g
        {d.item ? <> and a <strong className="font-bold">{String(d.item)}</strong></> : null}
      </>
    );
    icon = <TreasureChest size={14} weight="duotone" className="text-gold" aria-hidden="true" />;
  } else if (what === "item_purchased") {
    text = (
      <>
        Bought <strong className="font-bold">{String(d.item ?? "an item")}</strong> for{" "}
        {String(d.price ?? 0)}g
      </>
    );
    icon = <Coins size={14} weight="duotone" className="text-gold" aria-hidden="true" />;
  } else {
    text = <span>{what.replace(/_/g, " ")}</span>;
    icon = <Sparkle size={14} weight="duotone" className="text-ink-dim" aria-hidden="true" />;
  }

  return (
    <li className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p className="min-w-0 flex-1 text-sm leading-snug font-body">
        {text}
      </p>
      <span className="shrink-0 text-[9px] uppercase tracking-wide text-ink-faint tabular-nums">
        {when}
      </span>
    </li>
  );
}

/** The Chronicle page composition. */
export function ChronicleView({ data }: { data: ChronicleData }) {
  const reduce = useReducedMotion();
  const totals: ChronicleTotals = data.totals;
  const bestStreak = data.profile?.streak_best ?? 0;

  const legend = (
    <div className="mb-5 flex flex-wrap items-center gap-1.5" aria-label="Attribute color legend">
      {(["str", "int", "vit", "dis", "cha", "cra"] as AttributeKey[]).map((a) => (
        <Chip key={a} colorClass={`text-[${ATTRIBUTE_META[a].colorVar}]`}>
          {ATTRIBUTE_META[a].label}
        </Chip>
      ))}
    </div>
  );

  return (
    <div className="page-field">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-10">
        {/* header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <h1 className="pixel-text text-sm sm:text-base leading-relaxed text-ink">
              The Chronicle
            </h1>
            <span className="pixel-text rounded bg-gold/15 border border-gold/40 px-2 py-0.5 text-[10px] font-bold text-gold">
              Ledger of Deeds
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-faint font-body">
            Every quest you have ever finished, remembered in ink. The guild
            forgets nothing.
          </p>
        </div>

        {/* totals */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <TotalStat
            icon={<Sword size={16} weight="duotone" aria-hidden="true" />}
            label="Quests"
            value={totals.quests.toLocaleString()}
          />
          <TotalStat
            icon={<Sparkle size={16} weight="duotone" aria-hidden="true" />}
            label="Lifetime XP"
            value={totals.xp.toLocaleString()}
          />
          <TotalStat
            icon={<Coins size={16} weight="duotone" aria-hidden="true" />}
            label="Gold Earned"
            value={totals.gold.toLocaleString()}
          />
          <TotalStat
            icon={<DiceFive size={16} weight="duotone" aria-hidden="true" />}
            label="Natural 20s"
            value={totals.crits.toLocaleString()}
          />
          <TotalStat
            icon={<CalendarBlank size={16} weight="duotone" aria-hidden="true" />}
            label="Active Days"
            value={totals.active_days.toLocaleString()}
          />
          <TotalStat
            icon={<Fire size={16} weight="duotone" aria-hidden="true" />}
            label="Best Streak"
            value={`${bestStreak}d`}
          />
        </div>

        {/* heatmap */}
        <Window as="section" className="mb-6 overflow-hidden">
          <WindowTitle
            right={
              <span className="pixel-text ledger-nums text-[10px] text-ink-dim">
                26 weeks
              </span>
            }
          >
            Calendar of Deeds
          </WindowTitle>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 sm:p-5"
          >
            <Heatmap cells={data.heatmap} />
          </motion.div>
        </Window>

        {/* weekly bars */}
        <Window as="section" className="mb-6 overflow-hidden">
          <WindowTitle
            right={
              <span className="pixel-text ledger-nums text-[10px] text-ink-dim">
                8 weeks
              </span>
            }
          >
            Training by Week
          </WindowTitle>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 sm:p-5"
          >
            {legend}
            <WeeklyBars weekly={data.weekly} />
          </motion.div>
        </Window>

        {/* event feed */}
        <Window as="section" className="overflow-hidden">
          <WindowTitle
            right={
              <span className="pixel-text ledger-nums text-[10px] text-ink-dim">
                {data.events.length} entries
              </span>
            }
          >
            Recent Ledger Entries
          </WindowTitle>
          {data.events.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <BookOpen size={40} weight="duotone" className="text-ink-faint" aria-hidden="true" />
              <p className="pixel-text text-[11px] leading-relaxed text-ink-dim">
                The ledger is blank
              </p>
              <p className="max-w-[36ch] text-sm text-ink-faint font-body">
                Complete your first quest and the scribes will begin your
                chronicle.
              </p>
            </div>
          ) : (
            <ul
              className="divide-y divide-window-border/40"
              aria-label="Recent activity"
            >
              {data.events.map((ev, i) => (
                <EventLine key={`${ev.event}-${i}`} ev={ev} />
              ))}
            </ul>
          )}
        </Window>

        {/* footnote */}
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[10px] text-ink-faint font-body">
          <ChartBar size={12} weight="duotone" aria-hidden="true" />
          Aggregated from your activity ledger — recorded on the server with
          every completion.
        </p>
      </div>
    </div>
  );
}
