-- ============================================================================
--  إدارة عقار سلمان السلمان — قاعدة البيانات (Supabase / PostgreSQL)
--
--  شغّل هذا الملف مرة واحدة في:  Supabase Dashboard → SQL Editor → New query
--  ثم انسخ المفاتيح إلى Vercel كما في SETUP.md
--
--  ينشئ: الجداول، الصلاحيات (RLS)، التحديث اللحظي، مخزن الملفات،
--         دوال إدارة الحسابات، وحساب المالك الأول.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ============================================================================
--  1) الجداول
-- ============================================================================

-- ملف المستخدم مرتبط بحساب المصادقة. الدور هنا هو مصدر كل الصلاحيات.
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  username      text unique not null check (username = lower(username)),
  display_name  text not null,
  role          text not null default 'viewer' check (role in ('admin','viewer','guard')),
  phone         text,
  active        boolean not null default true,
  building_ids  text[],                       -- null = كل العقارات
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.buildings (
  id          text primary key,
  name        text not null,
  code        text default '',
  area        text default '',
  block       text default '',
  street      text default '',
  building_no text default '',
  parcel      text,
  owner_name  text default '',
  paci_no     text,
  land_area   numeric,
  built_area  numeric,
  notes       text,
  color       text default '#123a6b',
  created_at  timestamptz not null default now()
);

create table if not exists public.floors (
  id          text primary key,
  building_id text not null references public.buildings on delete cascade,
  level       int  not null,                  -- -1 سرداب، 0 أرضي، 1.. أدوار
  name        text not null,
  sort_order  int  not null default 0
);

create table if not exists public.units (
  id          text primary key,
  building_id text not null references public.buildings on delete cascade,
  floor_id    text not null references public.floors    on delete cascade,
  number      text not null,
  kind        text not null default 'apartment',
  status      text not null default 'vacant',
  area        numeric,
  rooms       int,
  bathrooms   int,
  balconies   int,
  base_rent   numeric not null default 0,
  meter_no    text,
  notes       text,
  flagged     boolean not null default false,
  flag_note   text,
  flagged_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (building_id, number)
);

create table if not exists public.tenants (
  id                text primary key,
  name              text not null,
  civil_id          text,
  phone             text default '',
  phone2            text,
  nationality       text,
  email             text,
  workplace         text,
  emergency_contact text,
  notes             text,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

create table if not exists public.contracts (
  id              text primary key,
  no              text not null,
  building_id     text not null references public.buildings on delete cascade,
  unit_id         text not null references public.units     on delete cascade,
  tenant_id       text not null references public.tenants   on delete cascade,
  start_date      date not null,
  end_date        date not null,
  first_rented_at date,
  signed_at       date,
  duration_text   text,
  occupants       int,
  rent            numeric not null default 0,
  deposit         numeric not null default 0,
  due_day         int not null default 1,
  pay_method      text not null default 'cash',
  status          text not null default 'active',
  terms           text,
  created_at      timestamptz not null default now()
);

create table if not exists public.payments (
  id          text primary key,
  receipt_no  text not null,
  building_id text not null references public.buildings on delete cascade,
  unit_id     text not null references public.units     on delete cascade,
  tenant_id   text not null references public.tenants   on delete cascade,
  contract_id text references public.contracts on delete set null,
  period      text not null,                  -- YYYY-MM
  amount      numeric not null,
  paid_at     date not null,
  method      text not null default 'cash',
  reference   text,
  bank        text,
  notes       text,
  created_by  text default '',
  created_at  timestamptz not null default now()
);
-- لا يُسجَّل الشهر نفسه مرتين لنفس العقد
create unique index if not exists payments_contract_period_key
  on public.payments (contract_id, period) where contract_id is not null;

create table if not exists public.expenses (
  id          text primary key,
  building_id text not null references public.buildings on delete cascade,
  category    text not null default 'other',
  title       text not null,
  amount      numeric not null,
  date        date not null,
  vendor      text,
  method      text not null default 'cash',
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.docs (
  id          text primary key,
  owner_type  text not null,
  owner_id    text not null,
  building_id text references public.buildings on delete cascade,
  kind        text not null default 'other',
  title       text not null,
  file_name   text not null,
  mime        text default '',
  size        bigint default 0,
  expires_at  date,
  uploaded_by text default '',
  uploaded_at timestamptz not null default now()
);

create table if not exists public.memos (
  id          text primary key,
  title       text not null,
  body        text not null default '',
  author_id   text default '',
  author_name text default '',
  created_at  timestamptz not null default now()
);

-- سجل من فعل ماذا ومتى — يُقرأ من صفحة المستخدمين
create table if not exists public.audit_log (
  id     text primary key,
  at     timestamptz not null default now(),
  actor  text default '',
  action text not null,
  detail text default ''
);

create table if not exists public.settings (
  id                       int primary key default 1 check (id = 1),
  org_name                 text not null default 'إدارة عقار سلمان السلمان',
  owner_full_name          text not null default 'سلمان محمد أحمد السلمان',
  currency                 text not null default 'KWD',
  session_minutes          int  not null default 43200,
  reminder_days_before_due int  not null default 3,
  contract_alert_days      int  not null default 45,
  tracking_start_period    text not null default to_char(now(), 'YYYY-MM'),
  due_day                  int  not null default 5,
  late_fee                 numeric not null default 200,
  supervisor_fee           numeric not null default 5
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------------------------ فهارس
create index if not exists units_building_idx   on public.units (building_id);
create index if not exists units_floor_idx      on public.units (floor_id);
create index if not exists contracts_unit_idx   on public.contracts (unit_id);
create index if not exists contracts_tenant_idx on public.contracts (tenant_id);
create index if not exists payments_period_idx  on public.payments (building_id, period);
create index if not exists expenses_date_idx    on public.expenses (building_id, date);
create index if not exists docs_owner_idx       on public.docs (owner_type, owner_id);
create index if not exists audit_at_idx         on public.audit_log (at desc);

-- ============================================================================
--  2) دوال الصلاحيات
-- ============================================================================

create or replace function public.auth_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() = 'admin', false)
$$;

/** أي مستخدم مفعّل — أدنى درجة للاطلاع. */
create or replace function public.can_read() returns boolean
language sql stable security definer set search_path = public as $$
  select public.auth_role() is not null
$$;

/** المالية محجوبة عن الحارس. */
create or replace function public.can_read_finance() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() in ('admin','viewer'), false)
$$;

/** المدير والحارس يعلّمان الشقق بالملاحظات. */
create or replace function public.can_flag() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() in ('admin','guard'), false)
$$;

-- ============================================================================
--  3) الصلاحيات على مستوى الصف (RLS)
--     لا شيء يُقرأ أو يُكتب بغير حساب مفعّل، حتى بمفتاح anon العلني.
-- ============================================================================

alter table public.profiles  enable row level security;
alter table public.buildings enable row level security;
alter table public.floors    enable row level security;
alter table public.units     enable row level security;
alter table public.tenants   enable row level security;
alter table public.contracts enable row level security;
alter table public.payments  enable row level security;
alter table public.expenses  enable row level security;
alter table public.docs      enable row level security;
alter table public.memos     enable row level security;
alter table public.audit_log enable row level security;
alter table public.settings  enable row level security;

-- الحسابات: كل مستخدم يرى نفسه، والمدير يرى ويعدّل الجميع
drop policy if exists profiles_read  on public.profiles;
create policy profiles_read  on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- جداول يقرأها كل مستخدم مفعّل ويكتبها المدير
do $$
declare t text;
begin
  foreach t in array array['buildings','floors','tenants','contracts','docs','settings'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select using (public.can_read())', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_write on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- الوحدات: الجميع يقرأ، المدير يكتب، والحارس يعدّل (لتعليم الملاحظات)
drop policy if exists units_read on public.units;
create policy units_read on public.units for select using (public.can_read());
drop policy if exists units_insert on public.units;
create policy units_insert on public.units for insert with check (public.is_admin());
drop policy if exists units_update on public.units;
create policy units_update on public.units for update using (public.can_flag()) with check (public.can_flag());
drop policy if exists units_delete on public.units;
create policy units_delete on public.units for delete using (public.is_admin());

-- المالية: قراءة للمدير والمحاسب، وكتابة للمدير
do $$
declare t text;
begin
  foreach t in array array['payments','expenses'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select using (public.can_read_finance())', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_write on public.%I for all using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- المراسلات: الجميع يقرأ، المدير والحارس يكتبان، المدير يحذف
drop policy if exists memos_read on public.memos;
create policy memos_read on public.memos for select using (public.can_read());
drop policy if exists memos_insert on public.memos;
create policy memos_insert on public.memos for insert with check (public.can_flag());
drop policy if exists memos_update on public.memos;
create policy memos_update on public.memos for update using (public.is_admin());
drop policy if exists memos_delete on public.memos;
create policy memos_delete on public.memos for delete using (public.is_admin());

-- السجل: يكتب فيه كل مستخدم، ويقرؤه المدير — ولا يُعدَّل ولا يُحذف أبدًا
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select using (public.is_admin());
drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log for insert with check (public.can_read());

-- ============================================================================
--  4) التحديث اللحظي — تغيير أي مستخدم يظهر عند البقية فورًا
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array['profiles','buildings','floors','units','tenants','contracts',
                           'payments','expenses','docs','memos','audit_log','settings'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ============================================================================
--  5) مخزن الملفات (صور البطاقة المدنية، العقود الممسوحة…)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists documents_bucket_read on storage.objects;
create policy documents_bucket_read on storage.objects for select
  using (bucket_id = 'documents' and public.can_read());

drop policy if exists documents_bucket_write on storage.objects;
create policy documents_bucket_write on storage.objects for insert
  with check (bucket_id = 'documents' and public.is_admin());

drop policy if exists documents_bucket_update on storage.objects;
create policy documents_bucket_update on storage.objects for update
  using (bucket_id = 'documents' and public.is_admin());

drop policy if exists documents_bucket_delete on storage.objects;
create policy documents_bucket_delete on storage.objects for delete
  using (bucket_id = 'documents' and public.is_admin());

-- ============================================================================
--  6) إدارة الحسابات
--     الدخول باسم المستخدم فقط؛ ويُشتقّ البريد الداخلي منه بحروف صغيرة.
--     إن غيّرت NEXT_PUBLIC_AUTH_EMAIL_DOMAIN فغيّر هذه الدالة معه.
-- ============================================================================

create or replace function public.auth_email_domain() returns text
language sql immutable as $$ select 'users.salmanalsalman.app'::text $$;

/** يسجّل آخر دخول للمستخدم الحالي دون أن يملك حق تعديل بقية ملفه. */
create or replace function public.touch_login() returns void
language sql security definer set search_path = public as $$
  update public.profiles set last_login_at = now() where id = auth.uid()
$$;

/** ينشئ حسابًا كاملًا (مصادقة + صلاحيات) — للمدير فقط. */
create or replace function public.admin_create_user(
  p_username text, p_password text, p_display text, p_role text, p_phone text
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
  if p_role not in ('admin','viewer','guard') then raise exception 'دور غير معروف'; end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
    mail, extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_id, new_id::text,
    json_build_object('sub', new_id::text, 'email', mail)::jsonb, 'email', now(), now(), now()
  );

  insert into public.profiles (id, username, display_name, role, phone)
  values (new_id, uname, p_display, p_role, nullif(p_phone, ''));

  insert into public.audit_log (id, actor, action, detail)
  values ('a-' || replace(new_id::text, '-', ''),
          coalesce((select username from public.profiles where id = auth.uid()), '—'),
          'إضافة مستخدم', uname);
  return new_id;
end $$;

/** يغيّر كلمة مرور أي مستخدم — للمدير فقط. */
create or replace function public.admin_set_password(p_user uuid, p_password text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'not-allowed'; end if;
  if length(p_password) < 8 then raise exception 'كلمة المرور قصيرة'; end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = p_user;

  insert into public.audit_log (id, actor, action, detail)
  values ('a-' || replace(gen_random_uuid()::text, '-', ''),
          coalesce((select username from public.profiles where id = auth.uid()), '—'),
          'تغيير كلمة مرور',
          coalesce((select username from public.profiles where id = p_user), p_user::text));
end $$;

/** يحذف حسابًا نهائيًا — للمدير فقط، ولا يحذف آخر مدير. */
create or replace function public.admin_delete_user(p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare uname text;
begin
  if not public.is_admin() then raise exception 'not-allowed'; end if;
  if p_user = auth.uid() then raise exception 'لا يمكنك حذف حسابك'; end if;
  select username into uname from public.profiles where id = p_user;
  if (select count(*) from public.profiles where role = 'admin' and active) <= 1
     and (select role from public.profiles where id = p_user) = 'admin' then
    raise exception 'يجب بقاء مدير واحد على الأقل';
  end if;

  delete from auth.users where id = p_user;   -- يحذف ملف الصلاحيات تلقائيًا

  insert into public.audit_log (id, actor, action, detail)
  values ('a-' || replace(gen_random_uuid()::text, '-', ''),
          coalesce((select username from public.profiles where id = auth.uid()), '—'),
          'حذف مستخدم', coalesce(uname, p_user::text));
end $$;

revoke all on function public.admin_create_user(text, text, text, text, text) from anon;
revoke all on function public.admin_set_password(uuid, text) from anon;
revoke all on function public.admin_delete_user(uuid) from anon;
grant execute on function public.admin_create_user(text, text, text, text, text) to authenticated;
grant execute on function public.admin_set_password(uuid, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.touch_login() to authenticated;

-- ============================================================================
--  7) حساب المالك الأول
--     اسم المستخدم: Ali   (لا فرق بين الحروف الكبيرة والصغيرة)
--     كلمة المرور:  Aa112233@   — غيّرها من الإعدادات بعد أول دخول
-- ============================================================================

do $$
declare
  new_id uuid := gen_random_uuid();
  mail   text := 'ali@' || public.auth_email_domain();
begin
  if exists (select 1 from auth.users where email = mail) then
    raise notice 'الحساب موجود مسبقًا — لم يُنشأ من جديد';
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
    mail, extensions.crypt('Aa112233@', extensions.gen_salt('bf')), now(),
    now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_id, new_id::text,
    json_build_object('sub', new_id::text, 'email', mail)::jsonb, 'email', now(), now(), now()
  );

  insert into public.profiles (id, username, display_name, role)
  values (new_id, 'ali', 'علي', 'admin');
end $$;
