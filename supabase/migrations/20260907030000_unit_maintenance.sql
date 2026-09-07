-- ============================================================================
--  حالة «تحت الصيانة» للوحدات — مستقلة عن الإشغال والملاحظة، وتُعدّ على حدة.
-- ============================================================================

alter table public.units
  add column if not exists maintenance      boolean not null default false,
  add column if not exists maintenance_note text,
  add column if not exists maintenance_at   timestamptz;

create index if not exists units_maintenance_idx
  on public.units (building_id) where maintenance;
