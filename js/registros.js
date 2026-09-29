// CRUD de folios 8D contra Supabase — reemplaza los fetch(APPS_SCRIPT_URL, ...).
// Traduce entre las claves PascalCase que usa el resto de index.html (COLS,
// formularios, etc. — igual que las devolvía Apps Script) y las columnas
// snake_case de la tabla registros_8d (ver supabase/schema.sql), para no
// tener que tocar el resto del archivo.

const CAMPOS_8D = [
  ['ID_Registro', 'id_registro'], ['Folio', 'folio'], ['Fraccionamiento', 'fraccionamiento'],
  ['Fecha_Revision', 'fecha_revision'], ['Superintendente', 'superintendente'], ['Residente', 'residente'],
  ['Facilitador_BPO', 'facilitador_bpo'], ['Equipo_Trabajo', 'equipo_trabajo'],
  ['Descripcion_Problema', 'descripcion_problema'], ['Accion_Contencion', 'accion_contencion'],
  ['Causa_Raiz', 'causa_raiz'], ['Ponderacion_Causa', 'ponderacion_causa'],
  ...([1, 2, 3, 4, 5, 6, 7, 8].flatMap(n => [
    [`Accion_Correctiva_${n}`, `accion_correctiva_${n}`],
    [`Responsable_Accion_${n}`, `responsable_accion_${n}`],
    [`Fecha_Programada_${n}`, `fecha_programada_${n}`],
    [`Fecha_Realizacion_${n}`, `fecha_realizacion_${n}`],
  ])),
  ['Comentarios_Accion', 'comentarios_accion'], ['Resultado_Accion', 'resultado_accion'],
  ['Verificacion_D6', 'verificacion_d6'], ['FECHA_DE_REVISION_D6', 'fecha_de_revision_d6'],
  ['SATISFACCION_O_NO_SATISFACCION_D6', 'satisfaccion_o_no_satisfaccion_d6'],
  ['REVISION_1_D6', 'revision_1_d6'], ['ResidenteD6', 'residente_d6'],
  ['Superintendente_D6', 'superintendente_d6'], ['Facilitador_PMO_D6', 'facilitador_pmo_d6'],
  ['Jefe_de_Calidad_D6', 'jefe_de_calidad_d6'], ['Estatus_Folio_D6', 'estatus_folio_d6'],
  ['Fecha_Cierre_D6', 'fecha_cierre_d6'], ['Evidencia_Link_D6', 'evidencia_link_d6'],
  ['D7_Documentos_estandarizados', 'd7_documentos_estandarizados'],
  ['Manual_de_Procesos', 'manual_de_procesos'], ['Plano', 'plano'],
  ['Modificacion_de_presupuesto', 'modificacion_de_presupuesto'],
  ['Responsable_D7', 'responsable_d7'], ['Fecha_D7', 'fecha_d7'],
  ['D8_Evaluacion_de_efectividad', 'd8_evaluacion_de_efectividad'],
  ['Fecha_de_revision_D8', 'fecha_de_revision_d8'],
  ['Satisfaccion_O_no_SatisfaccionD8', 'satisfaccion_o_no_satisfaccion_d8'],
  ['ResidenteD8', 'residente_d8'], ['SuperintendenteD8', 'superintendente_d8'],
  ['Facilitador_PMO_D8', 'facilitador_pmo_d8'], ['Jefe_de_Calidad_D8', 'jefe_de_calidad_d8'],
  ['Estatus_Folio_D8', 'estatus_folio_d8'], ['Fecha_Cierre_D8', 'fecha_cierre_d8'],
  ['Evidencia_Link_D8', 'evidencia_link_d8'], ['Creado_Por', 'creado_por'],
  ['Votacion_D4_JSON', 'votacion_d4_json'],
  ...([1, 2, 3, 4, 5, 6, 7, 8].flatMap(n => [
    [`Bitacora_Accion_${n}`, `bitacora_accion_${n}`],
    [`Fecha_Bitacora_${n}`, `fecha_bitacora_${n}`],
  ])),
];

function dbToApp(row) {
  const out = {};
  for (const [appKey, dbKey] of CAMPOS_8D) out[appKey] = row[dbKey] != null ? String(row[dbKey]) : '';
  return out;
}

// Solo incluye las columnas con valor no vacío: una UPDATE parcial en
// Postgres deja intactas las columnas que no se mandan, que es justo el
// comportamiento de "no borrar lo que ya había" que tenía el merge de
// Apps Script (ver PUT en codigo_apps_script.gs).
function appToDb(fields, { incluirVacios = false } = {}) {
  const out = {};
  for (const [appKey, dbKey] of CAMPOS_8D) {
    if (dbKey === 'id_registro' || dbKey === 'folio' || dbKey === 'creado_por') continue;
    const v = fields[appKey];
    if (incluirVacios || (v !== undefined && v !== '')) out[dbKey] = v === undefined ? '' : v;
  }
  return out;
}

async function sbListarRegistros() {
  const { data, error } = await sb.from('registros_8d').select('*');
  if (error) return { status: 'error', message: error.message };
  return { status: 'ok', data: data.map(dbToApp) };
}

async function sbCrearRegistro(fields) {
  const { data: folioRows, error: folioErr } = await sb.rpc('generar_folio');
  if (folioErr) return { status: 'error', message: folioErr.message };
  const { id_registro, folio } = folioRows[0];

  const row = appToDb(fields, { incluirVacios: true });
  row.id_registro = id_registro;
  row.folio = folio;
  row.creado_por = CU ? CU.username : '';

  const { error } = await sb.from('registros_8d').insert(row);
  if (error) return { status: 'error', message: error.message };
  return { status: 'ok', action: 'created', id: id_registro, folio };
}

async function sbActualizarRegistro(fields) {
  const id = fields.ID_Registro;
  if (!id) return { status: 'error', message: 'ID_Registro requerido' };
  const row = appToDb(fields);
  const { error } = await sb.from('registros_8d').update(row).eq('id_registro', id);
  if (error) return { status: 'error', message: error.message };
  return { status: 'ok', action: 'updated', id };
}

async function sbEliminarRegistro(id) {
  if (!id) return { status: 'error', message: 'ID_Registro requerido' };
  const { error } = await sb.from('registros_8d').delete().eq('id_registro', id);
  if (error) return { status: 'error', message: error.message };
  return { status: 'ok', action: 'deleted', id };
}
