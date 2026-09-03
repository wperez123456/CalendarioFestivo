(() => {
  const PROFILE_KEY = 'calendario-perfil';
  const EVENTS_KEY = 'calendario-eventos-v1';
  const profiles = { erica: 'Erica', wilmer: 'Wilmer' };
  let activeProfile = localStorage.getItem(PROFILE_KEY) || 'erica';
  let selectedDate = null;
  let editingId = null;
  let events = readLocalEvents();
  let cloud = null;

  function readLocalEvents() {
    try { return JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]'); }
    catch { return []; }
  }
  function persistLocal() { localStorage.setItem(EVENTS_KEY, JSON.stringify(events)); }
  function configuredCloud() {
    return window.SUPABASE_CONFIG?.url && window.SUPABASE_CONFIG?.anonKey && window.supabase?.createClient;
  }
  async function loadEvents() {
    if (configuredCloud()) {
      cloud ||= window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);
      const { data, error } = await cloud.from('events').select('*').order('date').order('start_time');
      if (!error && data) events = data;
      else if (error) console.warn('No se pudieron cargar eventos remotos:', error.message);
    }
    decorateCalendar();
    renderWeeklySummary();
  }
  async function saveEvent(eventData) {
    const index = events.findIndex(e => e.id === eventData.id);
    if (index >= 0) events[index] = eventData; else events.push(eventData);
    persistLocal();
    if (cloud) {
      const { error } = await cloud.from('events').upsert(eventData);
      if (error) throw error;
    }
    decorateCalendar();
    renderWeeklySummary();
  }
  async function removeEvent(id) {
    events = events.filter(e => e.id !== id); persistLocal();
    if (cloud) { const { error } = await cloud.from('events').delete().eq('id', id); if (error) throw error; }
    decorateCalendar();
    renderWeeklySummary();
  }
  function profileEvents(date) { return events.filter(e => e.profile_id === activeProfile && e.date === date).sort((a,b) => (a.start_time || '').localeCompare(b.start_time || '')); }
  function decorateCalendar() {
    document.querySelectorAll('.day-cell').forEach(cell => {
      const weather = cell.querySelector('.cell-weather'); const date = weather?.id?.slice(2);
      if (!date) return;
      cell.querySelector('.event-badge')?.remove();
      const count = profileEvents(date).length;
      if (count) { const badge = document.createElement('span'); badge.className = 'event-badge'; badge.textContent = `📅 ${count}`; badge.title = `${count} evento${count > 1 ? 's' : ''}`; cell.appendChild(badge); }
    });
  }
  function renderEventList() {
    const list = document.getElementById('eventList'); if (!list) return;
    const items = profileEvents(selectedDate);
    list.innerHTML = items.length ? `<h3>Eventos de ${profiles[activeProfile]}</h3>` : '<p class="no-events">No hay eventos para este día.</p>';
    items.forEach(event => {
      const row = document.createElement('div'); row.className = 'event-row';
      row.innerHTML = `<div><strong>${escapeHtml(event.title)}</strong><small>${event.all_day ? 'Todo el día' : `${event.start_time || ''}${event.end_time ? ` – ${event.end_time}` : ''}`}</small>${event.description ? `<p>${escapeHtml(event.description)}</p>` : ''}</div>`;
      const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Editar'; edit.onclick = () => openEventForm(event);
      const del = document.createElement('button'); del.type = 'button'; del.textContent = 'Borrar'; del.onclick = async () => { if (confirm('¿Borrar este evento?')) { await removeEvent(event.id); renderEventList(); } };
      row.append(edit, del); list.appendChild(row);
    });
  }
  function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function displayTime(value) {
    if (!value) return 'Sin hora';
    const [hour, minute] = String(value).slice(0, 5).split(':').map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 'Sin hora';
    return new Intl.DateTimeFormat('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(2000, 0, 1, hour, minute));
  }
  function renderWeeklySummary() {
    const list = document.getElementById('weeklySummaryList');
    const profileLabel = document.getElementById('weeklySummaryProfile');
    if (!list) return;
    const now = new Date();
    const monday = new Date(now); const day = monday.getDay() || 7;
    monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - day + 1);
    const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6); sunday.setHours(23, 59, 59, 999);
    const items = events.filter(event => event.profile_id === activeProfile && event.date >= toDateKey(monday) && event.date <= toDateKey(sunday)).sort((a, b) => `${a.date}${a.start_time || ''}`.localeCompare(`${b.date}${b.start_time || ''}`));
    if (profileLabel) profileLabel.textContent = profiles[activeProfile];
    list.innerHTML = items.length ? items.map(event => `<div class="weekly-event"><strong>${formatShortDate(event.date)}</strong><span>${escapeHtml(event.title)}</span></div>`).join('') : '<p class="weekly-empty">No hay eventos programados para esta semana.</p>';
  }
  function toDateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  function formatShortDate(dateKey) { return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${dateKey}T12:00:00`)); }
  function openEventForm(event = null) {
    editingId = event?.id || null;
    const form = document.getElementById('eventForm'); form.hidden = false;
    document.getElementById('eventFormTitle').textContent = event ? 'Editar evento' : 'Nuevo evento';
    document.getElementById('eventTitle').value = event?.title || '';
    document.getElementById('eventDescription').value = event?.description || '';
    document.getElementById('eventStart').value = event?.start_time || '';
    document.getElementById('eventEnd').value = event?.end_time || '';
    document.getElementById('eventNotificationTime').value = event?.notification_time || '08:00';
    document.getElementById('eventAllDay').checked = !!event?.all_day;
    document.getElementById('eventNotify').checked = event?.notification_enabled !== false;
    updateTimeReadouts();
    document.getElementById('eventTitle').focus();
  }
  function closeEventForm() { document.getElementById('eventForm').hidden = true; editingId = null; }
  async function submitEvent(e) {
    e.preventDefault();
    const item = { id: editingId || crypto.randomUUID(), profile_id: activeProfile, date: selectedDate, title: document.getElementById('eventTitle').value.trim(), description: document.getElementById('eventDescription').value.trim(), start_time: document.getElementById('eventStart').value || null, end_time: document.getElementById('eventEnd').value || null, all_day: document.getElementById('eventAllDay').checked, notification_enabled: document.getElementById('eventNotify').checked, notification_time: document.getElementById('eventNotificationTime').value || '08:00', updated_at: new Date().toISOString() };
    if (!item.title) return;
    try { await saveEvent(item); closeEventForm(); renderEventList(); } catch (error) { showStatus(`No se pudo guardar en la nube: ${error.message}`); }
  }
  function updateTimeReadouts() {
    document.getElementById('eventStartDisplay').textContent = displayTime(document.getElementById('eventStart').value);
    document.getElementById('eventEndDisplay').textContent = displayTime(document.getElementById('eventEnd').value);
  }
  async function enableNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return showStatus('Este navegador no admite notificaciones para esta aplicación.');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const registration = await navigator.serviceWorker.register('service-worker.js?v=20260903');
      if (!window.SUPABASE_CONFIG?.vapidPublicKey) return showStatus('Falta configurar la clave pública VAPID.');
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(window.SUPABASE_CONFIG.vapidPublicKey) });
      if (!cloud) await loadEvents();
      if (cloud) {
        const json = subscription.toJSON();
        const { error } = await cloud.from('push_subscriptions').upsert({ profile_id: activeProfile, endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, active: true }, { onConflict: 'endpoint' });
        if (error) throw error;
      }
      document.getElementById('notifyButton').textContent = 'Avisos activados';
      showStatus(cloud ? 'Este dispositivo ya está registrado para recibir avisos.' : 'Avisos preparados en este dispositivo.');
    }
    else showStatus('Permiso de notificaciones no concedido.');
  }
  function urlBase64ToUint8Array(value) { const padding = '='.repeat((4 - value.length % 4) % 4); const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map(c => c.charCodeAt(0))); }
  function showStatus(message) { if (window.showStatus) window.showStatus(message); else alert(message); }
  function start() {
    const select = document.getElementById('profileSelect'); select.value = activeProfile; select.onchange = async () => { activeProfile = select.value; localStorage.setItem(PROFILE_KEY, activeProfile); renderCalendar(); await loadEvents(); };
    document.getElementById('addEventButton').onclick = () => openEventForm();
    document.getElementById('cancelEventButton').onclick = closeEventForm;
    document.getElementById('eventForm').onsubmit = submitEvent;
    document.getElementById('eventStart').addEventListener('input', updateTimeReadouts);
    document.getElementById('eventEnd').addEventListener('input', updateTimeReadouts);
    document.getElementById('notifyButton').onclick = enableNotifications;
    const originalShow = window.showDetails;
    window.showDetails = async (date, day) => { selectedDate = date; originalShow(date, day); renderEventList(); };
    const originalRender = window.renderCalendar;
    window.renderCalendar = () => { originalRender(); decorateCalendar(); renderWeeklySummary(); };
    const originalClose = window.closeModal;
    window.closeModal = () => { closeEventForm(); originalClose(); };
    loadEvents();
  }
  window.addEventListener('load', start, { once: true });
})();
