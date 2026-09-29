-- BD 8D VIDUSA — rls.sql
-- Correr después de functions.sql.

alter table profiles      enable row level security;
alter table registros_8d  enable row level security;
alter table bitacora      enable row level security;

-- ── profiles ─────────────────────────────────────────────────────────
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select to authenticated
  using (id = auth.uid() or current_rol() = 'Admin');

-- ── registros_8d ─────────────────────────────────────────────────────
-- SELECT: cualquier usuario autenticado ve todos los folios (igual que hoy).
drop policy if exists registros_select on registros_8d;
create policy registros_select on registros_8d
  for select to authenticated
  using (true);

-- INSERT: Viewer no puede crear, y el folio debe quedar adjudicado a quien
-- lo está creando (sin esto, cualquiera con la API podía mandar
-- creado_por='otro-usuario' y falsificar la autoría de un folio).
drop policy if exists registros_insert on registros_8d;
create policy registros_insert on registros_8d
  for insert to authenticated
  with check (current_rol() <> 'Viewer' and creado_por = current_username());

-- UPDATE: cualquier Editor o Admin puede editar cualquier folio (no solo el
-- suyo) — los equipos rotan mucho de frente y la prioridad es que alguien
-- pueda darle continuidad a un folio aunque no lo haya creado él. Viewer
-- sigue sin poder editar nada.
drop policy if exists registros_update on registros_8d;
create policy registros_update on registros_8d
  for update to authenticated
  using (current_rol() <> 'Viewer');

-- DELETE: solo Admin.
drop policy if exists registros_delete on registros_8d;
create policy registros_delete on registros_8d
  for delete to authenticated
  using (current_rol() = 'Admin');

-- ── bitacora ─────────────────────────────────────────────────────────
-- Solo Admin puede leerla (igual que hoy: "Solo un Admin puede ver la Bitácora").
-- No hay policy de INSERT/UPDATE/DELETE para el rol authenticated: las únicas
-- escrituras válidas vienen del trigger log_bitacora() (security definer),
-- así que un cliente normal no puede insertar/alterar bitácora directamente.
drop policy if exists bitacora_select on bitacora;
create policy bitacora_select on bitacora
  for select to authenticated
  using (current_rol() = 'Admin');
