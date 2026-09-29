// Migración de folios (BD_8D.csv) y bitácora (BITACORA.csv) a Supabase.
// Corre UNA VEZ, DESPUÉS de migrar_usuarios.js: node scripts/migrar_datos.js
//
// IMPORTANTE: antes de correr este script, desactiva el trigger de bitácora
// automática en el SQL Editor de Supabase (si no, cada folio insertado genera
// una entrada falsa "Crear" con usuario vacío, mezclada con la bitácora real):
//   ALTER TABLE registros_8d DISABLE TRIGGER trg_registros_8d_bitacora;
// Y vuelve a activarlo cuando el script termine:
//   ALTER TABLE registros_8d ENABLE TRIGGER trg_registros_8d_bitacora;
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { csvToObjects } = require('./csvParser.js');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const text = fs.readFileSync(envPath, 'utf8');
  const env = {};
  text.split('\n').forEach(line => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  });
  return env;
}

// Orden exacto de columnas tal como aparecen en BD_8D.csv -> nombre de columna en registros_8d.
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

function mapRegistro(csvRow) {
  const out = {};
  for (const [csvCol, dbCol] of CAMPOS_8D) {
    out[dbCol] = csvRow[csvCol] !== undefined ? String(csvRow[csvCol]).trim() : '';
  }
  return out;
}

// "11/08/2026 11:08:21" (dd/mm/yyyy hh:mm:ss, hora sin zona en el Sheet) -> timestamp ISO.
function parseFechaBitacora(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) return new Date().toISOString();
  const [, d, mo, y, h, mi, se] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${mi}:${se}`;
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const registros = csvToObjects(fs.readFileSync(path.join(__dirname, 'BD_8D_raw.csv'), 'utf8'))
    .filter(r => String(r.ID_Registro || '').trim() !== '')
    .map(mapRegistro);

  console.log(`Insertando ${registros.length} folios en registros_8d...`);
  const { error: regErr } = await supabase.from('registros_8d').insert(registros);
  if (regErr) { console.error('✗ registros_8d:', regErr.message); process.exit(1); }
  console.log('✓ registros_8d listo.');

  const bitacora = csvToObjects(fs.readFileSync(path.join(__dirname, 'BITACORA_raw.csv'), 'utf8'))
    .map(r => ({
      fecha: parseFechaBitacora(r.Fecha),
      usuario: String(r.Usuario || '').trim(),
      accion: String(r.Accion || '').trim(),
      id_registro: String(r.ID_Registro || '').trim(),
      detalle: String(r.Detalle || '').trim(),
    }));

  console.log(`Insertando ${bitacora.length} entradas en bitacora...`);
  const { error: bitErr } = await supabase.from('bitacora').insert(bitacora);
  if (bitErr) { console.error('✗ bitacora:', bitErr.message); process.exit(1); }
  console.log('✓ bitacora lista.');

  console.log('Listo. Recuerda re-activar el trigger:');
  console.log('  ALTER TABLE registros_8d ENABLE TRIGGER trg_registros_8d_bitacora;');
}

main().catch(err => { console.error(err); process.exit(1); });
