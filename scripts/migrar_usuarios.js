// Migración de usuarios reales de USUARIOS.csv (Google Sheets) a Supabase Auth + profiles.
// Corre UNA VEZ: node scripts/migrar_usuarios.js
// Requiere .env en la raíz del repo con SUPABASE_URL y SUPABASE_SECRET_KEY.
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

// admin123/ADMIN -> Admin, Editor/Viewer se conservan
function normalizarRol(rolCrudo) {
  const r = String(rolCrudo || '').trim().toLowerCase();
  if (r === 'admin') return 'Admin';
  if (r === 'editor') return 'Editor';
  if (r === 'viewer') return 'Viewer';
  return String(rolCrudo || '').trim();
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const usuarios = csvToObjects(fs.readFileSync(path.join(__dirname, 'USUARIOS_raw.csv'), 'utf8'));
  console.log(`Migrando ${usuarios.length} usuarios...`);

  for (const u of usuarios) {
    const username = String(u.username || '').trim();
    if (!username) continue;
    const email = username.toLowerCase() + '@vidusa.local';
    const password = String(u.password || '');
    const rol = normalizarRol(u.rol);

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createErr) {
      console.error(`✗ ${username} (auth.createUser): ${createErr.message}`);
      continue;
    }

    const { error: profileErr } = await supabase.from('profiles').insert({
      id: created.user.id,
      username, // se preserva tal cual (case-sensitive: coincide con Creado_Por/Facilitador_BPO/Bitacora)
      nombre: String(u.nombre || '').trim(),
      rol,
      fraccionamiento: String(u.fraccionamiento || '').trim(),
      facilitador_pmo: String(u.facilitador_pmo || '').trim(),
    });

    if (profileErr) {
      console.error(`✗ ${username} (profiles.insert): ${profileErr.message}`);
      continue;
    }

    console.log(`✓ ${username} -> ${email} (${rol})`);
  }

  console.log('Listo.');
}

main().catch(err => { console.error(err); process.exit(1); });
