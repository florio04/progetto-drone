/**
 * ui.js - Gestione Interfaccia Utente, Filtri e Sidebar Analisi Drone
 */

// --- 1. RIFERIMENTI DOM E STATI GLOBALI ---
// Ancoraggio sicuro degli elementi di filtraggio HTML (evita crash se assenti)
const filters = {
    dS: document.getElementById('filter-date-start') || { value: '' }, 
    dE: document.getElementById('filter-date-end') || { value: '' },   
    tS: document.getElementById('filter-time-start') || { value: '' }, 
    tE: document.getElementById('filter-time-end') || { value: '' }    
};

// Stati globali per condivisione dati tra mappa, filtri ed esportazioni
window.currentPointFeatures = window.currentPointFeatures || [];
window.filteredPointFeatures = window.filteredPointFeatures || [];

// --- 2. DISEGNO STRUTTURA PRINCIPALE SIDEBAR ---
function drawGroupedSidebar(cluster) {
    const titleEl = document.querySelector('.offcanvas-title');
    if (titleEl) titleEl.textContent = "ANALISI DRONE";
    
    // Switch delle viste: nasconde il dettaglio e mostra la lista aggregata
    const viewDetail = document.getElementById('sidebar-view-detail');
    const viewList = document.getElementById('sidebar-view-list');
    if (viewDetail) viewDetail.classList.add('d-none');
    if (viewList) viewList.classList.remove('d-none');
    
    const container = document.getElementById('list-container');
    if (!container) return;
    
    container.innerHTML = '';
    window.currentPointFeatures = cluster.allFeatures || [];

    // Iniezione template HTML principale (pulsanti download e sezioni galleria/storico)
    const summaryHtml = `
        <div class="card mb-3 bg-light border-0 shadow-sm" style="border-radius: 12px;">
            <div class="card-body p-3">
                <p class="small mb-0 text-secondary fw-semibold d-flex align-items-center">
                    <i class="bi bi-geo-alt-fill me-2 text-primary" style="font-size: 16px;"></i>
                    Elementi Rilevati: ${cluster.count || window.currentPointFeatures.length} elementi aggregati
                </p>
            </div>
        </div>

        <div class="row g-2 mb-4">
            <div class="col-6">
                <button class="btn btn-outline-primary btn-sm w-100 py-2 fw-semibold shadow-sm" onclick="window.esportaCSV()">
                    <i class="bi bi-filetype-csv me-1"></i> Scarica CSV
                </button>
            </div>
            <div class="col-6">
                <button class="btn btn-outline-success btn-sm w-100 py-2 fw-semibold shadow-sm" id="btn-download-zip" onclick="window.esportaZIP()">
                    <i class="bi bi-file-earmark-zip me-1"></i> Scarica ZIP
                </button>
            </div>
        </div>

        <div class="d-flex align-items-center mb-3">
            <h6 class="fw-bold mb-0 text-dark"><i class="bi bi-images me-2 text-primary"></i>Galleria Immagini</h6>
            <span class="badge bg-light text-dark border ms-2" id="gallery-count-badge">0 foto</span>
        </div>
        <div class="row g-2 mb-4" id="gallery-container"></div>
        <h6 class="fw-bold mb-3 border-top pt-3 text-dark"><i class="bi bi-list-stars me-2 text-primary"></i>Storico Elementi</h6>
    `;
    container.innerHTML = summaryHtml;

    drawList(window.currentPointFeatures);
}

// --- 3. GENERAZIONE LISTA FILTRATA E GALLERIA FOTOGRAFICA ---
const drawList = (features) => {
    // Filtraggio dati basato su range di date e orari
    const filtered = features.filter(item => {
        const p = item.properties;
        if (!p.ora_misurazione || !p.data_misurazione) return true; 
        
        const ora = p.ora_misurazione.substring(0, 5);
        const matchD = (!filters.dS.value || p.data_misurazione >= filters.dS.value) && 
                       (!filters.dE.value || p.data_misurazione <= filters.dE.value);
        const matchT = (!filters.tS.value || ora >= filters.tS.value) && 
                       (!filters.tE.value || ora <= filters.tE.value);
        return matchD && matchT;
    });

    window.filteredPointFeatures = filtered;

    const galleryContainer = document.getElementById('gallery-container');
    const galleryCountBadge = document.getElementById('gallery-count-badge');
    
    // Rendering galleria con rimozione dei duplicati URL
    if (galleryContainer) {
        galleryContainer.innerHTML = '';
        const filteredPhotos = [...new Set(filtered.map(f => f.properties.zona_foto_url).filter(Boolean))];
        
        if (galleryCountBadge) galleryCountBadge.textContent = `${filteredPhotos.length} foto`;

        if (filteredPhotos.length > 0) {
            filteredPhotos.forEach(url => {
                const col = document.createElement('div');
                col.className = 'col-3'; 
                col.innerHTML = `
                    <div class="gallery-img-container">
                        <img src="${url}" class="img-fluid" 
                             style="height:75px; width:100%; object-fit:cover; cursor:pointer; border-radius:8px; border: 1px solid #eee; transition: transform 0.2s;" 
                             onclick="window.ingrandisciImmagine('${url}')"
                             onmouseover="this.style.transform='scale(1.05)'"
                             onmouseout="this.style.transform='scale(1)'">
                    </div>`;
                galleryContainer.appendChild(col);
            });
        } else {
            galleryContainer.innerHTML = '<div class="col-12"><p class="small text-muted italic ps-1 mb-0">Nessuna foto nei criteri filtrati.</p></div>';
        }
    }

    // Generazione del sub-container per la lista testuale dello storico
    let logList = document.getElementById('log-list-subcontainer');
    if (!logList) {
        logList = document.createElement('div');
        logList.id = 'log-list-subcontainer';
        logList.className = 'list-group list-group-flush';
        const listContainer = document.getElementById('list-container');
        if (listContainer) listContainer.appendChild(logList);
    }
    
    if (logList) {
        logList.innerHTML = '';
        
        if (filtered.length === 0) {
            logList.innerHTML = '<p class="p-3 text-center text-muted small">Nessun elemento corrispondente ai filtri</p>';
            return;
        }

        // Popolamento lista con badge differenziati (Temperatura vs Solo Foto)
        filtered.forEach(item => {
            const p = item.properties;
            const btn = document.createElement('button');
            btn.className = 'list-group-item list-group-item-action border-0 px-0 py-3 border-bottom';
            
            const badgeTemp = (p.temperatura !== undefined && p.temperatura !== null)
                ? `<span class="badge bg-danger rounded-pill">${p.temperatura}°C</span>`
                : `<span class="badge bg-primary rounded-pill"><i class="bi bi-camera-fill"></i> Foto</span>`;

            btn.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <div class="fw-bold" style="font-size:14px;">Punto Rilievo #${item.id || 'N.D.'}</div>
                        <small class="text-muted"><i class="bi bi-clock me-1"></i>${p.data_misurazione || ''} ${p.ora_misurazione ? p.ora_misurazione.substring(0, 5) : ''}</small>
                    </div>
                    ${badgeTemp}
                </div>
            `;
            btn.onclick = () => window.showDetailView(item);
            logList.appendChild(btn);
        });
    }
};

// --- 4. VISTA DETTAGLIO MISURAZIONE TERMICA ---
window.showDetailView = (item) => {
    const viewDetail = document.getElementById('sidebar-view-detail');
    const viewList = document.getElementById('sidebar-view-list');
    if (!viewDetail || !viewList) return;

    const p = item.properties;
    const coords = item.geometry.coordinates || [0, 0];

    // Iniezione metadati di telemetria e posizionamento GPS
    viewDetail.innerHTML = `
        <div class="p-2">
            <button class="btn btn-link btn-sm text-decoration-none text-muted p-0 mb-4 d-flex align-items-center" onclick="window.hideDetailView()">
                <i class="bi bi-arrow-left-short fs-4 me-1"></i> Torna alla lista
            </button>
            
            <div class="d-flex align-items-center justify-content-between mb-4 pb-2 border-bottom">
                <h5 class="fw-bold text-dark mb-0">Rilievo #${item.id || 'N.D.'}</h5>
                <span class="badge bg-danger-subtle text-danger px-3 py-2 rounded-pill fw-bold border border-danger-subtle" style="font-size: 14px;">
                    <i class="bi bi-thermometer-half me-1"></i>${p.temperatura !== undefined && p.temperatura !== null ? p.temperatura + ' °C' : 'N.D.'}
                </span>
            </div>
            
            <div class="d-flex flex-column gap-3">
                <div class="d-flex align-items-center bg-light p-3 rounded-3 border-start border-primary border-3 shadow-sm">
                    <div class="bg-white p-2 rounded-2 text-primary shadow-sm me-3">
                        <i class="bi bi-calendar3 fs-5"></i>
                    </div>
                    <div>
                        <div class="text-muted small fw-medium">Data Misurazione</div>
                        <div class="fw-bold text-dark">${p.data_misurazione || 'Non disponibile'}</div>
                    </div>
                </div>

                <div class="d-flex align-items-center bg-light p-3 rounded-3 border-start border-primary border-3 shadow-sm">
                    <div class="bg-white p-2 rounded-2 text-primary shadow-sm me-3">
                        <i class="bi bi-clock fs-5"></i>
                    </div>
                    <div>
                        <div class="text-muted small fw-medium">Ora Rilievo</div>
                        <div class="fw-bold text-dark">${p.ora_misurazione ? p.ora_misurazione.substring(0, 5) : 'Non disponibile'}</div>
                    </div>
                </div>

                <div class="bg-light p-3 rounded-3 border-start border-secondary border-3 shadow-sm">
                    <div class="text-muted small fw-medium mb-2"><i class="bi bi-geo-alt-fill me-1 text-secondary"></i>Coordinate GPS</div>
                    <div class="row g-0 text-center">
                        <div class="col-6 border-end">
                            <span class="text-muted d-block" style="font-size:11px;">LATITUDINE</span>
                            <span class="font-monospace fw-bold text-dark">${coords[1].toFixed(6)}</span>
                        </div>
                        <div class="col-6">
                            <span class="text-muted d-block" style="font-size:11px;">LONGITUDINE</span>
                            <span class="font-monospace fw-bold text-dark">${coords[0].toFixed(6)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    viewList.classList.add('d-none');
    viewDetail.classList.remove('d-none');
};

// --- 5. VISTA DETTAGLIO IMMAGINE ED EXIF ---
window.ingrandisciImmagine = (url) => {
    const viewDetail = document.getElementById('sidebar-view-detail');
    const viewList = document.getElementById('sidebar-view-list');
    if (!viewDetail || !viewList) return;

    // Recupero del record associato all'URL immagine selezionato
    const featureAssociata = (window.currentPointFeatures || []).find(f => f.properties && f.properties.zona_foto_url === url);
    const p = featureAssociata ? featureAssociata.properties : {};
    const coords = featureAssociata && featureAssociata.geometry ? featureAssociata.geometry.coordinates : [0, 0];
    const idFoto = featureAssociata ? featureAssociata.id : 'N.D.';

    // Render del mockup anteprima e pannello informativo spaziale
    viewDetail.innerHTML = `
        <div class="p-2">
            <button class="btn btn-link btn-sm text-decoration-none text-muted p-0 mb-4 d-flex align-items-center" onclick="window.hideDetailView()">
                <i class="bi bi-arrow-left-short fs-4 me-1"></i> Torna alla lista
            </button>
            
            <div class="pb-2 border-bottom mb-3">
                <h5 class="fw-bold text-dark mb-0">Immagine Drone #${idFoto}</h5>
            </div>
            
            <div class="mb-4 text-center p-1 bg-white rounded-3 shadow-sm border">
                <img src="${url}" class="img-fluid rounded-3" style="max-height: 240px; object-fit: contain; width: 100%;">
            </div>
            
            <div class="row g-2 mb-3">
                <div class="col-6">
                    <div class="bg-light p-3 rounded-3 shadow-sm text-center h-100">
                        <i class="bi bi-calendar-event text-success fs-4 mb-1 d-block"></i>
                        <span class="text-muted d-block" style="font-size:11px; font-weight:500;">DATA SCATTO</span>
                        <span class="fw-bold text-dark" style="font-size:13px;">${p.data_misurazione || 'N.D.'}</span>
                    </div>
                </div>
                <div class="col-6">
                    <div class="bg-light p-3 rounded-3 shadow-sm text-center h-100">
                        <i class="bi bi-clock-history text-success fs-4 mb-1 d-block"></i>
                        <span class="text-muted d-block" style="font-size:11px; font-weight:500;">ORA SCATTO</span>
                        <span class="fw-bold text-dark" style="font-size:13px;">${p.ora_misurazione ? p.ora_misurazione.substring(0, 5) : 'N.D.'}</span>
                    </div>
                </div>
            </div>

            <div class="bg-light p-3 rounded-3 border-start border-success border-3 shadow-sm">
                <div class="text-muted small fw-medium mb-2"><i class="bi bi-pin-map-fill me-1 text-success"></i>Posizione Geo-Scatto</div>
                <div class="row g-0 text-center">
                    <div class="col-6 border-end">
                        <span class="text-muted d-block" style="font-size:11px;">LATITUDINE</span>
                        <span class="font-monospace fw-bold text-dark">${coords[1].toFixed(6)}</span>
                    </div>
                    <div class="col-6">
                        <span class="text-muted d-block" style="font-size:11px;">LONGITUDINE</span>
                        <span class="font-monospace fw-bold text-dark">${coords[0].toFixed(6)}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    viewList.classList.add('d-none');
    viewDetail.classList.remove('d-none');
};

// --- 6. UTILITY NAVIGAZIONE E TOGGLE VISTE ---
window.hideDetailView = () => {
    const viewDetail = document.getElementById('sidebar-view-detail');
    const viewList = document.getElementById('sidebar-view-list');
    if (viewDetail && viewList) {
        viewDetail.innerHTML = '';
        viewDetail.classList.add('d-none');
        viewList.classList.remove('d-none');
    }
};

window.showListView = () => {
    const viewDetail = document.getElementById('sidebar-view-detail');
    const viewList = document.getElementById('sidebar-view-list');
    if (viewDetail) viewDetail.classList.add('d-none');
    if (viewList) viewList.classList.remove('d-none');
};

window.toggleSettingsWindow = () => {
    const settingsWindow = document.getElementById('settings-window');
    if (settingsWindow) {
        settingsWindow.classList.toggle('d-none');
    } else {
        console.warn("Finestra delle impostazioni (#settings-window) assente nel DOM.");
    }
};

// --- 7. EVENT LISTENERS FILTRI INPUT ---
// Ricalcolo immediato della lista all'alterazione di qualsiasi input temporale
[filters.dS, filters.dE, filters.tS, filters.tE].forEach(el => {
    if (el && typeof el.addEventListener === 'function') {
        el.addEventListener('change', () => {
            if (typeof drawList === 'function' && window.currentPointFeatures) {
                drawList(window.currentPointFeatures);
            }
        });
    }
});

// --- 8. INITIALIZE SLIDER PRECISIONE GEOHASH ---
// Gestione real-time dello slider per la densità del clustering sulla mappa
document.addEventListener("DOMContentLoaded", () => {
    const slider = document.getElementById('geohash-slider');
    const badgeValue = document.getElementById('geohash-value');

    if (slider && badgeValue) {
        slider.addEventListener('input', (e) => {
            const nuovoValore = parseInt(e.target.value);
            badgeValue.textContent = nuovoValore;
            
            if (typeof currentGeohashPrecision !== 'undefined') {
                currentGeohashPrecision = nuovoValore;
            }
            if (typeof updateMap === "function") {
                updateMap(); 
            }
        });
    }
});