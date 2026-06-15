const GEOHASH_PRECISION = 12; 

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

// Variabili di Stato Condivise
let rawFeatures = [];           
let currentLayerGroup = L.layerGroup().addTo(map); 
let currentPointFeatures = [];  
let filteredPointFeatures = []; // Elementi che superano i filtri correnti

// Riferimenti ai Filtri HTML
const filters = {
    dS: document.getElementById('f-date-start'),
    dE: document.getElementById('f-date-end'),
    tS: document.getElementById('f-time-start'),
    tE: document.getElementById('f-time-end')
};