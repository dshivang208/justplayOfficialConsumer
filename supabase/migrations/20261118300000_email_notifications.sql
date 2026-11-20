-- Transactional emails (via the send-email Edge Function + Resend):
--   booking confirmed, booking cancelled, refund approved.
-- Like push, this is a silent no-op until the email_config row below exists.
-- Players without an email on their profile are skipped by the function.

create table if not exists public.email_config (
  id           boolean primary key default true check (id),
  function_url text not null,
  secret       text not null
);
alter table public.email_config enable row level security;  -- no policies = no client access

create or replace function public._email_enqueue(
  p_user_ids uuid[], p_subject text, p_heading text, p_lines text[],
  p_cta_text text default null, p_cta_path text default null
) returns void language plpgsql security definer set search_path = public as $$
declare cfg public.email_config;
begin
  select * into cfg from public.email_config where id;
  if not found or p_user_ids is null or array_length(p_user_ids, 1) is null then return; end if;
  if not exists (select 1 from public.users where id = any (p_user_ids) and email is not null and email <> '') then
    return;
  end if;
  perform net.http_post(
    url     := cfg.function_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-email-secret', cfg.secret),
    body    := jsonb_build_object(
      'user_ids', to_jsonb(p_user_ids), 'subject', p_subject, 'heading', p_heading,
      'lines', to_jsonb(p_lines), 'cta_text', p_cta_text, 'cta_path', p_cta_path)
  );
exception when others then null;   -- never block a booking because email failed
end $$;
revoke all on function public._email_enqueue(uuid[], text, text, text[], text, text) from public, anon, authenticated;

-- ── Booking confirmed / cancelled ───────────────────────────────────────────
create or replace function public.trg_email_booking_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_venue text; v_when text;
begin
  if new.status not in ('confirmed', 'cancelled') then return new; end if;
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;

  select name into v_venue from public.venues where id = new.venue_id;
  v_when := to_char(new.date, 'FMDay, DD Mon YYYY') || ', ' || new.time;

  if new.status = 'confirmed' then
    perform public._email_enqueue(
      array[new.user_id],
      'Booking confirmed — ' || coalesce(v_venue, 'your venue'),
      'You''re all set! 🎉',
      array[
        'Your booking at ' || coalesce(v_venue, 'the venue') || ' is confirmed.',
        'Sport: ' || new.sport || E'\nWhen: ' || v_when || E'\nAmount paid: ₹' || new.price_paid::text,
        'Show up a few minutes early and have a great game.'
      ],
      'View my bookings', '/bookings'
    );
  else
    perform public._email_enqueue(
      array[new.user_id],
      'Booking cancelled — ' || coalesce(v_venue, 'your venue'),
      'Your booking was cancelled',
      array_remove(array[
        'Your booking at ' || coalesce(v_venue, 'the venue') || ' for ' || v_when || ' has been cancelled.',
        case when coalesce(new.cancellation_reason, '') <> '' then 'Reason: ' || new.cancellation_reason else null end,
        'If you paid, any eligible refund is processed as per our refund policy.'
      ], null),
      'Book another slot', '/venues'
    );
  end if;
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists trg_email_booking_status on public.bookings;
create trigger trg_email_booking_status
  after insert or update of status on public.bookings
  for each row execute function public.trg_email_booking_status();

-- ── Refund approved ─────────────────────────────────────────────────────────
create or replace function public.trg_email_refund_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_venue text;
begin
  if new.status <> 'approved' or old.status is not distinct from new.status then return new; end if;
  select b.user_id, v.name into v_user, v_venue
    from public.bookings b join public.venues v on v.id = b.venue_id where b.id = new.booking_id;
  if v_user is null then return new; end if;
  perform public._email_enqueue(
    array[v_user],
    'Refund approved — ₹' || new.amount::text,
    'Your refund is on its way',
    array[
      'We''ve approved a refund of ₹' || new.amount::text || ' for your booking at ' || coalesce(v_venue, 'the venue') || '.',
      'It usually reaches your original payment method within 5–7 working days.'
    ],
    'View my bookings', '/bookings'
  );
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists trg_email_refund_status on public.refund_requests;
create trigger trg_email_refund_status
  after update of status on public.refund_requests
  for each row execute function public.trg_email_refund_status();
