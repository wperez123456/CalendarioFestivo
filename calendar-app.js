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
  }
  async function removeEvent(id) {
    events = events.filter(e => e.id !== id); persistLocal();
    if (cloud) { const { error } = await cloud.from('events').delete().eq('id', id); if (error) throw error; }
    decorateCalendar();
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
  function openEventForm(event = null) {
    editingId = event?.id || null;
    const form = document.getElementById('eventForm'); form.hidden = false;
    document.getElementById('eventFormTitle').textContent = event ? 'Editar evento' : 'Nuevo evento';
    document.getElementById('eventTitle').value = event?.title || '';
    document.getElementById('eventDescription').value = event?.description || '';
    document.getElementById('eventStart').value = event?.start_time || '';
    document.getElementById('eventEnd').value = event?.end_time || '';
    document.getElementById('eventAllDay').checked = !!event?.all_day;
    document.getElementById('eventNotify').checked = event?.notification_enabled !== false;
    document.getElementById('eventTitle').focus();
  }
  function closeEventForm() { document.getElementById('eventForm').hidden = true; editingId = null; }
  async function submitEvent(e) {
    e.preventDefault();
    const item = { id: editingId || crypto.randomUUID(), profile_id: activeProfile, date: selectedDate, title: document.getElementById('eventTitle').value.trim(), description: document.getElementById('eventDescription').value.trim(), start_time: document.getElementById('eventStart').value || null, end_time: document.getElementById('eventEnd').value || null, all_day: document.getElementById('eventAllDay').checked, notification_enabled: document.getElementById('eventNotify').checked, updated_at: new Date().toISOString() };
    if (!item.title) return;
    try { await saveEvent(item); closeEventForm(); renderEventList(); } catch (error) { showStatus(`No se pudo guardar en la nube: ${error.message}`); }
  }
  async function enableNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return showStatus('Este navegador no admite notificaciones para esta aplicación.');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') { await navigator.serviceWorker.register('service-worker.js?v=20260903'); document.getElementById('notifyButton').textContent = 'Avisos activados'; }
    else showStatus('Permiso de notificaciones no concedido.');
  }
  function showStatus(message) { if (window.showStatus) window.showStatus(message); else alert(message); }
  function start() {
    const select = document.getElementById('profileSelect'); select.value = activeProfile; select.onchange = async () => { activeProfile = select.value; localStorage.setItem(PROFILE_KEY, activeProfile); renderCalendar(); await loadEvents(); };
    document.getElementById('addEventButton').onclick = () => openEventForm();
    document.getElementById('cancelEventButton').onclick = closeEventForm;
    document.getElementById('eventForm').onsubmit = submitEvent;
    document.getElementById('notifyButton').onclick = enableNotifications;
    const originalShow = window.showDetails;
    window.showDetails = async (date, day) => { selectedDate = date; originalShow(date, day); renderEventList(); };
    const originalRender = window.renderCalendar;
    window.renderCalendar = () => { originalRender(); decorateCalendar(); };
    const originalClose = window.closeModal;
    window.closeModal = () => { closeEventForm(); originalClose(); };
    loadEvents();
  }
  window.addEventListener('load', start, { once: true });
})();
