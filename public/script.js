/**
 * =========================================================================
 * CONFIGURAZIONE E VARIABILI GLOBALI
 * =========================================================================
 */
// Decidi qui la precisione fissa del Geohash (es: 5 = ±5km, 7 = ±150m, 9 = ±4.7m)
const GEOHASH_PRECISION = 6; 

const map = L.map('map', { 
    zoomControl: true, 
    minZoom: 2                
}).setView([45.3875, 11.0040], 16);

// Layer Satellitare
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19
}).addTo(map);

// Layer Etichette
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
    pane: 'shadowPane',
    maxZoom: 19
}).addTo(map);

// Componenti UI Bootstrap
const sidebar = new bootstrap.Offcanvas(document.getElementById('offcanvasDetails'));
const imageModal = new bootstrap.Modal(document.getElementById('imageModal'));

let rawFeatures = [];           
let currentLayerGroup = L.layerGroup().addTo(map); 
let currentPointFeatures = [];  

const filters = {
    dS: document.getElementById('f-date-start'),
    dE: document.getElementById('f-date-end'),
    tS: document.getElementById('f-time-start'),
    tE: document.getElementById('f-time-end')
};

/**
 * =========================================================================
 * LOGICA DI CLUSTERING CON BARICENTRO TRIDIMENSIONALE (3D VECTOR MIDPOINT)
 * =========================================================================
 */
function groupDataByPrecision(features, precisionLevel) {
    const groups = {};

    features.forEach(f => {
        const props = f.properties;
        const clusterHash = props.geohash ? props.geohash.substring(0, precisionLevel) : f.geometry.coordinates.join(',');

        if (!groups[clusterHash]) {
            groups[clusterHash] = {
                xSum: 0,         
                ySum: 0,         
                zSum: 0,         
                allFeatures: [], 
                temperatures: [],
                photos: [],
                count: 0
            };
        }

        const lon = f.geometry.coordinates[0];
        const lat = f.geometry.coordinates[1];

        // Convertiamo in Radianti
        const latRad = lat * Math.PI / 180;
        const lonRad = lon * Math.PI / 180;

        // Convertiamo in vettori cartesiani 3D
        groups[clusterHash].xSum += Math.cos(latRad) * Math.cos(lonRad);
        groups[clusterHash].ySum += Math.cos(latRad) * Math.sin(lonRad);
        groups[clusterHash].zSum += Math.sin(latRad);
        
        groups[clusterHash].allFeatures.push(f);
        groups[clusterHash].temperatures.push(Number(props.temperatura));
        groups[clusterHash].count++;
        
        if (props.zona_foto_url) {
            groups[clusterHash].photos.push(props.zona_foto_url);
        }
    });

    // Riconvertiamo i vettori medi in coordinate geografiche reali
    return Object.values(groups).map(cluster => {
        const x = cluster.xSum / cluster.count;
        const y = cluster.ySum / cluster.count;
        const z = cluster.zSum / cluster.count;

        const lonRad = Math.atan2(y, x);
        const hypotenuse = Math.sqrt(x * x + y * y);
        const latRad = Math.atan2(z, hypotenuse);

        cluster.lat = latRad * 180 / Math.PI;
        cluster.lon = lonRad * 180 / Math.PI;

        const sumTemp = cluster.temperatures.reduce((a, b) => a + b, 0);
        cluster.avgTemp = (sumTemp / cluster.count).toFixed(1);
        
        return cluster;
    });
}

/**
 * DISEGNO DEI MARKER SULLA MAPPA
 */
function updateMap() {
    currentLayerGroup.clearLayers();
    
    const clusters = groupDataByPrecision(rawFeatures, GEOHASH_PRECISION);

    clusters.forEach(cluster => {
        // Ripristinato il marker classico di Leaflet (goccia blu predefinita) sul baricentro
        const marker = L.marker([cluster.lat, cluster.lon]);

        marker.on('click', () => {
            currentPointFeatures = cluster.allFeatures; 
            drawGroupedSidebar(cluster);
            sidebar.show();
        });

        currentLayerGroup.addLayer(marker);
    });
}

/**
 * =========================================================================
 * LOGICA SIDEBAR & GALLERIA IMMAGINI
 * =========================================================================
 */
function drawGroupedSidebar(cluster) {
    document.getElementById('sidebar-view-detail').classList.add('d-none');
    document.getElementById('sidebar-view-list').classList.remove('d-none');
    
    const container = document.getElementById('list-container');
    container.innerHTML = '';

   const summaryHtml = `
        <div class="card mb-4 border-0 shadow-sm overflow-hidden">
            <div class="card-body text-center bg-primary text-white p-4">
                <h6 class="text-uppercase mb-2" style="letter-spacing:1px; font-size:12px;">Media Area Raggruppata</h6>
                <h2 class="display-4 fw-bold mb-0">${cluster.avgTemp}°C</h2>
            </div>
        </div>
        <h6 class="fw-bold mb-3"><i class="bi bi-images me-2"></i>Galleria Immagini dell'Area</h6>
        <div class="row g-2 mb-4" id="gallery-container"></div>
        <h6 class="fw-bold mb-3 border-top pt-3"><i class="bi bi-list-ul me-2"></i>Storico Rilevamenti</h6>
    `;
    container.innerHTML = summaryHtml;

    const gallery = container.querySelector('#gallery-container');
    const uniquePhotos = [...new Set(cluster.photos)]; 
    
    if(uniquePhotos.length > 0) {
        uniquePhotos.forEach(url => {
            const col = document.createElement('div');
            // MODIFICATO: da 'col-4' a 'col-3' per mostrare 4 foto per riga sfruttando il nuovo spazio
            col.className = 'col-3'; 
            col.innerHTML = `
                <div class="gallery-img-container">
                    <img src="${url}" class="img-fluid" 
                         style="height:75px; width:100%; object-fit:cover; cursor:pointer;" 
                         onclick="window.ingrandisciImmagine('${url}')">
                </div>`;
            gallery.appendChild(col);
        });
    } else {
        gallery.innerHTML = '<div class="col-12"><p class="small text-muted italic ps-1">Nessun media fotografico salvato.</p></div>';
    }

    drawList(cluster.allFeatures);
}

/**
 * LOGICA FILTRAGGIO DELLE SINGOLE LETTURE
 */
const drawList = (features) => {
    let logList = document.getElementById('log-list-subcontainer');
    if(!logList) {
        logList = document.createElement('div');
        logList.id = 'log-list-subcontainer';
        logList.className = 'list-group list-group-flush';
        document.getElementById('list-container').appendChild(logList);
    }
    logList.innerHTML = '';
    
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
        logList.innerHTML = '<p class="p-3 text-center text-muted small">Nessun log corrispondente ai filtri</p>';
        return;
    }

    filtered.forEach(item => {
        const p = item.properties;
        const btn = document.createElement('button');
        btn.className = 'list-group-item list-group-item-action border-0 px-0 py-3 border-bottom';
        btn.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="fw-bold" style="font-size:14px;">${p.data_misurazione}</div>
                    <small class="text-muted">${p.ora_misurazione.substring(0,5)}</small>
                </div>
                <span class="badge bg-danger rounded-pill">${p.temperatura}°C</span>
            </div>
        `;
        btn.onclick = () => showDetailView(item);
        logList.appendChild(btn);
    });
};

/**
 * SCHERMATA DI DETTAGLIO DELLA SINGOLA LETTURA SELEZIONATA
 */
window.showDetailView = (item) => {
    const p = item.properties;
    const coords = item.geometry.coordinates;
    document.getElementById('sidebar-view-list').classList.add('d-none');
    document.getElementById('sidebar-view-detail').classList.remove('d-none');
    
    document.getElementById('detail-content').innerHTML = `
        <div class="rounded shadow-sm overflow-hidden mb-4" onclick="window.ingrandisciImmagine('${p.zona_foto_url}')" style="cursor:zoom-in;">
            <img src="${p.zona_foto_url}" class="img-fluid" style="height:220px; width:100%; object-fit:cover;">
        </div>
        <div class="text-center mb-4">
            <h1 class="display-4 fw-bold text-danger mb-0">${p.temperatura}°C</h1>
            <p class="text-muted text-uppercase small">Misurazione Singola</p>
            <div class="d-flex justify-content-center gap-2">
                <span class="badge bg-light text-dark border">${p.data_misurazione}</span>
                <span class="badge bg-light text-dark border">${p.ora_misurazione.substring(0,5)}</span>
            </div>
        </div>
        <div class="bg-light p-3 rounded text-center" style="font-size:12px;">
            <div class="text-muted mb-2 text-uppercase fw-bold" style="font-size:10px;">Coordinate GPS Reali</div>
            <div class="row">
                <div class="col-6 border-end"><strong>LAT:</strong> ${coords[1].toFixed(6)}</div>
                <div class="col-6"><strong>LNG:</strong> ${coords[0].toFixed(6)}</div>
            </div>
        </div>`;
};

/**
 * INTERAZIONI UTILITY INTERFACCIA
 */
window.ingrandisciImmagine = (url) => {
    document.getElementById('modalImg').src = url;
    imageModal.show();
};

window.showListView = () => {
    document.getElementById('sidebar-view-detail').classList.add('d-none');
    document.getElementById('sidebar-view-list').classList.remove('d-none');
};

// Listener per i filtri temporali nella sidebar
[filters.dS, filters.dE, filters.tS, filters.tE].forEach(el => 
    el.addEventListener('change', () => drawList(currentPointFeatures))
);

/**
 * INITIALIZATION
 */
async function init() {
    try {
        const res = await fetch('http://localhost:3000/api/punti');
        const data = await res.json();
        
        if (data.features) {
            rawFeatures = data.features;
            updateMap(); 
        }
    } catch (err) {
        console.error("Errore critico durante il caricamento dell'app:", err);
    }
}

init();