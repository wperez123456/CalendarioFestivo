import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.0.0';

// Ejecutar con Supabase Cron cada 5 minutos. Las horas se evalúan en Europe/Madrid.
// La entrega Web Push debe conectarse aquí con una librería VAPID y el secreto VAPID_PRIVATE_KEY.
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails('mailto:wperez123456@users.noreply.github.com', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

Deno.serve(async () => {
  const now = new Date();
  const madrid = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const hour = Number(madrid.find(p => p.type === 'hour')?.value || 0);
  const minute = Number(madrid.find(p => p.type === 'minute')?.value || 0);
  const weekday = madrid.find(p => p.type === 'weekday')?.value;
  const today = `${madrid.find(p => p.type === 'year')?.value}-${madrid.find(p => p.type === 'month')?.value}-${madrid.find(p => p.type === 'day')?.value}`;
  const jobs: string[] = [];

  if (weekday === 'Sun' && hour === 20 && minute < 5) jobs.push('weekly-summary');
  if (hour === 8 && minute < 5) jobs.push('daily-reminder');
  if (!jobs.length) return Response.json({ ok: true, sent: 0, reason: 'outside schedule' });

  const { data: profiles } = await supabase.from('profiles').select('id,name');
  const { data: subscriptions } = await supabase.from('push_subscriptions').select('*').eq('active', true);
  const sent = [];
  for (const profile of profiles || []) {
    const { data: events } = await supabase.from('events').select('*').eq('profile_id', profile.id).eq('notification_enabled', true);
    const relevant = jobs.includes('weekly-summary') ? (events || []).filter(e => e.date >= today && e.date <= addDays(today, 7)) : (events || []).filter(e => e.date === today);
    if (!relevant.length) continue;
    const body = jobs.includes('weekly-summary') ? `Resumen de ${profile.name}: ${relevant.length} evento(s) para la próxima semana.` : `Tienes ${relevant.length} evento(s) hoy.`;
    const deliveryId = `${jobs.join('-')}-${profile.id}-${now.toISOString().slice(0, 10)}`;
    const { error } = await supabase.from('notification_deliveries').insert({ id: deliveryId, profile_id: profile.id });
    if (error?.code === '23505') continue;
    if (!error) {
      for (const subscription of (subscriptions || []).filter(s => s.profile_id === profile.id)) {
        try { await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title: 'Calendario/Clima', body, url: './' })); }
        catch (pushError) { if ([404, 410].includes(pushError.statusCode)) await supabase.from('push_subscriptions').update({ active: false }).eq('id', subscription.id); }
      }
      sent.push({ profile: profile.id, subscriptions: (subscriptions || []).filter(s => s.profile_id === profile.id).length, body });
    }
  }
  return Response.json({ ok: true, sent });
});

function addDays(dateText: string, days: number) { const date = new Date(`${dateText}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
