function drawGroupedSidebar(cluster) {
    document.getElementById('sidebar-view-detail').classList.add('d-none');
    document.getElementById('sidebar-view-list').classList.remove('d-none');
    
    const container = document.getElementById('list-container');
    container.innerHTML = '';

    const summaryHtml = `
        <div class="card mb-3 bg-light border-0 shadow-sm" style="border-radius: 12px;">
            <div class="card-body p-3">
                <p class="small mb-0 text-secondary fw-semibold d-flex align-items-center">
                    <i class="bi bi-geo-alt-fill me-2 text-primary" style="font-size: 16px;"></i>
                    Area Baricentro: ${cluster.count} rilevamenti aggregati
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
            <h6 class="fw-bold mb-0 text-dark"><i class="bi bi-images me-2 text-primary"></i>Galleria Area</h6>
            <span class="badge bg-light text-dark border ms-2" id="gallery-count-badge">0 foto</span>
        </div>
        <div class="row g-2 mb-4" id="gallery-container"></div>
        <h6 class="fw-bold mb-3 border-top pt-3 text-dark"><i class="bi bi-list-stars me-2 text-primary"></i>Storico Rilevamenti</h6>
    `;
    container.innerHTML = summaryHtml;

    drawList(cluster.allFeatures);
}

const drawList = (features) => {
    // Filtraggio Logico
    const filtered = features.filter(item => {
        const p = item.properties;
        const ora = p.ora_misurazione.substring(0,5);
        const matchD = (!filters.dS.value || p.data_misurazione >= filters.dS.value) && 
                       (!filters.dE.value || p.data_misurazione <= filters.dE.value);
        const matchT = (!filters.tS.value || ora >= filters.tS.value) && 
                       (!filters.tE.value || ora <= filters.tE.value);
        return matchD && matchT;
    });

    // Aggiorna lo stato globale per i download
    filteredPointFeatures = filtered;

    // Aggiorna Galleria Dinamica
    const galleryContainer = document.getElementById('gallery-container');
    const galleryCountBadge = document.getElementById('gallery-count-badge');
    
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
                             style="height:75px; width:100%; object-fit:cover; cursor:pointer;" 
                             onclick="window.ingrandisciImmagine('${url}')">
                    </div>`;
                galleryContainer.appendChild(col);
            });
        } else {
            galleryContainer.innerHTML = '<div class="col-12"><p class="small text-muted italic ps-1 mb-0">Nessuna foto nei filtri selezionati.</p></div>';
        }
    }

    // Storico Log
    let logList = document.getElementById('log-list-subcontainer');
    if(!logList) {
        logList = document.createElement('div');
        logList.id = 'log-list-subcontainer';
        logList.className = 'list-group list-group-flush';
        document.getElementById('list-container').appendChild(logList);
    }
    logList.innerHTML = '';
    
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

window.ingrandisciImmagine = (url) => {
    document.getElementById('modalImg').src = url;
    imageModal.show();
};

window.showListView = () => {
    document.getElementById('sidebar-view-detail').classList.add('d-none');
    document.getElementById('sidebar-view-list').classList.remove('d-none');
};

// Listener UI per i filtri temporali
[filters.dS, filters.dE, filters.tS, filters.tE].forEach(el => 
    el.addEventListener('change', () => drawList(currentPointFeatures))
);