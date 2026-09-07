-- ============================================================================
--  إضافة دور «مشرف عقار» — صلاحية كاملة داخل عقاراته المسندة فقط،
--  بلا إدارة مستخدمين ولا إعدادات ولا اطّلاع على بقية العقارات.
--
--  شغّل هذا الملف مرة واحدة في: SQL Editor → New query
-- ============================================================================

set search_path = public, extensions;

-- ------------------------------------------------------- 1) الدور الجديد --
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'manager', 'viewer', 'guard'));

-- --------------------------------------------------- 2) نطاق كل مستخدم --

/** العقارات المسندة للمستخدم الحالي — null تعني كل العقارات. */
create or replace function public.my_buildings() returns text[]
language sql stable security definer set search_path = public as $$
  select building_ids from public.profiles where id = auth.uid() and active
$$;

/** هل يرى المستخدم هذا العقار؟ */
create or replace function public.sees_building(b text) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.auth_role()
    when 'admin'   then true
    when 'viewer'  then true
    when 'guard'   then true
    when 'manager' then b = any(coalesce(public.my_buildings(), array[]::text[]))
    else false
  end
$$;

/** هل يعدّل المستخدم بيانات هذا العقار؟ */
create or replace function public.edits_building(b text) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.auth_role()
    when 'admin'   then true
    when 'manager' then b = any(coalesce(public.my_buildings(), array[]::text[]))
    else false
  end
$$;

/** المالية: محجوبة عن الحارس، ومحدودة بعقارات المشرف. */
create or replace function public.sees_finance(b text) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.auth_role()
    when 'admin'   then true
    when 'viewer'  then true
    when 'manager' then b = any(coalesce(public.my_buildings(), array[]::text[]))
    else false
  end
$$;

/** تعليم الشقق بملاحظة: المدير والمشرف والحارس. */
create or replace function public.flags_building(b text) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.auth_role()
    when 'admin'   then true
    when 'guard'   then true
    when 'manager' then b = any(coalesce(public.my_buildings(), array[]::text[]))
    else false
  end
$$;

-- ------------------------------------------- 3) السياسات مقيّدة بالعقار --

-- العقارات نفسها: يراها من له نطاقها، ولا يضيفها أو يحذفها إلا المدير
drop policy if exists buildings_read  on public.buildings;
drop policy if exists buildings_write on public.buildings;
create policy buildings_read   on public.buildings for select using (public.sees_building(id));
create policy buildings_insert on public.buildings for insert with check (public.is_admin());
create policy buildings_update on public.buildings for update using (public.edits_building(id)) with check (public.edits_building(id));
create policy buildings_delete on public.buildings for delete using (public.is_admin());

-- الأدوار والعقود والمستندات: القراءة والكتابة داخل النطاق
do $$
declare t text;
begin
  foreach t in array array['floors','contracts','docs'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select using (public.sees_building(building_id))', t, t);
    execute format('create policy %I_write on public.%I for all using (public.edits_building(building_id)) with check (public.edits_building(building_id))', t, t);
  end loop;
end $$;

-- الوحدات: الحارس يعدّل الملاحظات، والمشرف والمدير يعدّلان كل شيء
drop policy if exists units_read   on public.units;
drop policy if exists units_insert on public.units;
drop policy if exists units_update on public.units;
drop policy if exists units_delete on public.units;
create policy units_read   on public.units for select using (public.sees_building(building_id));
create policy units_insert on public.units for insert with check (public.edits_building(building_id));
create policy units_update on public.units for update using (public.flags_building(building_id)) with check (public.flags_building(building_id));
create policy units_delete on public.units for delete using (public.edits_building(building_id));

-- المالية داخل النطاق
do $$
declare t text;
begin
  foreach t in array array['payments','expenses'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select using (public.sees_finance(building_id))', t, t);
    execute format('create policy %I_write on public.%I for all using (public.edits_building(building_id)) with check (public.edits_building(building_id))', t, t);
  end loop;
end $$;

-- المستأجرون ليس لهم عقار مباشر (قد يسكن أحدهم عقارين)، فيقرأهم كل مستخدم
-- مفعّل ويكتبهم المدير والمشرف. البيانات الحسّاسة (المال) مقيّدة أعلاه.
drop policy if exists tenants_read  on public.tenants;
drop policy if exists tenants_write on public.tenants;
create policy tenants_read  on public.tenants for select using (public.can_read());
create policy tenants_write on public.tenants for all
  using (coalesce(public.auth_role() in ('admin','manager'), false))
  with check (coalesce(public.auth_role() in ('admin','manager'), false));

-- المراسلات: يكتبها المدير والمشرف والحارس
drop policy if exists memos_insert on public.memos;
create policy memos_insert on public.memos for insert
  with check (coalesce(public.auth_role() in ('admin','manager','guard'), false));

-- الإعدادات: يقرؤها الجميع ولا يعدّلها إلا المدير (بلا تغيير، للتوكيد)
drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for all
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------ 4) إنشاء الحسابات مع تحديد نطاق العقارات --

drop function if exists public.admin_create_user(text, text, text, text, text);

create or replace function public.admin_create_user(
  p_username text, p_password text, p_display text, p_role text,
  p_phone text, p_building_ids text[] default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  new_id uuid := gen_random_uuid();
  uname  text := lower(trim(p_username));
  mail   text := uname || '@' || public.auth_email_domain();
begin
  if not public.is_admin() then raise exception 'not-allowed'; end if;
  if uname !~ '^[a-z0-9_.-]{3,20}$' then raise exception 'اسم المستخدم غير صالح'; end if;
  if length(p_password) < 8 then raise exception 'كلمة المرور قصيرة'; end if;
  if p_role not in ('admin','manager','viewer','guard') then raise exception 'دور غير معروف'; end if;
  if p_role = 'manager' and coalesce(array_length(p_building_ids, 1), 0) = 0 then
    raise exception 'يجب تحديد عقار واحد على الأقل لمشرف العقار';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
    mail, crypt(p_password, gen_salt('bf')), now(),
    now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_id, new_id::text,
    json_build_object('sub', new_id::text, 'email', mail)::jsonb, 'email', now(), now(), now()
  );

  insert into public.profiles (id, username, display_name, role, phone, building_ids)
  values (new_id, uname, p_display, p_role, nullif(p_phone, ''),
          case when p_role = 'manager' then p_building_ids else null end);

  insert into public.audit_log (id, actor, action, detail)
  values ('a-' || replace(new_id::text, '-', ''),
          coalesce((select username from public.profiles where id = auth.uid()), '—'),
          'إضافة مستخدم', uname);
  return new_id;
end $$;

revoke all on function public.admin_create_user(text, text, text, text, text, text[]) from anon;
grant execute on function public.admin_create_user(text, text, text, text, text, text[]) to authenticated;
grant execute on function public.my_buildings() to authenticated;
