"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  X,
  PencilSimple,
  Trash,
  ArrowUUpLeft,
  Sword,
  Repeat,
} from "@phosphor-icons/react";
import type { AttributeKey, CompleteTaskResult, DifficultyTier, Recurrence, Task } from "@/lib/game/types";
import { ATTRIBUTE_META, RECURRENCE_META, TIER_META } from "@/lib/game/types";
import { Chip, Window, WindowTitle } from "@/components/ui";
import { playVictoryFanfare, playErrorBuzz, playAchievementFanfare } from "@/lib/audio/fanfare";
import { useGameStore } from "@/lib/game/store";
import { createClient } from "@/lib/supabase/client";

const TIERS = Object.keys(TIER_META) as DifficultyTier[];
const ATTRS = Object.keys(ATTRIBUTE_META) as AttributeKey[];

const questSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Every quest needs a name.")
    .max(120, "Keep it under 120 characters."),
  tier: z.enum(["trivial", "easy", "medium", "hard", "epic"]),
  attribute: z.enum(["str", "int", "vit", "dis", "cha", "cra"]),
  recurrence: z.enum(["none", "daily", "weekly"]),
});
type QuestForm = z.infer<typeof questSchema>;

const CADENCES = Object.keys(RECURRENCE_META) as Recurrence[];

/** Period-aware "done" for the client (mirrors quest_done_for_period). */
function isDoneNow(task: Task): boolean {
  if (task.recurrence === "none") return task.completed;
  if (!task.completed || !task.completed_at) return false;
  const completedDay = new Date(task.completed_at).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (task.recurrence === "daily") return completedDay === today;
  // weekly: ISO week comparison via the Thursday trick
  const weekOf = (d: Date) => {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = t.getUTCDay() || 7; // Mon=1..Sun=7
    t.setUTCDate(t.getUTCDate() + 4 - day); // Thursday of the ISO week
    return t.toISOString().slice(0, 10);
  };
  return weekOf(new Date(completedDay)) === weekOf(new Date(today));
}

/** Quest row. */
function QuestRow({
  task,
  onCompleted,
  editing,
  onStartEdit,
  onEndEdit,
}: {
  task: Task;
  onCompleted: (task: Task, origin: { x: number; y: number }) => void;
  editing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
}) {
  const supabase = createClient();
  const pushToast = useGameStore((s) => s.pushToast);
  const setTasks = useGameStore((s) => s.setTasks);
  const applyCompletion = useGameStore((s) => s.applyCompletion);
  const tasks = useGameStore((s) => s.tasks);
  const [busy, setBusy] = useState(false);
  const reduce = useReducedMotion();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuestForm>({
    resolver: zodResolver(questSchema),
    defaultValues: {
      title: task.title,
      tier: task.tier,
      attribute: task.attribute,
      recurrence: task.recurrence ?? "none",
    },
  });

  async function complete(event: React.MouseEvent<HTMLButtonElement>) {
    if (busy) return;
    setBusy(true);
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

    try {
      const { data, error } = await supabase.rpc("complete_task", { task_id: task.id });
      if (error) throw error;
      if (data) {
        const res = data as CompleteTaskResult;
        applyCompletion(res);
        if (res.reopened_no_reward) {
          pushToast(
            "info",
            "Deed re-entered — this quest's rewards were already earned."
          );
        }
        for (const a of res.achievements ?? []) {
          playAchievementFanfare();
          pushToast(
            "success",
            `Achievement unlocked: ${a.name}${a.gold_reward ? ` (+${a.gold_reward}g)` : ""}`
          );
        }
      }
      onCompleted(task, origin);
    } catch (err) {
      playErrorBuzz();
      pushToast("danger", err instanceof Error ? err.message : "The guild ledger rejected that.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;
      setTasks(tasks.filter((t) => t.id !== task.id));
      pushToast("info", "Quest struck from the board.");
    } catch (err) {
      pushToast("danger", err instanceof Error ? err.message : "Could not remove quest.");
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("reopen_task", { task_id: task.id });
      if (error) throw error;
      setTasks(
        tasks.map((t) =>
          t.id === task.id ? { ...t, completed: false, completed_at: null } : t
        )
      );
      pushToast(
        "info",
        task.recurrence === "none" && task.rewards_paid
          ? "One-shot quests already in the ledger cannot be reopened."
          : "Quest reopened. Rewards already earned stay earned."
      );
    } catch (err) {
      pushToast("danger", err instanceof Error ? err.message : "Could not reopen quest.");
    } finally {
      setBusy(false);
    }
  }

  const saveEdit = handleSubmit(async (values) => {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          title: values.title,
          tier: values.tier,
          attribute: values.attribute,
          recurrence: values.recurrence,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      if (error) throw error;
      setTasks(
        tasks.map((t) =>
          t.id === task.id
            ? { ...t, ...values, updated_at: new Date().toISOString() }
            : t
        )
      );
      onEndEdit();
      reset(values);
    } catch (err) {
      pushToast("danger", err instanceof Error ? err.message : "Could not update quest.");
    } finally {
      setBusy(false);
    }
  });

  const tierMeta = TIER_META[task.tier];
  const attrMeta = ATTRIBUTE_META[task.attribute];
  const done = isDoneNow(task);

  if (editing) {
    return (
      <li className="px-4 py-4 sm:px-5">
        <form onSubmit={saveEdit} className="flex flex-col gap-3" aria-label={`Edit quest ${task.title}`}>
          <div>
            <label htmlFor={`edit-title-${task.id}`} className="sr-only">
              Quest name
            </label>
            <input
              id={`edit-title-${task.id}`}
              className="input-jrpg"
              autoComplete="off"
              maxLength={120}
              {...register("title")}
            />
            {errors.title && (
              <p role="alert" className="mt-1.5 text-xs text-danger">
                {errors.title.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor={`edit-tier-${task.id}`} className="mb-1 block text-xs font-semibold text-ink-dim">
                Difficulty
              </label>
              <select id={`edit-tier-${task.id}`} className="input-jrpg" {...register("tier")}>
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {TIER_META[t].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`edit-attr-${task.id}`} className="mb-1 block text-xs font-semibold text-ink-dim">
                Attribute
              </label>
              <select id={`edit-attr-${task.id}`} className="input-jrpg" {...register("attribute")}>
                {ATTRS.map((a) => (
                  <option key={a} value={a}>
                    {ATTRIBUTE_META[a].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`edit-rec-${task.id}`} className="mb-1 block text-xs font-semibold text-ink-dim">
                Cadence
              </label>
              <select id={`edit-rec-${task.id}`} className="input-jrpg" {...register("recurrence")}>
                {CADENCES.map((r) => (
                  <option key={r} value={r}>
                    {RECURRENCE_META[r].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-jrpg btn-primary px-4 py-2 text-[10px]">
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                onEndEdit();
              }}
              className="btn-jrpg btn-ghost px-4 py-2 text-[10px]"
            >
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <motion.li
      layout
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: done ? 0.55 : 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className={`group flex items-center gap-3 px-4 py-3 sm:px-5 ${
        done ? "opacity-60" : ""
      }`}
    >
      {/* complete / reopen button */}
      {done ? (
        task.recurrence === "none" && task.rewards_paid ? (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border-2 border-window-border bg-window-deep/40 text-rarity-uncommon"
            title="Sealed in the ledger — rewards already earned"
            aria-label="Quest sealed in the ledger"
          >
            <Sword size={15} weight="fill" aria-hidden="true" />
          </span>
        ) : (
          <button
            onClick={reopen}
            disabled={busy}
            className="btn-jrpg btn-ghost !rounded-[6px] h-9 w-9 shrink-0 !border-window-border p-0"
            aria-label={`Reopen quest: ${task.title}`}
            title="Reopen (rewards stay earned)"
          >
            <ArrowUUpLeft size={15} weight="bold" aria-hidden="true" />
          </button>
        )
      ) : (
        <motion.button
          whileTap={reduce ? undefined : { scale: 0.85 }}
          onClick={complete}
          disabled={busy}
          className="btn-jrpg btn-ghost h-9 w-9 shrink-0 !rounded-[6px] !border-window-border p-0"
          aria-label={`Complete quest: ${task.title}. Awards ${tierMeta.xp} XP and ${tierMeta.gold} gold.`}
        >
          <Sword size={15} weight="duotone" className="text-gold" aria-hidden="true" />
        </motion.button>
      )}

      {/* main */}
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-semibold ${
            done ? "text-ink-faint line-through" : "text-ink"
          }`}
        >
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Chip colorClass="text-gold">
            {tierMeta.label} · {tierMeta.xp}xp
          </Chip>
          <Chip colorClass={`text-[${attrMeta.colorVar}]`}>
            {attrMeta.label}
          </Chip>
          {task.recurrence && task.recurrence !== "none" && (
            <Chip
              colorClass={
                task.recurrence === "daily" ? "text-rarity-rare" : "text-rarity-uncommon"
              }
            >
              <Repeat size={10} weight="bold" aria-hidden="true" />
              {RECURRENCE_META[task.recurrence].label}
              {(task.task_streak ?? 0) > 1 && (
                <span className="text-ink-faint">· {task.task_streak}x</span>
              )}
            </Chip>
          )}
        </div>
      </div>

      {/* actions */}
      <div className="flex shrink-0 items-center gap-1.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        {!done && (
          <button
            onClick={onStartEdit}
            disabled={busy}
            className="rounded-[6px] p-2 text-ink-faint transition-colors hover:bg-window-raised hover:text-ink"
            aria-label={`Edit quest: ${task.title}`}
          >
            <PencilSimple size={15} weight="bold" aria-hidden="true" />
          </button>
        )}
        <button
          onClick={remove}
          disabled={busy}
          className="rounded-[6px] p-2 text-ink-faint transition-colors hover:bg-window-raised hover:text-danger"
          aria-label={`Delete quest: ${task.title}`}
        >
          <Trash size={15} weight="bold" aria-hidden="true" />
        </button>
      </div>
    </motion.li>
  );
}

/** The quest board window: list + inline add form. */
export function QuestBoard({ onCompleted }: { onCompleted: (task: Task, origin: { x: number; y: number }) => void }) {
  const supabase = createClient();
  const tasks = useGameStore((s) => s.tasks);
  const tasksLoading = useGameStore((s) => s.tasksLoading);
  const setTasks = useGameStore((s) => s.setTasks);
  const pushToast = useGameStore((s) => s.pushToast);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reduce = useReducedMotion();
  const listRef = useRef<HTMLUListElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<QuestForm>({
    resolver: zodResolver(questSchema),
    defaultValues: { tier: "medium", attribute: "dis", recurrence: "none" },
  });

  const open = tasks.filter((t) => !isDoneNow(t));
  const done = tasks.filter((t) => isDoneNow(t));

  const addQuest = handleSubmit(async (values) => {
    if (busy) return;
    setBusy(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .single();
      if (!profile) throw new Error("Character sheet not found.");

      const { data: created, error } = await supabase
        .from("tasks")
        .insert({
          profile_id: profile.id,
          title: values.title,
          tier: values.tier,
          attribute: values.attribute,
          recurrence: values.recurrence,
        })
        .select()
        .single();
      if (error) throw error;

      setTasks([created, ...tasks]);
      reset({ title: "", tier: values.tier, attribute: values.attribute, recurrence: values.recurrence });
      setShowForm(false);
      pushToast("success", "Quest posted to the board.");
    } catch (err) {
      pushToast("danger", err instanceof Error ? err.message : "Could not post quest.");
    } finally {
      setBusy(false);
    }
  });

  return (
    <Window as="section" className="flex min-h-[420px] flex-col overflow-hidden">
      <WindowTitle
        right={
          <button
            onClick={() => {
              setShowForm((v) => !v);
              if (!showForm) setTimeout(() => setFocus("title"), 50);
            }}
            className="btn-jrpg btn-primary px-3 py-1.5 text-[10px]"
            aria-expanded={showForm}
            aria-controls="new-quest-form"
          >
            {showForm ? (
              <>
                <X size={12} weight="bold" aria-hidden="true" /> Close
              </>
            ) : (
              <>
                <Plus size={12} weight="bold" aria-hidden="true" /> New Quest
              </>
            )}
          </button>
        }
      >
        Quest Board
      </WindowTitle>

      {/* add form */}
      <AnimatePresence initial={false}>
        {showForm && (
          <motion.form
            id="new-quest-form"
            key="form"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onSubmit={addQuest}
            className="overflow-hidden border-b-2 border-window-border/50 bg-window-deep/40"
            aria-label="Post a new quest"
          >
            <div className="flex flex-col gap-3 p-4 sm:px-5">
              <div>
                <label htmlFor="quest-title" className="mb-1 block text-xs font-semibold text-ink-dim">
                  Quest name
                </label>
                <input
                  id="quest-title"
                  className="input-jrpg"
                  placeholder="Slay the laundry dragon…"
                  autoComplete="off"
                  maxLength={120}
                  {...register("title")}
                />
                {errors.title && (
                  <p role="alert" className="mt-1.5 text-xs text-danger">
                    {errors.title.message}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="quest-tier" className="mb-1 block text-xs font-semibold text-ink-dim">
                    Difficulty (sets reward)
                  </label>
                  <select id="quest-tier" className="input-jrpg" {...register("tier")}>
                    {TIERS.map((t) => (
                      <option key={t} value={t}>
                        {TIER_META[t].label} — {TIER_META[t].xp}xp / {TIER_META[t].gold}g
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="quest-attr" className="mb-1 block text-xs font-semibold text-ink-dim">
                    Trains attribute
                  </label>
                  <select id="quest-attr" className="input-jrpg" {...register("attribute")}>
                    {ATTRS.map((a) => (
                      <option key={a} value={a}>
                        {ATTRIBUTE_META[a].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="quest-rec" className="mb-1 block text-xs font-semibold text-ink-dim">
                    Cadence
                  </label>
                  <select id="quest-rec" className="input-jrpg" {...register("recurrence")}>
                    {CADENCES.map((r) => (
                      <option key={r} value={r}>
                        {RECURRENCE_META[r].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={busy} className="btn-jrpg btn-primary px-5 py-2 text-[10px]">
                  Post Quest
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* list */}
      {tasksLoading ? (
        <ul className="flex-1 divide-y divide-window-border/30" aria-label="Loading quests">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-4 sm:px-5">
              <div className="h-9 w-9 animate-pulse rounded-[6px] bg-window-raised/50" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-window-raised/50" />
                <div className="h-3 w-1/4 animate-pulse rounded bg-window-raised/50" />
              </div>
            </li>
          ))}
        </ul>
      ) : tasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
          <Sword size={40} weight="duotone" className="text-ink-faint" aria-hidden="true" />
          <p className="pixel-text text-[11px] leading-relaxed text-ink-dim">
            The board is empty
          </p>
          <p className="max-w-[36ch] text-sm text-ink-faint font-body">
            Post your first quest — a chore, a workout, a chapter to read — and
            begin your legend.
          </p>
        </div>
      ) : (
        <ul ref={listRef} className="flex-1 divide-y divide-window-border/30" aria-label="Quests">
          <AnimatePresence initial={false}>
            {open.map((task) => (
              <QuestRow
                key={task.id}
                task={task}
                onCompleted={(t, origin) => {
                  setTasks(
                    tasks.map((x) =>
                      x.id === t.id
                        ? {
                            ...x,
                            completed: true,
                            completed_at: new Date().toISOString(),
                          }
                        : x
                    )
                  );
                  playVictoryFanfare();
                  onCompleted(t, origin);
                }}
                editing={editingId === task.id}
                onStartEdit={() => setEditingId(task.id)}
                onEndEdit={() => setEditingId(null)}
              />
            ))}
          </AnimatePresence>

          {done.length > 0 && open.length > 0 && (
            <li aria-hidden="true" className="px-4 pt-3 pb-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-faint">
                Cleared this period
              </p>
            </li>
          )}

          <AnimatePresence initial={false}>
            {done.map((task) => (
              <QuestRow
                key={task.id}
                task={task}
                onCompleted={() => {}}
                editing={false}
                onStartEdit={() => {}}
                onEndEdit={() => {}}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Window>
  );
}
