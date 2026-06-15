window.esportaCSV = () => {
    if (!filteredPointFeatures || filteredPointFeatures.length === 0) {
        alert("Nessun dato corrispondente ai filtri da poter esportare.");
        return;
    }
    
    let csvContent = "data,ora,latitudine,longitudine,temperatura_celsius,geohash\n";
    filteredPointFeatures.forEach(item => {
        const p = item.properties;
        const coords = item.geometry.coordinates; 
        csvContent += `${p.data_misurazione},${p.ora_misurazione},${coords[1]},${coords[0]},${p.temperatura},${p.geohash}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.setAttribute("href", url);
    link.setAttribute("download", `report_filtrato_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.esportaZIP = async () => {
    const btn = document.getElementById('btn-download-zip');
    const originalText = btn.innerHTML;
    
    const photos = [...new Set(filteredPointFeatures.map(f => f.properties.zona_foto_url).filter(Boolean))];
    if (photos.length === 0) {
        alert("Nessuna immagine disponibile per i criteri di filtro selezionati.");
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Elaborazione...`;
    
    const zip = new JSZip();
    let downloadedCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < photos.length; i++) {
        const url = photos[i];
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Errore HTTP");
            const blob = await response.blob();
            zip.file(`rilievo_filtrato_${downloadedCount + 1}.jpg`, blob);
            downloadedCount++;
        } catch (err) {
            console.warn(`Immagine saltata: ${url}`, err.message);
            skippedCount++;
        }
    }
    
    if (downloadedCount === 0) {
        alert("Impossibile creare lo ZIP: link corrotti o blocchi CORS.");
        btn.disabled = false;
        btn.innerHTML = originalText;
        return;
    }
    
    try {
        const content = await zip.generateAsync({ type: "blob" });
        const zipUrl = URL.createObjectURL(content);
        const link = document.createElement("a");
        link.href = zipUrl;
        link.download = `foto_filtrate_${new Date().toISOString().slice(0,10)}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        if (skippedCount > 0) {
            alert(`Archivio creato (${downloadedCount} foto). Saltate ${skippedCount} immagini per problemi di rete.`);
        }
    } catch (error) {
        console.error(error);
        alert("Errore durante il confezionamento dello ZIP.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};