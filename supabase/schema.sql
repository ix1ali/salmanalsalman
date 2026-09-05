-- ============================================================================
--  نظام إدارة العمارات — مخطط قاعدة البيانات (Supabase / PostgreSQL)
--  شغّل هذا الملف في: Supabase Dashboard → SQL Editor → New query
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- الأنواع --
do $$ begin
  create type app_role        as enum ('admin', 'viewer', 'guard');
  create type unit_status     as enum ('occupied', 'vacant', 'maintenance', 'reserved');
  create type unit_kind       as enum ('apartment', 'shop', 'storage', 'office', 'parking');
  create type pay_method      as enum ('cash', 'knet', 'transfer', 'cheque', 'link');
  create type contract_status as enum ('active', 'expired', 'terminated', 'upcoming');
  create type ticket_status   as enum ('new', 'in_progress', 'done', 'cancelled');
  create type ticket_priority as enum ('low', 'normal', 'high', 'urgent');
  create type expense_category as enum ('electricity','water','guard','cleaning','elevator',
                                        'maintenance','government','internet','insurance','other');
  create type doc_kind        as enum ('civil_id','passport','contract','receipt','statement',
                                       'cheque','license','deed','photo','other');
  create type owner_type      as enum ('tenant','unit','building','contract','payment','expense','maintenance');
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------- الجداول --

-- ملف المستخدم مرتبط بحساب Supabase Auth. الدور هنا هو مصدر الصلاحيات.
create table if not exists profiles (
  id            uuid primary key references auth.users on delete cascade,
  username      text unique not null,
  display_name  text not null,
  role          app_role not null default 'viewer',
  phone         text,
  active        boolean not null default true,
  building_ids  uuid[],                      -- null = كل العمارات
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists buildings (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  code         text,
  area         text,
  block        text,
  street       text,
  building_no  text,
  owner_name   text,
  paci_no      text,
  land_area    numeric,
  built_area   numeric,
  color        text default '#0e9f8e',
  notes        text,
  created_at   timestamptz not null default now()
);

create table if not exists floors (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings on delete cascade,
  level       int  not null,                 -- -1 سرداب، 0 أرضي، 1.. أدوار
  name        text not null,
  sort_order  int  not null default 0,
  unique (building_id, level)
);

create table if not exists units (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings on delete cascade,
  floor_id    uuid not null references floors    on delete cascade,
  number      text not null,
  kind        unit_kind   not null default 'apartment',
  status      unit_status not null default 'vacant',
  area        numeric,
  rooms       int,
  bathrooms   int,
  balconies   int,
  base_rent   numeric not null default 0,
  meter_no    text,
  notes       text,
  created_at  timestamptz not null default now(),
  unique (building_id, number)
);

create table if not exists tenants (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  civil_id          text,
  phone             text not null,
  phone2            text,
  nationality       text,
  email             text,
  workplace         text,
  emergency_contact text,
  notes             text,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);
create unique index if not exists tenants_civil_id_key on tenants (civil_id) where civil_id is not null;

create table if not exists contracts (
  id          uuid primary key default gen_random_uuid(),
  no          text unique not null,
  building_id uuid not null references buildings on delete cascade,
  unit_id     uuid not null references units     on delete cascade,
  tenant_id   uuid not null references tenants   on delete cascade,
  start_date  date not null,
  end_date    date not null,
  rent        numeric not null,
  deposit     numeric not null default 0,
  due_day     int not null default 1,
  pay_method  pay_method not null default 'knet',
  status      contract_status not null default 'active',
  terms       text,
  created_at  timestamptz not null default now(),
  check (end_date > start_date)
);
-- عقد ساري واحد فقط لكل وحدة
create unique index if not exists contracts_one_active_per_unit
  on contracts (unit_id) where status = 'active';

create table if not exists payments (
  id          uuid primary key default gen_random_uuid(),
  receipt_no  text unique not null,
  building_id uuid not null references buildings on delete cascade,
  unit_id     uuid not null references units     on delete cascade,
  tenant_id   uuid not null references tenants   on delete cascade,
  contract_id uuid references contracts on delete set null,
  period      text not null,                  -- YYYY-MM
  amount      numeric not null check (amount > 0),
  paid_at     date not null,
  method      pay_method not null,
  reference   text,
  notes       text,
  created_by  text,
  created_at  timestamptz not null default now(),
  unique (contract_id, period)                 -- لا تكرار لنفس الشهر
);

create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings on delete cascade,
  category    expense_category not null,
  title       text not null,
  amount      numeric not null check (amount > 0),
  date        date not null,
  vendor      text,
  method      pay_method not null default 'cash',
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists tickets (
  id          uuid primary key default gen_random_uuid(),
  no          text unique not null,
  building_id uuid not null references buildings on delete cascade,
  unit_id     uuid references units   on delete set null,
  tenant_id   uuid references tenants on delete set null,
  title       text not null,
  description text,
  status      ticket_status   not null default 'new',
  priority    ticket_priority not null default 'normal',
  cost        numeric,
  assignee    text,
  created_by  text,
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);

create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  owner_type  owner_type not null,
  owner_id    uuid not null,
  building_id uuid references buildings on delete cascade,
  kind        doc_kind not null default 'other',
  title       text not null,
  file_name   text not null,
  storage_path text not null,                 -- المسار داخل bucket «documents»
  mime        text,
  size        bigint,
  expires_at  date,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

create table if not exists audit_log (
  id      uuid primary key default gen_random_uuid(),
  at      timestamptz not null default now(),
  actor   text,
  action  text not null,
  detail  text
);

create table if not exists settings (
  id                      int primary key default 1 check (id = 1),
  org_name                text not null default 'إدارة أملاك',
  currency                text not null default 'KWD',
  session_minutes         int  not null default 480,
  reminder_days_before_due int not null default 3,
  contract_alert_days     int  not null default 45
);
insert into settings (id) values (1) on conflict do nothing;

-- --------------------------------------------------------------- فهارس --
create index if not exists units_building_idx     on units (building_id);
create index if not exists units_floor_idx        on units (floor_id);
create index if not exists contracts_unit_idx     on contracts (unit_id);
create index if not exists contracts_tenant_idx   on contracts (tenant_id);
create index if not exists payments_period_idx    on payments (building_id, period);
create index if not exists payments_tenant_idx    on payments (tenant_id);
create index if not exists expenses_date_idx      on expenses (building_id, date);
create index if not exists documents_owner_idx    on documents (owner_type, owner_id);

-- ------------------------------------------------------ دوال الصلاحيات --

create or replace function auth_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active
$$;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() = 'admin', false)
$$;

-- يقرأ الجميع (admin/viewer/guard)، ويكتب المدير فقط
create or replace function can_read() returns boolean
language sql stable security definer set search_path = public as $$
  select auth_role() is not null
$$;

-- المالية محجوبة عن الحارس
create or replace function can_read_finance() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() in ('admin', 'viewer'), false)
$$;

-- ------------------------------------------------------------------ RLS --

alter table profiles   enable row level security;
alter table buildings  enable row level security;
alter table floors     enable row level security;
alter table units      enable row level security;
alter table tenants    enable row level security;
alter table contracts  enable row level security;
alter table payments   enable row level security;
alter table expenses   enable row level security;
alter table tickets    enable row level security;
alter table documents  enable row level security;
alter table audit_log  enable row level security;
alter table settings   enable row level security;

-- profiles: كل مستخدم يقرأ ملفه، والمدير يقرأ ويكتب الجميع
drop policy if exists profiles_self_read on profiles;
create policy profiles_self_read on profiles for select using (id = auth.uid() or is_admin());
drop policy if exists profiles_admin_write on profiles;
create policy profiles_admin_write on profiles for all using (is_admin()) with check (is_admin());

-- جداول تُقرأ من الجميع ويكتبها المدير
do $$
declare t text;
begin
  foreach t in array array['buildings','floors','units','tenants','contracts','settings'] loop
    execute format('drop policy if exists %I_read on %I', t, t);
    execute format('create policy %I_read on %I for select using (can_read())', t, t);
    execute format('drop policy if exists %I_write on %I', t, t);
    execute format('create policy %I_write on %I for all using (is_admin()) with check (is_admin())', t, t);
  end loop;
end $$;

-- المالية: قراءة للمدير والمشاهد فقط، وكتابة للمدير
do $$
declare t text;
begin
  foreach t in array array['payments','expenses'] loop
    execute format('drop policy if exists %I_read on %I', t, t);
    execute format('create policy %I_read on %I for select using (can_read_finance())', t, t);
    execute format('drop policy if exists %I_write on %I', t, t);
    execute format('create policy %I_write on %I for all using (is_admin()) with check (is_admin())', t, t);
  end loop;
end $$;

-- البلاغات: الجميع يقرأ، والمدير والحارس ينشئان ويحدّثان
drop policy if exists tickets_read on tickets;
create policy tickets_read on tickets for select using (can_read());
drop policy if exists tickets_insert on tickets;
create policy tickets_insert on tickets for insert
  with check (coalesce(auth_role() in ('admin','guard'), false));
drop policy if exists tickets_update on tickets;
create policy tickets_update on tickets for update
  using (coalesce(auth_role() in ('admin','guard'), false));
drop policy if exists tickets_delete on tickets;
create policy tickets_delete on tickets for delete using (is_admin());

-- المستندات: الجميع يقرأ، المدير يرفع ويحذف
drop policy if exists documents_read on documents;
create policy documents_read on documents for select using (can_read());
drop policy if exists documents_write on documents;
create policy documents_write on documents for all using (is_admin()) with check (is_admin());

-- سجل العمليات: قراءة للمدير، وكتابة لأي مستخدم مسجّل
drop policy if exists audit_read on audit_log;
create policy audit_read on audit_log for select using (is_admin());
drop policy if exists audit_insert on audit_log;
create policy audit_insert on audit_log for insert with check (can_read());

-- ------------------------------------------------------- تخزين الملفات --
-- أنشئ bucket خاص باسم documents من لوحة التحكم، ثم:
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists documents_bucket_read on storage.objects;
create policy documents_bucket_read on storage.objects for select
  using (bucket_id = 'documents' and can_read());

drop policy if exists documents_bucket_write on storage.objects;
create policy documents_bucket_write on storage.objects for all
  using (bucket_id = 'documents' and is_admin())
  with check (bucket_id = 'documents' and is_admin());

-- ------------------------------------------------- أول حساب مدير (مثال) --
-- بعد إنشاء المستخدم من Authentication → Users، نفّذ:
-- insert into profiles (id, username, display_name, role)
-- values ('<UUID المستخدم>', 'admin', 'سلمان السالمان', 'admin');
