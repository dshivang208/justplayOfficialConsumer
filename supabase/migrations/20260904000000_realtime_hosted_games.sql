-- Enable Realtime broadcasts for hosted games.
--
-- Without this, join/leave/cancel only refreshes the browser that performed
-- the action — every other player looking at the same game (or the games
-- list) has to manually reload to see the new spot count, a new
-- participant, or a cancellation. Adding these tables to the
-- `supabase_realtime` publication lets every connected client subscribe to
-- row-level changes and update live, matching what src/lib/community.tsx's
-- "hosted-games-live" channel expects.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hosted_games'
  ) then
    alter publication supabase_realtime add table public.hosted_games;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_participants'
  ) then
    alter publication supabase_realtime add table public.game_participants;
  end if;
end $$;