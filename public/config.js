// Parametri globali
let currentGeohashPrecision = 12; 

// --- INIZIALIZZAZIONE MAPPA ---
const map = L.map('map', { 
    zoomControl: true, 
    minZoom: 2,
    maxZoom: 24 
}).setView([45.40297, 10.99760], 19); 

// Pane custom per gestire le priorità di click (z-index)
map.createPane('areePane');
map.getPane('areePane').style.zIndex = 450; 

map.createPane('markerPaneCustom');
map.getPane('markerPaneCustom').style.zIndex = 650; 

// --- BASEMAP ---
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxNativeZoom: 19, 
    maxZoom: 24, 
    attribution: '&copy; Esri'
}).addTo(map);

// --- GESTIONE OVERLAY IMMAGINI ---
const catalogoImmagini = [
    {
        nome: "Serra Borgo Roma",
        percorso: "layer/serra_borgo_roma.jpg",
        zoomMinimo: 19, 
        confini: [
            [45.40258, 10.99808], // Sud-Ovest
            [45.40297, 10.99860]  // Nord-Est
        ]
    }
];

// Generazione istanze Leaflet per gli overlay (passivi al click per non bloccare i marker)
const layerIstanze = catalogoImmagini
    .filter(img => img && img.percorso && img.confini)
    .map(infoImmagine => {
        return {
            config: infoImmagine,
            layerLeaflet: L.imageOverlay(infoImmagine.percorso, infoImmagine.confini, {
                opacity: 1.0,
                alt: infoImmagine.nome,
                interactive: false 
            }
        )};
    });

// Controllo visibilità overlay in base al livello di zoom attivo
function gestisciVisualizzazioneFiltroZoom() {
    const zoomAttuale = map.getZoom(); 

    layerIstanze.forEach(item => {
        if (zoomAttuale >= item.config.zoomMinimo) {
            if (!map.hasLayer(item.layerLeaflet)) {
                item.layerLeaflet.addTo(map);
            }
        } else {
            if (map.hasLayer(item.layerLeaflet)) {
                map.removeLayer(item.layerLeaflet);
            }
        }
    });
}

// --- EVENT LISTENERS ---
map.on('zoomend', gestisciVisualizzazioneFiltroZoom);

// Trigger iniziale al caricamento
gestisciVisualizzazioneFiltroZoom();

// Log coordinate al click sulla mappa
map.on('click', function(e) {
    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);
    console.log(`Click sulla mappa -> LAT: ${lat}, LNG: ${lng}`);
});