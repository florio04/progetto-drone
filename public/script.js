const map = L.map('map', { 
    zoomControl: false,
    attributionControl: false, 
    minZoom: 13                
}).setView([45.3875, 11.0040], 16);

// Layer Satellitare (foto dall'alto)
const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19
}).addTo(map);

// Layer Etichette (nomi delle vie)
const labelsLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
    pane: 'shadowPane',
    maxZoom: 19
}).addTo(map);


const sidebar = new bootstrap.Offcanvas(document.getElementById('offcanvasDetails'));
const imageModal = new bootstrap.Modal(document.getElementById('imageModal'));

let currentPointFeatures = []; // Qui si salvano tutte le letture del punto cliccato
let currentCoords = [];      // Coordinate del punto attivo

// Aggancio i filtri della sidebar
const filters = {
    dS: document.getElementById('f-date-start'),
    dE: document.getElementById('f-date-end'),
    tS: document.getElementById('f-time-start'),
    tE: document.getElementById('f-time-end')
};



// ingrandire la foto della pianta nella Modal
window.ingrandisciImmagine = (url) => {
    document.getElementById('modalImg').src = url;
    imageModal.show();
};

// Torna alla lista dei log (quando clicchi "Indietro")
window.showListView = () => {
    document.getElementById('sidebar-view-detail').classList.add('d-none');
    document.getElementById('sidebar-view-list').classList.remove('d-none');
};

// Mostra i dettagli di una singola misurazione specifica
window.showDetailView = (idx) => {
    const p = currentPointFeatures[idx].properties;
    document.getElementById('sidebar-view-list').classList.add('d-none');
    document.getElementById('sidebar-view-detail').classList.remove('d-none');
    
    // Inietto l'HTML con i dati (Temp, Data, Ora e GPS)
    document.getElementById('detail-content').innerHTML = `
        <div class="img-container mb-4" onclick="window.ingrandisciImmagine('${p.zona_foto_url}')">
            <img src="${p.zona_foto_url}" class="img-fluid" style="height:250px; width:100%; object-fit:cover;">
        </div>
        <div class="text-center mb-4">
            <small class="filter-label">Temperatura Aria</small>
            <div class="temp-display">${p.temperatura}°C</div>
            <div class="badge bg-primary">${p.data_misurazione}</div>
            <div class="badge bg-secondary">${p.ora_misurazione.substring(0,5)}</div>
        </div>
        <div class="gps-card">
            <small class="filter-label mb-2 d-block">Coordinate GPS</small>
            <div class="row text-center font-monospace small">
                <div class="col-6 border-end"><strong>LAT:</strong> ${currentCoords[1].toFixed(6)}</div>
                <div class="col-6"><strong>LNG:</strong> ${currentCoords[0].toFixed(6)}</div>
            </div>
        </div>`;
};

/**
 * Questa funzione svuota e rifà la lista nella sidebar ogni volta che viene cambiata data o ora.
 */
const drawList = (features) => {
    const container = document.getElementById('list-container');
    container.innerHTML = '';
    
    // Se il campo è vuoto passa sempre, se c'è un valore controlla se è nel range
    const filtered = features.filter(item => {
        const p = item.properties;
        const ora = p.ora_misurazione.substring(0,5);
        const matchD = (!filters.dS.value || p.data_misurazione >= filters.dS.value) && 
                       (!filters.dE.value || p.data_misurazione <= filters.dE.value);
        const matchT = (!filters.tS.value || ora >= filters.tS.value) && 
                       (!filters.tE.value || ora <= filters.tE.value);
        return matchD && matchT;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p class="p-4 text-center text-muted">Nessun record trovato</p>';
        return;
    }

    // Genero i bottoni della lista per ogni misurazione trovata
    filtered.forEach(item => {
        const idx = currentPointFeatures.indexOf(item);
        const p = item.properties;
        container.innerHTML += `
            <button class="list-group-item list-group-item-action" onclick="showDetailView(${idx})">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <div class="fw-bold">${p.data_misurazione}</div>
                        <small class="text-muted">${p.ora_misurazione.substring(0,5)}</small>
                    </div>
                    <span class="badge bg-danger rounded-pill">${p.temperatura}°C</span>
                </div>
            </button>`;
    });
};

// Event listener: quando tocchi un filtro, ricalcola la lista
[filters.dS, filters.dE, filters.tS, filters.tE].forEach(el => 
    el.addEventListener('change', () => drawList(currentPointFeatures))
);

async function init() {
    const res = await fetch('http://localhost:3000/api/punti');
    const data = await res.json();
    const groups = {};

    // Raggruppamento: vengono usate le coordinate come "chiave" dell'oggetto
    data.features.forEach(f => {
        const k = f.geometry.coordinates.join(',');
        if (!groups[k]) groups[k] = [];
        groups[k].push(f);
    });

    // Creazione dei marker (uno per ogni gruppo di coordinate)
    L.geoJSON({ type: 'FeatureCollection', features: Object.values(groups).map(g => g[0]) }, {
        onEachFeature: (feature, layer) => {
            layer.on('click', () => {
                const k = feature.geometry.coordinates.join(',');
                currentPointFeatures = groups[k]; // Caricamento dello storico di quel punto
                currentCoords = feature.geometry.coordinates;
                showListView();
                drawList(currentPointFeatures);
                sidebar.show();
            });
        }
    }).addTo(map);
}

init();