-- Marks hosted games whose date/time has passed as 'completed' so the stored
-- status matches what players see (the app already hides ended games from the
-- landing page and files them under Game History on its own, based on the clock).
-- Idempotent. Anyone may call it; it only ever flips finished 'active' games.

create or replace function public.complete_past_hosted_games()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  with parsed as (
    select id, date,
           trim(split_part("time", '–', 1)) as s,
           trim(split_part("time", '–', 2)) as e
    from public.hosted_games
    where status = 'active' and date <= (now() at time zone 'Asia/Kolkata')::date
  ), ended as (
    select id from parsed
    where s ~* '^\d{1,2}:\d{2}\s*(AM|PM)$' and e ~* '^\d{1,2}:\d{2}\s*(AM|PM)$'
      and ((date + e::time + case when e::time <= s::time then interval '1 day' else interval '0' end)
            at time zone 'Asia/Kolkata') <= now()
  )
  update public.hosted_games g set status = 'completed'
  from ended where g.id = ended.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.complete_past_hosted_games() to anon, authenticated;
