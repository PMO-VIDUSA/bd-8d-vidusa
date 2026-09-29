-- BD 8D VIDUSA — functions.sql
-- Correr después de schema.sql.

-- ── helpers de sesión (usados por rls.sql) ──────────────────────────
-- security definer + search_path fijo: sin esto, profiles_select (que
-- también llama a current_rol()) entra en recursión infinita consigo
-- misma al leer profiles desde aquí adentro ("stack depth limit
-- exceeded" al guardar cualquier cambio, no solo en folios cerrados).
create or replace function current_username()
returns text language sql stable security definer set search_path = public
as $$
  select username from profiles where id = auth.uid();
$$;

create or replace function current_rol()
returns text language sql stable security definer set search_path = public
as $$
  select rol from profiles where id = auth.uid();
$$;

create or replace function current_facilitador_pmo()
returns text language sql stable security definer set search_path = public
as $$
  select facilitador_pmo from profiles where id = auth.uid();
$$;

-- true si el facilitador_pmo del usuario en sesión aparece en la lista
-- (separada por comas) de facilitador_bpo de un registro.
create or replace function es_facilitador_asignado(facilitador_bpo text)
returns boolean language sql stable
as $$
  select coalesce(current_facilitador_pmo(), '') <> ''
     and current_facilitador_pmo() = any (
           select trim(x) from unnest(string_to_array(coalesce(facilitador_bpo, ''), ',')) as x
         );
$$;

-- ── folio atómico ────────────────────────────────────────────────────
-- Reemplaza el LockService.getScriptLock() de Apps Script: nextval() es
-- atómico a nivel de Postgres, no hace falta lock manual.
-- Empieza en 32 porque el folio 031 ya existe en los datos migrados
-- (ajustar el START WITH si se corre esto antes de migrar los datos).
create sequence if not exists registros_8d_folio_seq start with 32;

create or replace function generar_folio(anio int default extract(year from now())::int)
returns table (id_registro text, folio text)
language plpgsql
as $$
declare
  n int;
  f text;
  idr text;
begin
  loop
    n := nextval('registros_8d_folio_seq');
    f := lpad(n::text, 3, '0');
    idr := '8D-' || anio::text || '-' || f;
    exit when not exists (select 1 from registros_8d where id_registro = idr);
  end loop;
  return query select idr, f;
end;
$$;

-- ── bitácora automática ──────────────────────────────────────────────
-- Reemplaza registrarBitacora(): se dispara sola en INSERT/UPDATE/DELETE
-- sobre registros_8d, así el cliente nunca escribe directo en bitacora
-- (evita que alguien falsifique su propio registro de auditoría).
create or replace function log_bitacora()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  k text;
  old_v text;
  new_v text;
  cambios text := '';
begin
  if tg_op = 'INSERT' then
    insert into bitacora (usuario, accion, id_registro, detalle)
    values (coalesce(current_username(), ''), 'Crear', new.id_registro,
            'Fraccionamiento: ' || coalesce(nullif(new.fraccionamiento, ''), '—'));
    return new;
  elsif tg_op = 'UPDATE' then
    -- Detalle campo por campo: "campo: valor_viejo → valor_nuevo", solo de
    -- las columnas que en verdad cambiaron (updated_at se excluye porque
    -- siempre cambia y no aporta nada al historial).
    for k in select jsonb_object_keys(to_jsonb(new)) loop
      if k in ('updated_at', 'id_registro', 'folio') then continue; end if;
      old_v := to_jsonb(old) ->> k;
      new_v := to_jsonb(new) ->> k;
      if old_v is distinct from new_v then
        cambios := cambios || k || ': "' || coalesce(old_v, '') || '" → "' || coalesce(new_v, '') || '"; ';
      end if;
    end loop;
    if cambios = '' then return new; end if; -- nada cambió de verdad, no ensucia la bitácora
    insert into bitacora (usuario, accion, id_registro, detalle)
    values (coalesce(current_username(), ''), 'Editar', new.id_registro, cambios);
    return new;
  elsif tg_op = 'DELETE' then
    insert into bitacora (usuario, accion, id_registro, detalle)
    values (coalesce(current_username(), ''), 'Eliminar', old.id_registro, '');
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_registros_8d_bitacora on registros_8d;
create trigger trg_registros_8d_bitacora
  after insert or update or delete on registros_8d
  for each row execute function log_bitacora();
