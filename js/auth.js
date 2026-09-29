// Login/logout/sesión contra Supabase Auth — reemplaza el token HMAC propio
// de Apps Script. username -> email sintético username@vidusa.local (ver
// scripts/migrar_usuarios.js); la identidad real de la app sigue siendo el
// username, tal como lo espera el resto del código (Creado_Por, etc.).

async function sbLogin(username, password) {
  const uname = String(username || '').trim();
  const email = uname.toLowerCase() + '@vidusa.local';

  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({ email, password });
  if (authErr || !authData.session) {
    return { status: 'error', message: 'Usuario o contraseña incorrectos' };
  }

  const { data: profile, error: profErr } = await sb
    .from('profiles')
    .select('username,nombre,rol,fraccionamiento,facilitador_pmo')
    .eq('id', authData.user.id)
    .single();

  if (profErr || !profile) {
    await sb.auth.signOut();
    return { status: 'error', message: 'No se encontró tu perfil. Contacta a un Admin.' };
  }

  return {
    status: 'ok',
    user: {
      username: profile.username,
      fullname: profile.nombre,
      role: profile.rol,
      fracc: profile.fraccionamiento,
      facilitadorPmo: profile.facilitador_pmo,
      // Se conserva el campo "token" por compatibilidad con el resto del
      // código (algunas llamadas viejas a Apps Script todavía lo leen),
      // pero la sesión real la maneja supabase-js internamente.
      token: authData.session.access_token,
    },
  };
}

async function sbLogout() {
  try { await sb.auth.signOut(); } catch (e) { /* no-op */ }
}

// Confirma que la sesión de supabase-js (persistida en su propio localStorage)
// sigue viva. Si expiró/fue revocada, limpia todo para forzar re-login.
async function sbSessionAlive() {
  const { data } = await sb.auth.getSession();
  return !!data.session;
}
