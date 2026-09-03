import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Ejecutar con Supabase Cron cada 5 minutos. Las horas se evalúan en Europe/Madrid.
// La entrega Web Push debe conectarse aquí con una librería VAPID y el secreto VAPID_PRIVATE_KEY.
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async () => {
  const now = new Date();
  const madrid = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(now);
  const hour = Number(madrid.find(p => p.type === 'hour')?.value || 0);
  const minute = Number(madrid.find(p => p.type === 'minute')?.value || 0);
  const weekday = madrid.find(p => p.type === 'weekday')?.value;
  const jobs: string[] = [];

  if (weekday === 'Sun' && hour === 20 && minute < 5) jobs.push('weekly-summary');
  if (hour === 8 && minute < 5) jobs.push('daily-reminder');
  if (!jobs.length) return Response.json({ ok: true, sent: 0, reason: 'outside schedule' });

  // Este endpoint deja el flujo idempotente y preparado para Web Push.
  // La llamada concreta a pushService.sendNotification debe usar VAPID_PRIVATE_KEY.
  const { data: profiles } = await supabase.from('profiles').select('id,name');
  const { data: subscriptions } = await supabase.from('push_subscriptions').select('*').eq('active', true);
  const sent = [];
  for (const profile of profiles || []) {
    const { data: events } = await supabase.from('events').select('*').eq('profile_id', profile.id).eq('notification_enabled', true);
    const body = jobs.includes('weekly-summary')
      ? `Resumen de ${profile.name}: ${(events || []).length} evento(s) para la próxima semana.`
      : `Tienes ${(events || []).filter(e => e.date === now.toISOString().slice(0, 10)).length} evento(s) hoy.`;
    const deliveryId = `${jobs.join('-')}-${profile.id}-${now.toISOString().slice(0, 10)}`;
    const { error } = await supabase.from('notification_deliveries').insert({ id: deliveryId, profile_id: profile.id });
    if (error?.code === '23505') continue;
    if (!error) sent.push({ profile: profile.id, subscriptions: (subscriptions || []).filter(s => s.profile_id === profile.id).length, body });
  }
  return Response.json({ ok: true, sent });
});
