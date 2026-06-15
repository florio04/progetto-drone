function updateMap() {
    currentLayerGroup.clearLayers();
    
    // Richiama la funzione definita in clustering.js
    const clusters = groupDataByPrecision(rawFeatures, GEOHASH_PRECISION);

    clusters.forEach(cluster => {
        const marker = L.marker([cluster.lat, cluster.lon]);

        marker.on('click', () => {
            currentPointFeatures = cluster.allFeatures; 
            drawGroupedSidebar(cluster); // Definita in ui.js
            sidebar.show();
        });

        currentLayerGroup.addLayer(marker);
    });
}

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

// Lancia l'applicazione
init();