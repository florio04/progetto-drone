/**
 * export.js - Gestione esportazione dati in CSV e ZIP (Solo Foto + Fix CORS)
 */

// --- 1. ESPORTAZIONE CSV ---
window.esportaCSV = () => {
    const datiDaEsportare = window.filteredPointFeatures || [];
    if (datiDaEsportare.length === 0) {
        alert("Nessun dato disponibile nei filtri correnti da esportare.");
        return;
    }

    const headers = ["ID_Punto", "Data_Scatto", "Ora_Scatto", "Temperatura_C", "Latitudine", "Longitudine"];
    const rows = datiDaEsportare.map(item => {
        const p = item.properties;
        const coords = item.geometry.coordinates || [0, 0];
        return [
            item.id || "N.D.",
            p.data_misurazione || "",
            p.ora_misurazione || "",
            p.temperatura !== undefined && p.temperatura !== null ? p.temperatura : "Solo Foto",
            coords[1],
            coords[0]
        ];
    });

    const csvContent = [headers.join(";"), ...rows.map(e => e.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `report_drone_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// --- 2. ESPORTAZIONE ZIP (SOLE IMMAGINI + FIX CORS) ---
window.esportaZIP = async () => {
    const datiDaEsportare = window.filteredPointFeatures || [];
    
    // Filtro per includere solo i punti con un'immagine valida
    const puntiConFoto = datiDaEsportare.filter(item => item.properties && item.properties.zona_foto_url);

    if (puntiConFoto.length === 0) {
        alert("Nessuna immagine disponibile nei filtri correnti da inserire nello ZIP.");
        return;
    }
    if (typeof JSZip === "undefined") {
        alert("Errore: La libreria JSZip non è caricata.");
        return;
    }

    const btnZip = document.getElementById('btn-download-zip');
    const testoOriginale = btnZip ? btnZip.innerHTML : "Download ZIP";
    if (btnZip) {
        btnZip.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Compressione...`;
        btnZip.disabled = true;
    }

    const zip = new JSZip();

    // Download sequenziale immagini con normalizzazione per host locali (CORS bypass)
    for (const item of puntiConFoto) {
        let urlFoto = item.properties.zona_foto_url;
        
        try {
            if (!urlFoto.startsWith('http://') && !urlFoto.startsWith('https://')) {
                const pulito = urlFoto.startsWith('/') ? urlFoto.substring(1) : urlFoto;
                urlFoto = `http://localhost:3000/${pulito}`;
            }

            const nomeFile = urlFoto.split('/').pop();
            const response = await fetch(urlFoto, { mode: 'cors' });
            
            if (response.ok) {
                const blobData = await response.blob();
                if (blobData.size > 0) {
                    // Archiviazione file nella root dello ZIP
                    zip.file(nomeFile, blobData); 
                }
            } else {
                console.error(`Errore download foto: ${urlFoto}. Status: ${response.status}`);
            }
        } catch (err) {
            console.warn(`Errore di rete per l'URL: ${urlFoto}`, err);
        }
    }

    // Generazione finale dell'archivio ZIP
    try {
        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `immagini_drone.zip`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (zipErr) {
        console.error("Errore generazione ZIP:", zipErr);
        alert("Errore durante la creazione dello ZIP.");
    } finally {
        if (btnZip) {
            btnZip.innerHTML = testoOriginale;
            btnZip.disabled = false;
        }
    }
};