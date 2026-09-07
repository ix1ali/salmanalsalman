-- ============================================================================
--  ربط المستأجر بعقاره: كل عقار ومستأجروه.
--  بعدها لا يرى مشرف العقار مستأجري العقارات الأخرى إطلاقًا.
-- ============================================================================

set search_path = public, extensions;

-- ------------------------------------------------------ 1) عمود العقار --
alter table public.tenants
  add column if not exists building_id text references public.buildings on delete cascade;

-- ------------------------- 2) تعبئة العقار من عقود المستأجر الموجودة --
update public.tenants t
   set building_id = c.building_id
  from (
    select distinct on (tenant_id) tenant_id, building_id
      from public.contracts
     order by tenant_id, created_at desc
  ) c
 where c.tenant_id = t.id
   and t.building_id is null;

-- من لا عقد له يُنسب إلى العقار الأول (يمكن نقله لاحقًا من الواجهة)
update public.tenants
   set building_id = (select id from public.buildings order by created_at limit 1)
 where building_id is null;

create index if not exists tenants_building_idx on public.tenants (building_id);

-- --------------------------------- 3) الصلاحيات مقيّدة بعقار المستأجر --
drop policy if exists tenants_read  on public.tenants;
drop policy if exists tenants_write on public.tenants;

create policy tenants_read on public.tenants for select
  using (public.sees_building(building_id));

create policy tenants_write on public.tenants for all
  using (public.edits_building(building_id))
  with check (public.edits_building(building_id));
