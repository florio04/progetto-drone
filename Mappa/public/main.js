// Dataset grezzo dei punti caricati dal drone
let rawFeatures = [];

// Gruppi di layer collegati ai relativi Pane per la gestione dello z-index
let currentLayerGroup = L.layerGroup([], { pane: 'markerPaneCustom' }).addTo(map);
let areeLayerGroup = L.layerGroup([], { pane: 'areePane' }).addTo(map);

// Tracciamento rapido e ottimizzato dei punti contenuti nelle geometrie
const idPuntiDentroAree = new Set();

// Istanza della sidebar globale tramite Offcanvas di Bootstrap
document.addEventListener("DOMContentLoaded", () => {
    const sidebarEl = document.getElementById('sidebar');
    if (sidebarEl) {
        window.sidebar = new bootstrap.Offcanvas(sidebarEl);
    } else {
        console.error("Elemento HTML con ID 'sidebar' non trovato!");
    }
});

// Aggiornamento dinamico dei marker esterni alle aree sul livello mappa
function updateMap() {
    currentLayerGroup.clearLayers();
    
    // Esclusione dei punti già inclusi all'interno dei poligoni delle aree
    const puntiIsolatiEsterni = rawFeatures.filter(f => !idPuntiDentroAree.has(f.id));

    let clusters = [];
    try {
        // Clustering spaziale basato su Geohash per i soli punti esterni
        clusters = groupDataByPrecision(puntiIsolatiEsterni, currentGeohashPrecision);
    } catch (e) {
        // Fallback: rendering 1:1 in caso di libreria clustering non pronta
        console.warn("Clustering non pronto, uso i punti nativi esterni:", e);
        clusters = puntiIsolatiEsterni.map(f => ({
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
            count: 1,
            allFeatures: [f]
        }));
    }

    // Creazione e binding eventi dei marker per i cluster esterni rimasti
    clusters.forEach(cluster => {
        const marker = L.marker([cluster.lat, cluster.lon], {
            pane: 'markerPaneCustom'
        });

        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e); // Previene il click di Leaflet sulla mappa sottostante
            
            window.currentPointFeatures = cluster.allFeatures; 
            drawGroupedSidebar(cluster); 
            
            if (window.sidebar) {
                window.sidebar.show();
            }
        });

        currentLayerGroup.addLayer(marker);
    });
}

// Fetch delle aree da API, censimento punti interni e rendering GeoJSON
async function caricaAree() {
    try {
        const res = await fetch('http://localhost:3000/api/aree');
        const data = await res.json();
        
        areeLayerGroup.clearLayers();
        idPuntiDentroAree.clear(); 
        
        // Mappatura degli ID dei punti interni nel Set globale per velocizzare i filtri
        if (data && data.features) {
            data.features.forEach(area => {
                if (area.properties && area.properties.punti_interni) {
                    area.properties.punti_interni.forEach(punto => {
                        if (punto.id) idPuntiDentroAree.add(punto.id);
                    });
                }
            });
        }
        
        // Rendering grafico dello strato vettoriale aree e gestione eventi di Hover/Click
        L.geoJSON(data, {
            pane: 'areePane',
            style: {
                color: "#ff0055",       // Neon ad alto contrasto per basemap satellite
                weight: 5,              
                opacity: 1.0,           
                fillColor: "#ffcc00",   
                fillOpacity: 0.4        
            },
            onEachFeature: function (feature, layer) {
                // Feedback visivo onHover
                layer.on('mouseover', function () {
                    this.setStyle({ fillOpacity: 0.6, weight: 7 });
                });
                layer.on('mouseout', function () {
                    this.setStyle({ fillOpacity: 0.4, weight: 5 });
                });

                // Gestione click sul poligono dell'area: simula un cluster per la sidebar
                layer.on('click', (e) => {
                    L.DomEvent.stopPropagation(e); 
                    
                    const props = feature.properties;
                    const fakeCluster = {
                        count: props.punti_interni ? props.punti_interni.length : 0,
                        allFeatures: props.punti_interni || [],
                        lat: e.latlng.lat,
                        lon: e.latlng.lng
                    };
                    
                    window.currentPointFeatures = fakeCluster.allFeatures;
                    drawGroupedSidebar(fakeCluster);
                    
                    const titleEl = document.querySelector('.offcanvas-title');
                    if (titleEl) titleEl.textContent = (props.nome || "DETTAGLIO AREA").toUpperCase();
                    
                    if (window.sidebar) {
                        window.sidebar.show();
                    }
                });
            }
        }).addTo(areeLayerGroup);
    } catch (err) {
        console.error("Errore nel caricamento delle aree:", err);
    }
}

// Inizializzazione sequenziale dell'applicazione (Aree -> Punti -> Centratura)
async function init() {
    try {
        // 1. Popola l'elenco dei punti da escludere basandosi sulle aree
        await caricaAree();
        
        // 2. Scarica i dati spaziali grezzi dei punti
        const res = await fetch('http://localhost:3000/api/punti');
        const data = await res.json();
        
        if (data.features) {
            rawFeatures = data.features;
            // 3. Esegue il rendering iniziale dei marker filtrati
            updateMap(); 
        }
        
        // Auto-focus geografico sul primo punto disponibile nei rilievi
        if (data.features && data.features.length > 0) {
            const primoPunto = data.features[0].geometry.coordinates;
            map.setView([primoPunto[1], primoPunto[0]], 19); 
        }
    } catch (err) {
        console.error("Errore durante l'inizializzazione:", err);
    }
}

// Avvio applicazione
init();