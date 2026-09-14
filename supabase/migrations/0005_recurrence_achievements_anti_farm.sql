-- ============================================================================
-- LIFE QUEST v5 — RECURRENCE, ANTI-FARM FIX, EQUIPMENT WIRING, ACHIEVEMENTS
--
-- 1. ANTI-FARM: quests can never pay rewards twice. A `rewards_paid` flag is
--    set on first completion; reopening a quest keeps it set, so a
--    complete → reopen → complete loop earns nothing the second time.
-- 2. RECURRENCE: quests become one-shot, daily, or weekly. Completion state
--    is period-aware: a daily completed this UTC day shows as done and
--    reopens itself after midnight; each repeat builds a per-quest streak
--    that multiplies rewards up to 1.5x.
-- 3. ACHIEVEMENTS: a definition table + per-user unlocks, checked inside
--    the completion transaction (first quest, streaks, crits, balanced
--    attributes, lifetime quests, zone discovery). Each unlock grants
--    a badge item + gold, atomically.
-- ============================================================================

-- ============ 0. NEW ENUMS / COLUMNS ============

create type public.recurrence as enum ('none', 'daily', 'weekly');

alter table public.tasks
  add column if not exists recurrence public.recurrence not null default 'none',
  add column if not exists rewards_paid boolean not null default false,
  add column if not exists task_streak int not null default 0,
  add column if not exists best_streak int not null default 0,
  add column if not exists last_paid_period date;

-- Existing one-shot quests that were completed keep their legacy shape.
update public.tasks
  set rewards_paid = true
  where completed and not rewards_paid;

-- ============ 1. ACHIEVEMENT DEFINITIONS + UNLOCKS ============

create table if not exists public.achievement_definitions (
  id int primary key,
  slug text not null unique,
  name text not null,
  description text not null,
  rarity public.rarity not null default 'common',
  badge_slug text not null,          -- item_catalog badge granted on unlock
  gold_reward int not null default 0 check (gold_reward >= 0)
);

alter table public.achievement_definitions enable row level security;
create policy "achievements: read all"
  on public.achievement_definitions for select
  using (auth.role() = 'authenticated');

create table if not exists public.user_achievements (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id int not null references public.achievement_definitions (id) on delete restrict,
  unlocked_at timestamptz not null default now(),
  unique (profile_id, achievement_id)
);

alter table public.user_achievements enable row level security;
create policy "user_achievements: read own"
  on public.user_achievements for select
  using (auth.uid() = profile_id);

-- ============================================================================
-- check_achievements(v_profile, v_task, v_today)
--   Called inside complete_task AFTER the streak/gear/log updates.
--   Idempotent: skips anything already unlocked. Grants the badge item and
--   gold atomically; returns jsonb array of new unlocks for the client FX.
-- ============================================================================
create or replace function public.check_achievements(
  v_profile public.profiles,
  v_today date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unlocked jsonb := '[]'::jsonb;
  v_lifetime int;
  v_max_attr int;
  v_min_attr int;
  v_def record;
  v_item public.item_catalog;
  v_should boolean;
begin
  select count(*) into v_lifetime
    from public.tasks t
    where t.profile_id = v_profile.id and t.rewards_paid;

  select max(level), min(level) into v_max_attr, v_min_attr
    from public.attributes a where a.profile_id = v_profile.id;

  for v_def in
    select * from public.achievement_definitions ad
    where not exists (
      select 1 from public.user_achievements ua
      where ua.profile_id = v_profile.id
        and ua.achievement_id = ad.id
    )
  loop
    v_should := case v_def.slug
      when 'first-blood'        then v_lifetime >= 1
      when 'ten-quests'         then v_lifetime >= 10
      when 'fifty-quests'       then v_lifetime >= 50
      when 'hundred-quests'     then v_lifetime >= 100
      when 'streak-3'           then v_profile.streak_best >= 3
      when 'streak-7'           then v_profile.streak_best >= 7
      when 'streak-30'          then v_profile.streak_best >= 30
      when 'first-crit'         then v_profile.crit_count >= 1
      when 'crit-10'            then v_profile.crit_count >= 10
      when 'level-5'            then v_profile.level >= 5
      when 'level-10'           then v_profile.level >= 10
      when 'level-18'           then v_profile.level >= 18
      when 'well-rounded'       then v_min_attr >= 3
      when 'grandmaster'        then v_max_attr >= 10
      when 'daily-devotee'      then exists (
                                     select 1 from public.tasks t
                                     where t.profile_id = v_profile.id
                                       and t.best_streak >= 7
                                   )
      else false
    end;

    if v_should then
      insert into public.user_achievements (profile_id, achievement_id)
        values (v_profile.id, v_def.id)
        on conflict do nothing;

      if found then
        -- grant the badge item
        select * into v_item from public.item_catalog
          where slug = v_def.badge_slug and kind = 'badge';
        if v_item.id is not null then
          insert into public.user_items (profile_id, item_id, quantity)
            values (v_profile.id, v_item.id, 1)
            on conflict (profile_id, item_id) do nothing;
        end if;

        -- pay the gold
        if v_def.gold_reward > 0 then
          update public.profiles
            set gold = gold + v_def.gold_reward
            where id = v_profile.id;
        end if;

        insert into public.activity_log (profile_id, event, detail)
          values (v_profile.id, 'achievement_unlocked', jsonb_build_object(
            'achievement', v_def.name,
            'slug', v_def.slug,
            'rarity', v_def.rarity,
            'gold', v_def.gold_reward
          ));

        v_unlocked := v_unlocked || jsonb_build_object(
          'slug', v_def.slug,
          'name', v_def.name,
          'description', v_def.description,
          'rarity', v_def.rarity,
          'gold_reward', v_def.gold_reward
        );
      end if;
    end if;
  end loop;

  return v_unlocked;
end;
$$;

-- ============================================================================
-- quest_is_done(task) — period-aware completion predicate.
--   none:    completed flag as stored.
--   daily:   done iff completed and completed_at::utc date = today.
--   weekly:  done iff completed and completed_at is in the current ISO week.
-- ============================================================================
create or replace function public.quest_done_for_period(
  v_task public.tasks,
  v_today date
)
returns boolean
language sql
stable
as $$
  select case v_task.recurrence
    when 'none' then v_task.completed
    when 'daily' then
      v_task.completed
      and (v_task.completed_at at time zone 'utc')::date = v_today
    when 'weekly' then
      v_task.completed
      and date_trunc('week', (v_task.completed_at at time zone 'utc'))::date
          = date_trunc('week', v_today)::date
    else v_task.completed
  end;
$$;

-- ============================================================================
-- COMPLETE_TASK v3 — anti-farm + recurrence + per-quest streak multiplier.
-- ============================================================================
create or replace function public.complete_task(task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
  v_profile public.profiles;
  v_attr public.attributes;
  v_xp int;
  v_gold int;
  v_levels_gained int := 0;
  v_attr_levels int := 0;
  v_leveled_up boolean := false;
  v_streak_increased boolean := false;
  v_streak_frozen boolean := false;
  v_today date := (now() at time zone 'utc')::date;
  v_crit boolean := false;
  v_crit_multiplier numeric := 1;
  v_roll int;
  v_gear_granted text;
  v_old_gear int;
  v_new_gear int;
  v_reopened boolean := false;       -- quest already paid before: cosmetic complete
  v_quest_multiplier numeric := 1;  -- per-quest streak bonus
  v_period_start date;              -- day (daily) or week start (weekly)
  v_prev_period date;
  v_achievements jsonb := '[]'::jsonb;
  v_task_streak int := 0;
begin
  -- 1. Lock and validate.
  select * into v_task from public.tasks
    where id = task_id and profile_id = auth.uid()
    for update;
  if not found then
    raise exception 'Quest not found or not yours.';
  end if;

  if public.quest_done_for_period(v_task, v_today) then
    raise exception 'Quest already completed for this period, hero.';
  end if;

  select * into v_profile from public.profiles where id = auth.uid() for update;

  -- period boundaries for recurrence
  v_period_start := case v_task.recurrence
    when 'weekly' then date_trunc('week', v_today)::date
    else v_today
  end;

  -- 2. Complete + payout.
  update public.tasks
    set completed = true, completed_at = now(), updated_at = now()
    where id = task_id
    returning * into v_task;

  select xp, gold into v_xp, v_gold from public.tier_rewards(v_task.tier);

  if v_task.rewards_paid then
    ---------------------------------------------------------------
    -- ANTI-FARM: this quest was completed (and paid) once before and
    -- then reopened. The completion is honored cosmetically, but the
    -- guild pays nothing the second time. No XP, no gold, no streak.
    ---------------------------------------------------------------
    v_reopened := true;
    v_xp := 0;
    v_gold := 0;
  else
    -- per-quest streak multiplier (dailies/weeklies only)
    if v_task.recurrence <> 'none' then
      if v_task.last_paid_period is null then
        v_quest_multiplier := 1;
        update public.tasks set task_streak = 1 where id = task_id;
      else
        v_prev_period := case v_task.recurrence
          when 'weekly' then (date_trunc('week', v_period_start) - interval '7 days')::date
          else v_period_start - 1
        end;
        if v_task.last_paid_period = v_prev_period then
          update public.tasks
            set task_streak = task_streak + 1
            where id = task_id;
        else
          update public.tasks
            set task_streak = 1
            where id = task_id;
        end if;
      end if;
      update public.tasks
        set best_streak = greatest(best_streak, task_streak), last_paid_period = v_period_start
        where id = task_id;
      select task_streak into v_task_streak from public.tasks where id = task_id;
      v_task.task_streak := v_task_streak;
      -- +7% per consecutive period, capped at +50% (day 7 and beyond)
      v_quest_multiplier := least(1 + 0.07 * v_task_streak, 1.5);
    end if;

    v_xp := round(v_xp * v_quest_multiplier)::int;
    v_gold := round(v_gold * v_quest_multiplier)::int;

    -- CRIT ROLL: d20, 20 = critical hit
    v_roll := floor(random() * 20)::int + 1;
    if v_roll = 20 then
      v_crit := true;
      v_crit_multiplier := 2;
      v_xp := v_xp * 2;
      v_gold := v_gold * 2;
    end if;

    update public.tasks
      set rewards_paid = true
      where id = task_id;

    update public.profiles
      set xp = xp + v_xp,
          gold = gold + v_gold,
          crit_count = crit_count + (case when v_crit then 1 else 0 end)
      where id = v_profile.id
      returning * into v_profile;
  end if;

  -- 3. Attribute XP + level rolls (paid completions only).
  if not v_reopened then
    select * into v_attr from public.attributes
      where profile_id = v_profile.id and attribute = v_task.attribute for update;

    v_attr.xp := v_attr.xp + v_xp;
    while v_attr.xp >= public.attr_xp_needed(v_attr.level) loop
      v_attr.xp := v_attr.xp - public.attr_xp_needed(v_attr.level);
      v_attr.level := v_attr.level + 1;
      v_attr_levels := v_attr_levels + 1;
    end loop;
    update public.attributes
      set xp = v_attr.xp, level = v_attr.level
      where id = v_attr.id;

    -- 4. Profile level rolls.
    while v_profile.xp >= public.xp_needed(v_profile.level) loop
      v_profile.xp := v_profile.xp - public.xp_needed(v_profile.level);
      v_profile.level := v_profile.level + 1;
      v_levels_gained := v_levels_gained + 1;
    end loop;
    if v_levels_gained > 0 then
      v_leveled_up := true;
      update public.profiles
        set level = v_profile.level, xp = v_profile.xp
        where id = v_profile.id;
    end if;

    -- 5. Streak (UTC days) — global activity streak.
    if v_profile.last_active_date is null or v_profile.streak_count = 0 then
      v_streak_increased := true;
      update public.profiles
        set streak_count = 1, streak_best = greatest(streak_best, 1), last_active_date = v_today
        where id = v_profile.id;
    elsif v_today = v_profile.last_active_date then
      null; -- already active today
    elsif v_today - v_profile.last_active_date = 1 then
      v_streak_increased := true;
      update public.profiles
        set streak_count = streak_count + 1,
            streak_best = greatest(streak_best, streak_count + 1),
            last_active_date = v_today
        where id = v_profile.id;
    else
      if exists (
        select 1 from public.user_items ui
        join public.item_catalog ic on ic.id = ui.item_id
        where ui.profile_id = v_profile.id and ic.slug = 'consumable-streak-freeze' and ui.quantity > 0
      ) then
        v_streak_frozen := true;
        update public.user_items
          set quantity = quantity - 1
          where profile_id = v_profile.id
            and item_id = (select id from public.item_catalog where slug = 'consumable-streak-freeze');
        update public.profiles set last_active_date = v_today where id = v_profile.id;
      else
        update public.profiles
          set streak_count = 1, last_active_date = v_today
          where id = v_profile.id;
      end if;
    end if;

    select * into v_profile from public.profiles where id = v_profile.id;
  end if;

  -- 6. GEAR GRANT: attribute level thresholds earn visible equipment.
  --    (paid completions only; v_attr is loaded there)
  if not v_reopened then
    select tier into v_new_gear from (values (3,1),(6,2),(10,3)) as t(threshold, tier)
      where v_attr.level >= threshold order by tier desc limit 1;
    if v_new_gear is null then v_new_gear := 0; end if;

    select tier into v_old_gear from public.user_gear
      where profile_id = v_profile.id and slot = v_task.attribute;
    if v_old_gear is null then v_old_gear := 0; end if;

    if v_new_gear > v_old_gear then
      update public.user_gear
        set tier = v_new_gear
        where profile_id = v_profile.id and slot = v_task.attribute;
      select g.name into v_gear_granted
        from public.gear_catalog g
        where g.slot = v_task.attribute and g.tier = v_new_gear;
    end if;
  end if;

  -- 7. ACHIEVEMENTS (paid completions only; also reached from chest claims
  --    via the separate lightweight wrapper below).
  if not v_reopened then
    v_achievements := public.check_achievements(v_profile, v_today);
  end if;

  -- 8. Log.
  insert into public.activity_log (profile_id, event, detail)
    values (v_profile.id, 'task_completed', jsonb_build_object(
      'task_id', task_id,
      'title', v_task.title,
      'tier', v_task.tier,
      'xp', v_xp,
      'gold', v_gold,
      'attribute', v_task.attribute,
      'leveled_up', v_leveled_up,
      'new_level', v_profile.level,
      'crit', v_crit,
      'crit_roll', v_roll,
      'gear_granted', v_gear_granted,
      'recurrence', v_task.recurrence,
      'quest_streak', v_task.task_streak,
      'quest_multiplier', round(v_quest_multiplier, 2),
      'reopened_no_reward', v_reopened
    ));

  select * into v_profile from public.profiles where id = v_profile.id;

  -- 9. Return refreshed sheet + FX descriptor.
  return jsonb_build_object(
    'xp_gained', v_xp,
    'gold_gained', v_gold,
    'attribute', v_task.attribute,
    'attribute_levels_gained', v_attr_levels,
    'leveled_up', v_leveled_up,
    'levels_gained', v_levels_gained,
    'new_level', v_profile.level,
    'streak_increased', v_streak_increased,
    'streak_frozen', v_streak_frozen,
    'crit', v_crit,
    'crit_roll', v_roll,
    'gear_granted', v_gear_granted,
    'reopened_no_reward', v_reopened,
    'quest_streak', v_task.task_streak,
    'quest_multiplier', round(v_quest_multiplier, 2),
    'achievements', v_achievements,
    'profile', to_jsonb(v_profile),
    'attributes', (
      select jsonb_agg(jsonb_build_object(
        'attribute', a.attribute, 'xp', a.xp, 'level', a.level,
        'xp_needed', public.attr_xp_needed(a.level)
      ) order by a.attribute)
      from public.attributes a where a.profile_id = v_profile.id
    ),
    'gear', (
      select coalesce(jsonb_object_agg(slot, tier), '{}'::jsonb)
      from public.user_gear where profile_id = v_profile.id
    )
  );
end;
$$;

-- ============================================================================
-- REOPEN_TASK v2 — still allowed (undo a mistaken completion), but a quest
-- whose rewards were already paid can never pay again (rewards_paid stays).
-- One-shot quests that were paid cannot be reopened at all (nothing to undo:
-- the completion was the reward event). Recurring quests reopen freely —
-- their reward is per-period anyway.
-- ============================================================================
create or replace function public.reopen_task(task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
begin
  select * into v_task from public.tasks
    where id = task_id and profile_id = auth.uid()
    for update;
  if not found then
    raise exception 'Quest not found, not yours, or already open.';
  end if;
  if not v_task.completed then
    raise exception 'Quest is already open.';
  end if;
  if v_task.recurrence = 'none' and v_task.rewards_paid then
    raise exception 'This deed was already entered in the ledger — its rewards cannot be re-earned.';
  end if;

  update public.tasks
    set completed = false, completed_at = null, updated_at = now()
    where id = task_id;
end;
$$;

-- ============================================================================
-- CHEST: achievements can also unlock from streak growth via the chest.
-- ============================================================================
create or replace function public.claim_chest()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_today date := (now() at time zone 'utc')::date;
  v_gold int;
  v_reward_slug text;
  v_reward_name text;
  v_rarity text;
  v_streak_bonus int;
  v_roll numeric := random();
  v_item record;
  v_achievements jsonb := '[]'::jsonb;
begin
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not found then
    raise exception 'Character sheet not found.';
  end if;

  if v_profile.chest_last_claimed = v_today then
    raise exception 'The chest is empty. Come back tomorrow, hero.';
  end if;

  v_streak_bonus := least(coalesce(v_profile.streak_count, 0) / 3, 20);
  v_gold := 15 + v_streak_bonus;

  update public.profiles
    set gold = gold + v_gold, chest_last_claimed = v_today
    where id = v_profile.id
    returning * into v_profile;

  if v_roll < 0.25 then
    select 'badge-stargazer' into v_reward_slug;
  elsif v_roll < 0.37 then
    select 'consumable-streak-freeze' into v_reward_slug;
  elsif v_roll < 0.43 then
    select 'frame-bronze' into v_reward_slug;
  elsif v_roll < 0.45 then
    select 'title-squire' into v_reward_slug;
  end if;

  if v_reward_slug is not null then
    select * into v_item from public.item_catalog
      where slug = v_reward_slug and purchasable;
    if found then
      v_reward_name := v_item.name;
      v_rarity := v_item.rarity::text;
      insert into public.user_items (profile_id, item_id, quantity)
        values (v_profile.id, v_item.id, 1)
        on conflict (profile_id, item_id)
        do update set quantity = public.user_items.quantity + 1;
    else
      v_reward_slug := null;
    end if;
  end if;

  -- achievements may unlock from the refreshed streak
  v_achievements := public.check_achievements(v_profile, v_today);
  select * into v_profile from public.profiles where id = v_profile.id;

  insert into public.activity_log (profile_id, event, detail)
    values (v_profile.id, 'chest_claimed', jsonb_build_object(
      'gold', v_gold, 'item', v_reward_name, 'rarity', v_rarity
    ));

  return jsonb_build_object(
    'gold_gained', v_gold,
    'item_slug', v_reward_slug,
    'item_name', v_reward_name,
    'item_rarity', v_rarity,
    'achievements', v_achievements,
    'profile', to_jsonb(v_profile)
  );
end;
$$;

-- ============================================================================
-- get_character_sheet v3 — full board state in one call, including the
-- period-aware done flag for recurring quests, achievements, and inventory.
-- ============================================================================
create or replace function public.get_character_sheet()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'profile', (
      select to_jsonb(p) from public.profiles p where p.id = auth.uid()
    ),
    'attributes', (
      select jsonb_agg(jsonb_build_object(
        'attribute', a.attribute, 'xp', a.xp, 'level', a.level,
        'xp_needed', public.attr_xp_needed(a.level)
      ) order by a.attribute)
      from public.attributes a where a.profile_id = auth.uid()
    ),
    'gear', (
      select coalesce(jsonb_object_agg(slot, tier), '{}'::jsonb)
      from public.user_gear where profile_id = auth.uid()
    ),
    'inventory', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', ui.item_id,
        'slug', ic.slug,
        'name', ic.name,
        'description', ic.description,
        'kind', ic.kind,
        'rarity', ic.rarity,
        'glyph', ic.glyph,
        'price', ic.price,
        'quantity', ui.quantity,
        'equipped', ui.equipped
      ) order by ic.rarity, ic.name), '[]'::jsonb)
      from public.user_items ui
      join public.item_catalog ic on ic.id = ui.item_id
      where ui.profile_id = auth.uid()
    ),
    'zones', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', z.id, 'name', z.name, 'lore', z.lore,
        'unlock_level', z.unlock_level, 'order_index', z.order_index
      ) order by z.order_index), '[]'::jsonb)
      from public.zones z
    ),
    'achievements', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'slug', ad.slug,
        'name', ad.name,
        'description', ad.description,
        'rarity', ad.rarity,
        'unlocked_at', ua.unlocked_at
      ) order by ua.unlocked_at desc), '[]'::jsonb)
      from public.user_achievements ua
      join public.achievement_definitions ad on ad.id = ua.achievement_id
      where ua.profile_id = auth.uid()
    )
  );
$$;
