# Funciones nuevas

La rama `feature` incorpora eventos por perfil, hora independiente de la cita y del aviso, persistencia local, Service Worker, esquema SQL y notificaciones programadas.

## Activación gratuita

1. Crear un proyecto gratuito en Supabase.
2. Ejecutar `supabase-schema.sql` en el SQL Editor.
3. En **Project Settings > API**, copiar la **Project URL** y la clave pública `anon`/`publishable` en `supabase-config.js`.
   - Correcto: `https://exvdwckmjdholtwdlkbo.supabase.co`
   - Incorrecto: una URL que empiece por `https://supabase.com/dashboard/...`
   - La clave pública suele comenzar por `eyJ` (anon JWT) o `sb_publishable_`.
4. No publicar nunca `service_role`, `sb_secret_`, claves privadas VAPID ni contraseñas.
5. Abrir la aplicación y crear un evento. En la consola del navegador no debe aparecer un error 401/403 de Supabase.
6. Desplegar la función `send-notifications` y programarla con Supabase Cron.
7. Si la base ya existía, ejecutar una vez `supabase-event-time-migration.sql` para añadir `event_time` y migrar las antiguas horas de inicio.

La clave pública VAPID se configura en `supabase-config.js`; la clave privada debe guardarse como secreto de Edge Functions con el nombre `VAPID_PRIVATE_KEY`.

Sin Supabase configurado, los eventos funcionan en el dispositivo mediante `localStorage`; no se sincronizan entre teléfonos y las notificaciones programadas no pueden ejecutarse en segundo plano.

## Estado actual de la configuración

La URL del proyecto ya está preparada. La clave pública se ha dejado vacía intencionadamente porque el valor recibido no parece una clave Supabase válida y no debe tratarse como secreto de aplicación. Hay que copiar la clave pública desde el panel de API antes de esperar sincronización remota.

## Notificaciones

El permiso se solicita únicamente al pulsar “Activar avisos”. Para notificaciones remotas hay que guardar la suscripción Push en `push_subscriptions` y usar una Edge Function con la clave privada VAPID almacenada como secreto.

La función evalúa la hora local de `Europe/Madrid` cada 5 minutos: los avisos de cada evento usan `notification_time` y, si está vacío, `08:00`; el domingo entre las 15:00 y las 15:09 envía un aviso titulado “Recordatorio” con los eventos del lunes al sábado siguientes. La ventana de entrega de cada aviso es de 10 minutos.

## Aviso de seguridad pendiente

La revisión de Supabase indicó que `public.notification_deliveries` tiene RLS desactivado. Antes de habilitarlo hay que definir una política adecuada para el acceso interno de la Edge Function; no se debe activar RLS sin políticas porque podría bloquear las escrituras de la función. La tabla no se expone desde el frontend.

