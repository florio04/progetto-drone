const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

/**
 * CONFIGURAZIONE DATABASE
 */
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'drone_db', 
    password: 'oPMd9nkZKuzhooMB', 
    port: 5432, 
});


app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/punti', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT jsonb_build_object(
                'type', 'FeatureCollection',
                'features', jsonb_agg(
                    jsonb_build_object(
                        'type', 'Feature',
                        'geometry', ST_AsGeoJSON(posizione)::jsonb,
                        'properties', jsonb_build_object(
                            'temperatura', temperatura,
                            'data_misurazione', data_misurazione,
                            'ora_misurazione', ora_misurazione,
                            'zona_foto_url', zona_foto_url
                        )
                    )
                )
            ) FROM punti_ricognizione;
        `);
        res.json(result.rows[0].jsonb_build_object);
    } catch (err) {
        console.error("Errore DB:", err.message);
        res.status(500).json({ error: "Errore nel recupero dati" });
    }
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Avvio del server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(` Server attivo su http://localhost:${PORT}`);
});