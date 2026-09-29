// Lectura de bitácora — RLS ya restringe esto a rol Admin a nivel de base
// de datos (ver supabase/rls.sql), esto solo formatea la respuesta igual
// que la devolvía Apps Script (?bitacora=1).

async function sbListarBitacora() {
  const { data, error } = await sb
    .from('bitacora')
    .select('fecha,usuario,accion,id_registro,detalle')
    .order('fecha', { ascending: false });

  if (error) return { status: 'error', message: error.message };

  return {
    status: 'ok',
    data: data.map(r => ({
      Fecha: new Date(r.fecha).toLocaleString('es-MX'),
      Usuario: r.usuario,
      Accion: r.accion,
      ID_Registro: r.id_registro,
      Detalle: r.detalle || '',
    })),
  };
}
