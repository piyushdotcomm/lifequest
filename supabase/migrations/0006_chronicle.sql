-- ============================================================================
-- LIFE QUEST v6 — THE CHRONICLE
--
-- The activity_log has been faithfully recording every deed since day one;
-- nothing ever read it. This RPC turns that ledger into a hero's chronicle:
--   heatmap    — quest activity per day for the trailing 26 weeks (Mon-start)
--   weekly     — XP earned per attribute per ISO week (trailing 8 weeks)
--   totals     — lifetime quests, XP, gold, crits, best streak, active days
--   events     — the most recent ledger entries (mixed event types)
-- ============================================================================

create or replace function public.get_chronicle()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    -- ——— 26-week activity heatmap (day buckets, quest completions) ———
    'heatmap', (
      with days as (
        select generate_series(
          (date_trunc('week', (now() at time zone 'utc')::date - interval '25 weeks'))::date,
          (now() at time zone 'utc')::date,
          interval '1 day'
        )::date as day
      ),
      counts as (
        select (l.created_at at time zone 'utc')::date as day,
               count(*)::int as quests,
               coalesce(sum((l.detail ->> 'xp')::int), 0)::int as xp
        from public.activity_log l
        where l.profile_id = auth.uid()
          and l.event = 'task_completed'
          and (l.detail ->> 'reopened_no_reward')::boolean is not true
        group by 1
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', to_char(d.day, 'YYYY-MM-DD'),
        'quests', coalesce(c.quests, 0),
        'xp', coalesce(c.xp, 0)
      ) order by d.day), '[]'::jsonb)
      from days d
      left join counts c on c.day = d.day
    ),

    -- ——— weekly XP per attribute (trailing 8 ISO weeks) ———
    'weekly', (
      with weeks as (
        select generate_series(
          date_trunc('week', (now() at time zone 'utc')::date - interval '7 weeks'),
          date_trunc('week', (now() at time zone 'utc')::date),
          interval '1 week'
        )::date as week
      ),
      earned as (
        select date_trunc('week', (l.created_at at time zone 'utc'))::date as week,
               l.detail ->> 'attribute' as attribute,
               coalesce(sum((l.detail ->> 'xp')::int), 0)::int as xp,
               count(*)::int as quests
        from public.activity_log l
        where l.profile_id = auth.uid()
          and l.event = 'task_completed'
          and (l.detail ->> 'reopened_no_reward')::boolean is not true
        group by 1, 2
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'week', to_char(w.week, 'YYYY-MM-DD'),
        'xp', (
          select coalesce(jsonb_object_agg(e.attribute, e.xp), '{}'::jsonb)
          from earned e where e.week = w.week
        ),
        'quests', (
          select coalesce(sum(e.quests), 0)::int
          from earned e where e.week = w.week
        )
      ) order by w.week), '[]'::jsonb)
      from weeks w
    ),

    -- ——— lifetime totals ———
    'totals', (
      select jsonb_build_object(
        'quests', count(*)::int,
        'xp', coalesce(sum((l.detail ->> 'xp')::int), 0)::int,
        'gold', coalesce(sum((l.detail ->> 'gold')::int), 0)::int,
        'crits', coalesce(sum(case when (l.detail ->> 'crit')::boolean then 1 else 0 end), 0)::int,
        'active_days', count(distinct (l.created_at at time zone 'utc')::date)::int
      )
      from public.activity_log l
      where l.profile_id = auth.uid()
        and l.event = 'task_completed'
        and (l.detail ->> 'reopened_no_reward')::boolean is not true
    ),

    -- ——— recent ledger entries (all event types) ———
    'events', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'event', l.event,
        'detail', l.detail,
        'created_at', l.created_at
      ) order by l.created_at desc), '[]'::jsonb)
      from (
        select * from public.activity_log
        where profile_id = auth.uid()
        order by created_at desc
        limit 60
      ) l
    ),

    -- ——— profile snapshot (best streak lives there) ———
    'profile', (
      select to_jsonb(p) from public.profiles p where p.id = auth.uid()
    )
  );
$$;
