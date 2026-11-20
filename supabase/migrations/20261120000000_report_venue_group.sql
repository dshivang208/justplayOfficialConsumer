-- Let players report messages in venue community groups too (e.g. the "Dugout" group).
alter table public.content_reports drop constraint if exists content_reports_kind_check;
alter table public.content_reports add constraint content_reports_kind_check
  check (kind in ('group_message','game_question','venue_group_message'));

create or replace function public.report_content(
  p_kind text, p_content_id uuid, p_reason text, p_details text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_author uuid; v_text text; v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_kind = 'group_message' then
    select sender_user_id, message_text into v_author, v_text from public.group_messages where id = p_content_id;
  elsif p_kind = 'game_question' then
    select sender_id, message into v_author, v_text from public.game_questions where id = p_content_id;
  elsif p_kind = 'venue_group_message' then
    select sender_user_id, coalesce(nullif(btrim(body), ''), '[attachment]') into v_author, v_text
      from public.venue_group_messages where id = p_content_id;
  else
    raise exception 'INVALID_KIND';
  end if;
  if v_text is null then raise exception 'NOT_FOUND'; end if;
  if v_author = v_me then raise exception 'OWN_CONTENT'; end if;
  insert into public.content_reports (reporter_id, kind, content_id, author_id, content_text, reason, details)
  values (v_me, p_kind, p_content_id, v_author, left(v_text, 1000), p_reason, nullif(btrim(coalesce(p_details,'')), ''))
  on conflict (reporter_id, kind, content_id) do nothing;
end $$;
grant execute on function public.report_content(text, uuid, text, text) to authenticated;

create or replace function public.admin_resolve_report(p_id uuid, p_action text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.content_reports;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if p_action not in ('dismiss','delete','delete_suspend') then raise exception 'INVALID_ACTION'; end if;
  select * into r from public.content_reports where id = p_id;
  if r.id is null then raise exception 'NOT_FOUND'; end if;

  if p_action in ('delete','delete_suspend') then
    if r.kind = 'group_message' then delete from public.group_messages where id = r.content_id;
    elsif r.kind = 'venue_group_message' then delete from public.venue_group_messages where id = r.content_id;
    else delete from public.game_questions where id = r.content_id; end if;
  end if;
  if p_action = 'delete_suspend' and r.author_id is not null then
    update public.users set status = 'suspended',
           suspension_reason = coalesce(nullif(btrim(coalesce(p_note,'')), ''), 'Violated community guidelines')
     where id = r.author_id;
  end if;

  update public.content_reports
     set status = case when p_action = 'dismiss' then 'dismissed' else 'actioned' end,
         admin_note = nullif(btrim(coalesce(p_note,'')), ''), handled_by = auth.uid(), resolved_at = now()
   where kind = r.kind and content_id = r.content_id and status = 'open';

  insert into public.admin_audit_log (admin_id, action, target_table, target_id, details)
  values (auth.uid(), 'report.' || p_action, 'content_reports', p_id::text,
          jsonb_build_object('kind', r.kind, 'content_id', r.content_id, 'author_id', r.author_id, 'note', p_note));
end $$;
grant execute on function public.admin_resolve_report(uuid, text, text) to authenticated;
