-- BD 8D VIDUSA — schema.sql
-- Correr una sola vez en el SQL Editor de Supabase (proyecto lmtkrgcaocekfmcvgmct).

-- ── profiles ─────────────────────────────────────────────────────────
-- Un perfil por usuario de auth.users. username es la identidad canónica
-- que ya usan los datos migrados (Creado_Por, Facilitador_BPO, Bitacora.Usuario).
create table if not exists profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  username         text not null unique,
  nombre           text not null default '',
  rol              text not null default 'Viewer' check (rol in ('Admin','Editor','Viewer')),
  fraccionamiento  text not null default '',
  facilitador_pmo  text not null default '',
  created_at       timestamptz not null default now()
);

-- ── registros_8d ─────────────────────────────────────────────────────
-- Mapeo 1:1 de HEADERS en codigo_apps_script.gs, en snake_case.
create table if not exists registros_8d (
  id_registro                          text primary key,
  folio                                text not null,
  fraccionamiento                      text not null default '',
  fecha_revision                       text not null default '',
  superintendente                      text not null default '',
  residente                            text not null default '',
  facilitador_bpo                      text not null default '',
  equipo_trabajo                       text not null default '',
  descripcion_problema                 text not null default '',
  accion_contencion                    text not null default '',
  causa_raiz                           text not null default '',
  ponderacion_causa                    text not null default '',

  accion_correctiva_1  text not null default '', responsable_accion_1 text not null default '', fecha_programada_1 text not null default '', fecha_realizacion_1 text not null default '',
  accion_correctiva_2  text not null default '', responsable_accion_2 text not null default '', fecha_programada_2 text not null default '', fecha_realizacion_2 text not null default '',
  accion_correctiva_3  text not null default '', responsable_accion_3 text not null default '', fecha_programada_3 text not null default '', fecha_realizacion_3 text not null default '',
  accion_correctiva_4  text not null default '', responsable_accion_4 text not null default '', fecha_programada_4 text not null default '', fecha_realizacion_4 text not null default '',
  accion_correctiva_5  text not null default '', responsable_accion_5 text not null default '', fecha_programada_5 text not null default '', fecha_realizacion_5 text not null default '',
  accion_correctiva_6  text not null default '', responsable_accion_6 text not null default '', fecha_programada_6 text not null default '', fecha_realizacion_6 text not null default '',
  accion_correctiva_7  text not null default '', responsable_accion_7 text not null default '', fecha_programada_7 text not null default '', fecha_realizacion_7 text not null default '',
  accion_correctiva_8  text not null default '', responsable_accion_8 text not null default '', fecha_programada_8 text not null default '', fecha_realizacion_8 text not null default '',

  comentarios_accion                   text not null default '',
  resultado_accion                     text not null default '',
  verificacion_d6                      text not null default '',
  fecha_de_revision_d6                 text not null default '',
  satisfaccion_o_no_satisfaccion_d6    text not null default '',
  revision_1_d6                        text not null default '',
  residente_d6                         text not null default '',
  superintendente_d6                   text not null default '',
  facilitador_pmo_d6                   text not null default '',
  jefe_de_calidad_d6                   text not null default '',
  estatus_folio_d6                     text not null default '',
  fecha_cierre_d6                      text not null default '',
  evidencia_link_d6                    text not null default '',

  d7_documentos_estandarizados         text not null default '',
  manual_de_procesos                   text not null default '',
  plano                                text not null default '',
  modificacion_de_presupuesto          text not null default '',
  responsable_d7                       text not null default '',
  fecha_d7                             text not null default '',

  d8_evaluacion_de_efectividad         text not null default '',
  fecha_de_revision_d8                 text not null default '',
  satisfaccion_o_no_satisfaccion_d8    text not null default '',
  residente_d8                         text not null default '',
  superintendente_d8                   text not null default '',
  facilitador_pmo_d8                   text not null default '',
  jefe_de_calidad_d8                   text not null default '',
  estatus_folio_d8                     text not null default '',
  fecha_cierre_d8                      text not null default '',
  evidencia_link_d8                    text not null default '',

  creado_por                           text not null default '',
  votacion_d4_json                     text not null default '',

  bitacora_accion_1 text not null default '', fecha_bitacora_1 text not null default '',
  bitacora_accion_2 text not null default '', fecha_bitacora_2 text not null default '',
  bitacora_accion_3 text not null default '', fecha_bitacora_3 text not null default '',
  bitacora_accion_4 text not null default '', fecha_bitacora_4 text not null default '',
  bitacora_accion_5 text not null default '', fecha_bitacora_5 text not null default '',
  bitacora_accion_6 text not null default '', fecha_bitacora_6 text not null default '',
  bitacora_accion_7 text not null default '', fecha_bitacora_7 text not null default '',
  bitacora_accion_8 text not null default '', fecha_bitacora_8 text not null default '',

  updated_at timestamptz not null default now()
);

create index if not exists idx_registros_8d_creado_por on registros_8d (creado_por);
create index if not exists idx_registros_8d_fraccionamiento on registros_8d (fraccionamiento);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_registros_8d_updated_at on registros_8d;
create trigger trg_registros_8d_updated_at
  before update on registros_8d
  for each row execute function set_updated_at();

-- ── bitacora ─────────────────────────────────────────────────────────
create table if not exists bitacora (
  id           bigserial primary key,
  fecha        timestamptz not null default now(),
  usuario      text not null default '',
  accion       text not null default '',
  id_registro  text not null default '',
  detalle      text not null default ''
);

create index if not exists idx_bitacora_id_registro on bitacora (id_registro);
