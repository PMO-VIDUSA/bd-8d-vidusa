# SPEC — Migración BD 8D VIDUSA: Google Apps Script → Supabase

## Fase 1 — Propuesta

BD 8D - VIDUSA migra su backend de Google Sheets a Supabase (Postgres + Auth + RLS reales),
preservando exactamente los mismos usuarios (identidad = username actual, con email sintético
`username@vidusa.local` para Supabase Auth), las mismas contraseñas (ya estaban en texto plano en
la hoja `USUARIOS`, se reutilizan tal cual), los mismos roles (Admin/Editor/Viewer) y reglas de
permiso, y todos los folios 8D existentes migrados desde el Google Sheet real. El frontend sigue
siendo `index.html` + JS vanilla en Vercel; solo cambia el backend.

No-objetivos: no se rediseña la UI, no se agregan features nuevas, no se sube ningún
archivo/evidencia a Storage (siguen siendo links de texto pegados a mano).

Producción real, no piloto: hay 28 folios, 19 usuarios y 33 entradas de bitácora reales ya en uso.

## Fase 2 — Diseño

```
Browser (index.html + js/*.js)
   │  supabase-js client (anon key, público)
   ▼
Supabase (proyecto nuevo)
   ├── Auth          → email sintético (username@vidusa.local) + password real preservada
   ├── Postgres       → tablas profiles / registros_8d / bitacora
   └── RLS policies   → replican las reglas actuales (dueño/Admin/facilitador edita, solo Admin borra)
```

Árbol de carpetas final:

```
bd-8d-vidusa/
├── index.html                    # UI (se mantiene igual, se quita el JS inline de datos/auth)
├── js/
│   ├── supabaseClient.js         # cliente supabase-js (URL + anon key)
│   ├── auth.js                   # login/logout, username→email sintético, sesión
│   ├── registros.js              # CRUD de folios 8D (reemplaza fetch() a APPS_SCRIPT_URL)
│   └── bitacora.js               # lectura de bitácora (solo Admin)
├── supabase/
│   ├── schema.sql                 # CREATE TABLE profiles, registros_8d, bitacora + trigger updated_at
│   ├── rls.sql                    # políticas RLS
│   ├── functions.sql              # función Postgres para folio/ID_Registro atómico
│   └── seed_migracion.sql         # INSERTs de los 28 folios + 33 bitácoras reales
├── scripts/
│   └── migrar_usuarios.js         # script Node one-off: crea los 19 usuarios en Supabase Auth (Admin API), NO se commitea con passwords reales
├── PowerBI.gs                     # sin cambios, fuera de alcance
├── logo.jpeg
└── package.json                   # + @supabase/supabase-js
```

## Fase 3 — Fases de construcción

1. **[MVP] Supabase: schema + RLS** — checkpoint: tablas `profiles`/`registros_8d`/`bitacora`
   visibles en el dashboard de Supabase, RLS activo, insert/select funcionan desde el SQL Editor.
2. **[MVP] Migración de datos reales** — checkpoint: 19 usuarios existen en Supabase Auth (mismo
   username→email sintético, misma password), 28 folios en `registros_8d`, 33 filas en `bitacora`.
3. **[MVP] Frontend: login contra Supabase** — checkpoint: login en el navegador con un usuario
   real funciona y la sesión persiste al recargar.
4. **[MVP] Frontend: CRUD de folios contra Supabase** — checkpoint: crear/editar/borrar un folio
   funciona en el navegador y respeta los roles (Viewer no edita, dueño/Admin/facilitador sí,
   solo Admin borra).
5. **[MVP] Frontend: Bitácora** — checkpoint: pestaña Bitácora (solo Admin) muestra las 33
   entradas migradas.
6. **[Post-MVP] Apagar Apps Script** — quitar `APPS_SCRIPT_URL` del código, desactivar el
   deployment viejo.
7. **[Post-MVP] Gestión de usuarios vía Supabase** — reemplazar el endpoint `ADD_USER` casero por
   el flujo estándar de Supabase Auth Admin.

**MVP = Fases 1-5.** El sistema queda funcionando igual que hoy pero sobre Supabase. Fases 6-7 son
limpieza posterior, no bloquean el uso normal.

## Fase 4 — Subtareas

### Fase 1 — Supabase: schema + RLS
1.1. Crear proyecto Supabase nuevo (o confirmar si ya existe uno reservado para este proyecto).
1.2. `supabase/schema.sql`: tabla `profiles` (id uuid → auth.users, username unique, nombre, rol
     check in Admin/Editor/Viewer, fraccionamiento, facilitador_pmo).
1.3. `supabase/schema.sql`: tabla `registros_8d` con las ~90 columnas del formato 8D (mapeo 1:1
     de `HEADERS` en `codigo_apps_script.gs`), `id_registro` como PK текст, `creado_por` FK a
     profiles.username.
1.4. `supabase/schema.sql`: tabla `bitacora` (fecha, usuario, accion, id_registro, detalle).
1.5. `supabase/functions.sql`: función Postgres `generar_folio()` que asigna ID_Registro/Folio
     de forma atómica (reemplaza el `LockService` de Apps Script).
1.6. `supabase/rls.sql`: políticas —
     - `registros_8d` SELECT: cualquier usuario autenticado.
     - `registros_8d` INSERT: cualquier usuario con rol != Viewer.
     - `registros_8d` UPDATE: Admin, o `creado_por = auth.username()`, o el facilitador_pmo del
       perfil coincide con algún nombre en `facilitador_bpo` del registro.
     - `registros_8d` DELETE: solo Admin.
     - `bitacora` SELECT: solo Admin. INSERT: server-side (trigger), no directo desde cliente.
     - `profiles`: cada quien lee su propio perfil; Admin lee todos.
1.7. Correr `schema.sql` + `functions.sql` + `rls.sql` a mano en el SQL Editor de Supabase.
     Checkpoint de fase: confirmar en el dashboard que las 3 tablas y las políticas existen.

### Fase 2 — Migración de datos reales
2.1. `scripts/migrar_usuarios.js`: por cada fila de USUARIOS.csv, crear usuario en Supabase Auth
     (`admin.createUser`) con email `username@vidusa.local` (normalizado a lowercase) y su
     password real, luego insertar su fila en `profiles`.
2.2. `supabase/seed_migracion.sql`: INSERT de los 28 folios de BD_8D.csv en `registros_8d`.
2.3. `supabase/seed_migracion.sql`: INSERT de las 33 filas de BITACORA.csv en `bitacora`.
2.4. Checkpoint: `select count(*) from registros_8d` = 28, `select count(*) from bitacora` = 33,
     19 usuarios visibles en Authentication → Users del dashboard.

### Fase 3 — Frontend: login
3.1. `js/supabaseClient.js`: inicializar cliente con URL + anon key del proyecto.
3.2. `js/auth.js`: función `login(username, password)` → `signInWithPassword({email: username.toLowerCase()+'@vidusa.local', password})`,
     guarda perfil (rol, nombre, facilitador_pmo) en memoria/sessionStorage.
3.3. `index.html`: reemplazar la llamada AUTH actual por `auth.js`, quitar lógica de token HMAC.
3.4. Checkpoint: login real en navegador con `julioe` (o cualquier usuario migrado) funciona,
     recargar la página mantiene la sesión.

### Fase 4 — Frontend: CRUD
4.1. `js/registros.js`: `listar()`, `crear()`, `editar()`, `eliminar()` usando supabase-js
     (`.from('registros_8d')`), reemplazando los `fetch(APPS_SCRIPT_URL, ...)`.
4.2. `index.html`: apuntar cada acción del formulario/tabla a las funciones de `registros.js`.
4.3. Checkpoint: crear un folio nuevo genera ID_Registro correcto vía `generar_folio()`, editar
     respeta las reglas de permiso (probar con un Editor no-dueño → debe fallar), borrar solo
     funciona como Admin.

### Fase 5 — Frontend: Bitácora
5.1. `js/bitacora.js`: `listarBitacora()` vía `.from('bitacora').select()`.
5.2. `index.html`: conectar la pestaña Bitácora existente a `bitacora.js`.
5.3. Checkpoint: Admin ve las 33 entradas migradas; un Editor no puede acceder (bloqueado por RLS).

## Fase 6 — (post-freeze) Commit de congelamiento

Este archivo se commitea como `spec: freeze implementation plan for bd-8d-vidusa supabase migration`
antes de escribir cualquier código de implementación.
