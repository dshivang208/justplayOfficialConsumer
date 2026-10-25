-- Friendlier push titles for consumer notifications (the body stays the message).
-- Safe to re-run.
create or replace function public.trg_push_user_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  if to_jsonb(new)->>'notification_log_id' is null then
    v_title := case
      when new.message ilike 'Booking confirmed%'            then 'Booking confirmed ✅'
      when new.message ilike '%was cancelled by the venue%'  then 'Booking cancelled'
      when new.message ilike '%point%'                       then 'Rewards update 🎁'
      when new.message ilike '%refund%'                      then 'Refund update'
      else 'JustPlay'
    end;
    perform public._push_enqueue(array[new.user_id], 'consumer', v_title, new.message, '/notifications');
  end if;
  return new;
exception when others then
  return new;
end;
$$;
