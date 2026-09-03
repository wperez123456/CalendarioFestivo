// Configuración
const LAT = 43.296; // Barakaldo
const LON = -2.986;
let currentDate = new Date(); 
let weatherCache = {}; 
let holidaysData = {}; // Se llenará desde el JSON
let isLoading = false;

const months = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

// --- Inicialización ---
async function init() {
    if (isLoading) return;
    isLoading = true;
    await loadHolidays(); // Cargar festivos primero
    
    // Configurar fecha inicial
    document.getElementById('yearSelect').value = String(currentDate.getFullYear());
    
    renderCalendar();
    await loadWeather();
    isLoading = false;
}

// Cargar archivo JSON
async function loadHolidays() {
    try {
        const response = await fetch(`holidays.json?v=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error("No se pudo cargar holidays.json");
        holidaysData = await response.json();
    } catch (error) {
        console.error("Error cargando festivos:", error);
        // Fallback vacío si falla la carga
        holidaysData = {};
        showStatus('No se pudieron cargar los festivos. Revisa la conexión y vuelve a abrir la página.');
    }
}

// --- Renderizado Calendario ---
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    document.getElementById('monthDisplay').innerText = `${months[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    let padding = firstDay.getDay() - 1;
    if(padding === -1) padding = 6;

    const grid = document.getElementById('calendar');
    grid.innerHTML = '';

    // Días vacíos al inicio
    for(let i=0; i<padding; i++) grid.appendChild(document.createElement('div'));

    const today = new Date();

    for(let i=1; i<=daysInMonth; i++) {
        const dateKey = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        
        let holidayMarkup = '';
        
        // ** NUEVO: Determinar el día de la semana (0=Dom, 6=Sáb) **
        const currentDayOfWeek = new Date(year, month, i).getDay();

        let isHoliday = holidaysData[dateKey];
        
        // 1. Lógica del Fin de Semana (ANTES de festivos para que el festivo lo pise si cae en fin de semana)
        if (!isHoliday && (currentDayOfWeek === 0 || currentDayOfWeek === 6)) {
            cell.classList.add('weekend');
        }

        if(isHoliday) { // Usamos la bandera
            const h = holidaysData[dateKey];
            let colorClass = h.type === 'nac' ? 'tag-nac' : (h.type === 'aut' ? 'tag-aut' : 'tag-loc');
            
            // Este color en línea siempre tendrá prioridad, asegurando que el festivo domine.
            cell.style.backgroundColor = h.type === 'nac' ? '#fff5f5' : (h.type === 'aut' ? '#f1f8e9' : '#e3f2fd');
            holidayMarkup = `<div class="tag ${colorClass}" style="font-size: 1.5em;">🏖️</div>`;
        }

        

        if(i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            cell.classList.add('today');
        }

        cell.innerHTML = `
            <div style="display:flex; justify-content:space-between; width:100%">
                    <div class="day-number">${i}</div>
                    ${holidayMarkup}
                </div>
            <div class="cell-weather" id="w-${dateKey}"></div>
        `;
        
        cell.onclick = () => showDetails(dateKey, i);
        grid.appendChild(cell);
    }
}

// --- Carga Clima (Open-Meteo) ---
async function loadWeather() {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,precipitation_sum&timezone=Europe%2FMadrid`;
    const airUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&hourly=european_aqi&timezone=Europe%2FMadrid`;

    try {
        weatherCache = {};
        const [resW, resA] = await Promise.all([
            fetch(`${url}&_=${Date.now()}`, { cache: 'no-store' }),
            fetch(`${airUrl}&_=${Date.now()}`, { cache: 'no-store' })
        ]);
        if (!resW.ok || !resA.ok) throw new Error('El servicio meteorológico no está disponible');
        const dataW = await resW.json();
        const dataA = await resA.json();

        if(dataW.daily) {
            dataW.daily.time.forEach((dateStr, idx) => {
                let aqiAvg = 0;
                if(dataA.hourly) {
                    const slice = dataA.hourly.european_aqi.slice(idx*24, (idx*24)+24);
                    if(slice.length) aqiAvg = slice.reduce((a,b)=>a+b,0) / slice.length;
                }

                weatherCache[dateStr] = {
                    code: dataW.daily.weather_code[idx],
                    max: dataW.daily.temperature_2m_max[idx],
                    min: dataW.daily.temperature_2m_min[idx],
                    wind: dataW.daily.wind_speed_10m_max[idx],
                    precip: dataW.daily.precipitation_sum[idx], 
                    aqi: Math.round(aqiAvg)
                };

                const el = document.getElementById(`w-${dateStr}`);
                // Solo pintar icono de clima si NO es festivo
                if(el && !holidaysData[dateStr]) {
                    el.innerText = getWeatherIcon(dataW.daily.weather_code[idx]);
                }
            });
        }
    } catch (e) {
        console.warn("Error cargando clima", e);
        showStatus('El calendario está disponible, pero el clima no pudo actualizarse ahora.');
    }
}

function showStatus(message) {
    let status = document.getElementById('appStatus');
    if (!status) {
        status = document.createElement('div');
        status.id = 'appStatus';
        status.setAttribute('role', 'status');
        document.body.appendChild(status);
    }
    status.textContent = message;
    window.clearTimeout(showStatus.timer);
    showStatus.timer = window.setTimeout(() => status.remove(), 5000);
}

// --- Ayudantes Clima ---
function getWeatherDescription(code, precip) {
    if(code === 0) return 'Totalmente Despejado'; 
    if(code === 1) return 'Parcialmente Soleado';
    if(code <= 3) return 'Mayormente Nublado'; 
    if(code <= 48) return 'Niebla o Bruma';
    if(code >= 51 && code <= 60) return precip > 5.0 ? 'Lluvias Moderadas' : 'Llovizna Ligera';
    if(code >= 61 && code <= 67) return precip > 10.0 ? 'Lluvias Fuertes' : 'Lluvias Moderadas';
    if(code >= 71 && code <= 77) return 'Nieve';
    if(code >= 80 && code <= 82) return 'Chubascos Intensos';
    if(code >= 95) return 'Tormenta Eléctrica Fuerte';
    return 'Clima Desconocido';
}

function getWeatherIcon(code) {
    if(code === 0) return '☀️';
    if(code < 3) return '⛅';
    if(code < 50) return '☁️';
    if(code < 60) return '🌦️';
    if(code < 67) return '🌧️';
    if(code < 80) return '🌨️';
    return '⛈️';
}

function getAQIText(v) {
    if(v < 20) return "🔵 Bueno";
    if(v < 40) return "🟢 Normal";
    if(v < 60) return "🟠 Regular";
    return "🔴 Malo";
}

function applyFunnyAnimation(visualEl, data) {
    visualEl.className = 'funny-visual'; 
    let icon = getWeatherIcon(data.code);
    let animationClass = '';

    if(data.code >= 95) { icon = '⚡'; animationClass = 'anim-storm'; } 
    else if(data.wind > 40) { icon = '🌬️'; animationClass = 'anim-wind'; }
    else if(data.precip > 5.0) { icon = '☔🌧️🌧️'; animationClass = 'anim-rain-heavy'; } 
    else if(data.precip > 0.5) { icon = '☔🌦️'; animationClass = 'anim-rain-light'; } 
    else if(data.code <= 1) { icon = '🔆'; animationClass = 'anim-sun'; }
    else if(data.max > 30) { icon = '🥵'; } 
    else if(data.max < 5) { icon = '🥶'; }

    visualEl.innerText = icon;
    if(animationClass) visualEl.classList.add(animationClass);
}

// --- Lógica de Interfaz ---
function showDetails(dateStr, day) {
    const modal = document.getElementById('detailModal');
    const data = weatherCache[dateStr];
    const h = holidaysData[dateStr]; // Usar variable dinámica

    const dateObj = new Date(`${dateStr}T12:00:00`);
    document.getElementById('mDate').innerText = dateObj.toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'long'});
    document.getElementById('btnGoogle').href = `https://www.google.com/search?q=clima+barakaldo+${dateStr}`;
    
    const box = document.getElementById('mHolidayBox');
    if(h) {
        box.style.display = 'block';
        let city = h.desc.includes('(Barakaldo)') ? 'Barakaldo' : (h.desc.includes('(Bilbao)') ? 'Bilbao' : 'Nacional');
        let typeText = h.type === 'nac' ? 'Nacional' : `Local de ${city}`;
        document.getElementById('mHolidayText').innerText = `🎉 Día Festivo (${typeText}): ${h.desc}`;
    } else {
        box.style.display = 'none';
    }

    const visual = document.getElementById('mFunnyVisual');
    
    if(data) {
        document.getElementById('mTemp').innerText = `${Math.round(data.max)}°C / ${Math.round(data.min)}°C`;
        document.getElementById('mWind').innerText = `${data.wind} km/h`;
        document.getElementById('mAir').innerText = getAQIText(data.aqi);
        document.getElementById('mWeatherDesc').innerText = getWeatherDescription(data.code, data.precip);
        applyFunnyAnimation(visual, data);
    } else {
        document.getElementById('mTemp').innerText = "--";
        document.getElementById('mWind').innerText = "--";
        document.getElementById('mAir').innerText = "--";
        document.getElementById('mWeatherDesc').innerText = "Sin Pronóstico (Futuro Lejano)";
        visual.innerText = "🔮"; 
        visual.className = 'funny-visual';
    }
    modal.classList.add('active');
}

function closeModal() { document.getElementById('detailModal').classList.remove('active'); }
function changeMonth(d) { currentDate.setMonth(currentDate.getMonth() + d); init(); }
function changeYear() { currentDate.setFullYear(Number(document.getElementById('yearSelect').value)); init(); }

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') init();
});

// Si el navegador restaura la página desde su caché de navegación, recárgala una vez.
window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
});

// Arrancar
init();
