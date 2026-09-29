// Cliente Supabase — clave pública (publishable/anon), segura de exponer en el navegador.
// La seguridad real la da RLS en la base de datos (ver supabase/rls.sql), no esta clave.
const SUPABASE_URL = 'https://lmtkrgcaocekfmcvgmct.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_GMznvcKjYHu05an-z80JLA_K4oW9Lkp';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
