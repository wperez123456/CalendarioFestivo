# Funciones nuevas

La rama `feature` incorpora eventos por perfil, persistencia local, Service Worker, esquema SQL y la base para notificaciones programadas.

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

Sin Supabase configurado, los eventos funcionan en el dispositivo mediante `localStorage`; no se sincronizan entre teléfonos y las notificaciones programadas no pueden ejecutarse en segundo plano.

## Estado actual de la configuración

La URL del proyecto ya está preparada. La clave pública se ha dejado vacía intencionadamente porque el valor recibido no parece una clave Supabase válida y no debe tratarse como secreto de aplicación. Hay que copiar la clave pública desde el panel de API antes de esperar sincronización remota.

## Notificaciones

El permiso se solicita únicamente al pulsar “Activar avisos”. Para notificaciones remotas hay que guardar la suscripción Push en `push_subscriptions` y usar una Edge Function con la clave privada VAPID almacenada como secreto.
