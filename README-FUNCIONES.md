# Funciones nuevas

La rama `feature` incorpora eventos por perfil, persistencia local, Service Worker, esquema SQL y la base para notificaciones programadas.

## Activación gratuita

1. Crear un proyecto gratuito en Supabase.
2. Ejecutar `supabase-schema.sql` en el SQL Editor.
3. Copiar la URL y la clave `anon` en `supabase-config.js`.
4. No publicar nunca `service_role` ni la clave privada VAPID.
5. Desplegar la función `supabase/functions/send-notifications` y programarla con Supabase Cron.

Sin Supabase configurado, los eventos funcionan en el dispositivo mediante `localStorage`; no se sincronizan entre teléfonos y las notificaciones programadas no pueden ejecutarse en segundo plano.

## Notificaciones

El permiso se solicita únicamente al pulsar “Activar avisos”. Para notificaciones remotas hay que guardar la suscripción Push en `push_subscriptions` y usar una Edge Function con la clave privada VAPID almacenada como secreto.
