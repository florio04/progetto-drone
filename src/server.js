/**
 * server.js - Backend Express Completo con PostGIS per Analisi Spaziale Drone
 */

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const geohash = require('ngeohash');
const app = express();

// --- 1. CONFIGURAZIONE MIDDLEWARE E ASSOCIAZIONE DATABASE ---
app.use(cors());
app.use(express.json());

// Pool di connessione PostgreSQL con estensione spaziale PostGIS attiva
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'drone_db', 
    password: 'oPMd9nkZKuzhooMB', 
    port: 5432, 
});

// Distribuzione dei file statici della dashboard (Frontend)
app.use(express.static(path.join(__dirname, '../public')));


// --- 2. OPERAZIONI DI LETTURA (READ) ---

/**
 * GET /api/punti - Estrae SOLO i punti ISOLATI (esterni a qualsiasi area)
 */
app.get('/api/punti', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT jsonb_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'type', 'Feature',
                        'id', p.id,
                        'geometry', ST_AsGeoJSON(p.posizione)::jsonb,
                        'properties', jsonb_build_object(
                            'temperatura', m.temperatura,
                            'data_misurazione', COALESCE(to_char(m.data_ora, 'YYYY-MM-DD'), to_char(img.data_ora, 'YYYY-MM-DD')),
                            'ora_misurazione', COALESCE(to_char(m.data_ora, 'HH24:MI:SS'), to_char(img.data_ora, 'HH24:MI:SS')),
                            'zona_foto_url', img.percorso_file,
                            'geohash', ST_GeoHash(ST_Transform(p.posizione, 4326), 12)
                        )
                    )
                ), '[]'::jsonb)
            ) FROM punti p
            LEFT JOIN LATERAL (
                SELECT temperatura, data_ora FROM misurazioni 
                WHERE id_punto = p.id ORDER BY data_ora DESC LIMIT 1
            ) m ON true
            LEFT JOIN LATERAL (
                SELECT percorso_file, data_ora FROM immagini 
                WHERE id_punto = p.id ORDER BY data_ora DESC LIMIT 1
            ) img ON true
            WHERE NOT EXISTS (
                SELECT 1 FROM aree a WHERE ST_Contains(a.confini, p.posizione)
            );
        `);
        res.json(result.rows[0].jsonb_build_object);
    } catch (err) {
        console.error("Errore DB Punti Isolati:", err.message);
        res.status(500).json({ error: "Errore nel recupero dei punti isolati" });
    }
});

/**
 * GET /api/punti/tutti - Estrae TUTTI i punti presenti nel database (Global Collection)
 */
app.get('/api/punti/tutti', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT jsonb_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'type', 'Feature',
                        'id', p.id,
                        'geometry', ST_AsGeoJSON(p.posizione)::jsonb,
                        'properties', jsonb_build_object(
                            'temperatura', m.temperatura,
                            'data_misurazione', COALESCE(to_char(m.data_ora, 'YYYY-MM-DD'), to_char(img.data_ora, 'YYYY-MM-DD')),
                            'ora_misurazione', COALESCE(to_char(m.data_ora, 'HH24:MI:SS'), to_char(img.data_ora, 'HH24:MI:SS')),
                            'zona_foto_url', img.percorso_file
                        )
                    )
                ), '[]'::jsonb)
            ) FROM punti p
            LEFT JOIN LATERAL (
                SELECT temperatura, data_ora FROM misurazioni 
                WHERE id_punto = p.id ORDER BY data_ora DESC LIMIT 1
            ) m ON true
            LEFT JOIN LATERAL (
                SELECT percorso_file, data_ora FROM immagini 
                WHERE id_punto = p.id ORDER BY data_ora DESC LIMIT 1
            ) img ON true;
        `);
        res.json(result.rows[0].jsonb_build_object);
    } catch (err) {
        console.error("Errore DB Tutti i Punti:", err.message);
        res.status(500).json({ error: "Errore nel recupero di tutti i punti" });
    }
});

/**
 * GET /api/punti/:id - Estrae un singolo punto specifico tramite ID
 */
app.get('/api/punti/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT p.id, ST_AsGeoJSON(p.posizione)::json AS geometria,
                   m.temperatura, to_char(m.data_ora, 'YYYY-MM-DD HH24:MI:SS') AS data_misurazione,
                   img.percorso_file AS zona_foto_url
            FROM punti p
            LEFT JOIN LATERAL (SELECT temperatura, data_ora FROM misurazioni WHERE id_punto = p.id ORDER BY data_ora DESC LIMIT 1) m ON true
            LEFT JOIN LATERAL (SELECT percorso_file, data_ora FROM immagini WHERE id_punto = p.id ORDER BY data_ora DESC LIMIT 1) img ON true
            WHERE p.id = $1;
        `;
        const result = await pool.query(query, [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Punto non trovato" });
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Errore recupero singolo punto:", err.message);
        res.status(500).json({ error: "Errore nel recupero del punto specifico" });
    }
});

/**
 * GET /api/aree - Estrae TUTTE le aree con i rispettivi punti interni annidati
 */
app.get('/api/aree', async (req, res) => {
    try {
        const query = `
            SELECT a.id, a.nome, ST_AsGeoJSON(a.confini)::json AS geometria,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', p.id, 'type', 'Feature', 'geometry', ST_AsGeoJSON(p.posizione)::json,
                            'properties', json_build_object(
                                'temperatura', m.temperatura,
                                'data_misurazione', COALESCE(to_char(m.data_ora, 'YYYY-MM-DD'), to_char(img.data_ora, 'YYYY-MM-DD')),
                                'ora_misurazione', COALESCE(to_char(m.data_ora, 'HH24:MI:SS'), to_char(img.data_ora, 'HH24:MI:SS')),
                                'zona_foto_url', img.percorso_file
                            )
                        )
                    ) FILTER (WHERE p.id IS NOT NULL), '[]'::json
                ) AS punti_interni
            FROM aree a
            LEFT JOIN punti p ON ST_Contains(a.confini, p.posizione)
            LEFT JOIN LATERAL (SELECT temperatura, data_ora FROM misurazioni WHERE id_punto = p.id ORDER BY data_ora DESC LIMIT 1) m ON true
            LEFT JOIN LATERAL (SELECT percorso_file, data_ora FROM immagini WHERE id_punto = p.id ORDER BY data_ora DESC LIMIT 1) img ON true
            GROUP BY a.id, a.nome, a.confini;
        `;
        const result = await pool.query(query); 
        const geojson = {
            type: "FeatureCollection",
            features: result.rows.map(row => ({
                type: "Feature", geometry: row.geometria,
                properties: { id: row.id, nome: row.nome, punti_interni: row.punti_interni }
            }))
        };
        res.json(geojson);
    } catch (err) {
        console.error("Errore nella rotta /api/aree:", err);
        res.status(500).json({ error: "Errore interno del server" });
    }
});

/**
 * GET /api/aree/:id - Estrae una singola area specifica con i suoi punti interni
 */
app.get('/api/aree/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT a.id, a.nome, ST_AsGeoJSON(a.confini)::json AS geometria,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', p.id, 'geometry', ST_AsGeoJSON(p.posizione)::json,
                            'temperatura', m.temperatura
                        )
                    ) FILTER (WHERE p.id IS NOT NULL), '[]'::json
                ) AS punti_interni
            FROM aree a
            LEFT JOIN punti p ON ST_Contains(a.confini, p.posizione)
            LEFT JOIN LATERAL (SELECT temperatura FROM misurazioni WHERE id_punto = p.id ORDER BY data_ora DESC LIMIT 1) m ON true
            WHERE a.id = $1
            GROUP BY a.id, a.nome, a.confini;
        `;
        const result = await pool.query(query, [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Area non trovata" });
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Errore recupero singola area:", err.message);
        res.status(500).json({ error: "Errore nel recupero dell'area specifica" });
    }
});


// --- 3. OPERAZIONI DI CREAZIONE (CREATE) ---

/**
 * POST /api/drone/posizione - Salva un punto geometrico e le relative telemetrie (Transazionale)
 */
// SALVATAGGIO DATI DRONE (Ottimizzato e protetto da errori di tipo)
app.post('/api/drone/posizione', async (req, res) => {
    const { lat, lon, temperatura, foto_url, data_ora } = req.body; 

    if (!lat || !lon) {
        return res.status(400).json({ error: "Latitudine e Longitudine sono obbligatorie" });
    }
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Inseriamo PRIMA il punto spaziale per ottenere il suo ID univoco
        const puntoRes = await client.query(`
            INSERT INTO punti (posizione)
            VALUES (ST_SetSRID(ST_MakePoint($1, $2), 4326)) RETURNING id;
        `, [lon, lat]);
        const puntoId = puntoRes.rows[0].id;

        // Gestiamo la data qui in JS: se passata usiamo quella, altrimenti creiamo il timestamp del momento esatto
        const dataRilievo = data_ora ? new Date(data_ora) : new Date();

        // 2. Inseriamo la misurazione collegata all'ID del punto
        if (temperatura !== undefined && temperatura !== null) {
            await client.query(`
                INSERT INTO misurazioni (id_punto, temperatura, data_ora) 
                VALUES ($1, $2, $3);
            `, [puntoId, temperatura, dataRilievo]);
        }

        // 3. Inseriamo l'eventuale immagine collegata all'ID del punto
        if (foto_url) {
            await client.query(`
                INSERT INTO immagini (id_punto, percorso_file, data_ora) 
                VALUES ($1, $2, $3);
            `, [puntoId, foto_url, dataRilievo]);
        }

        await client.query('COMMIT');
        
        const hash = geohash.encode(lat, lon, 12);
        res.status(201).json({ message: "Dati salvati con successo", geohash: hash, id_punto: puntoId });
    } catch (err) {
        await client.query('ROLLBACK');
        
        // Questo stamperà l'errore preciso sul terminale del server
        console.error("ERRORE SORGENTE:", err.message);
        
        // Questo ti rimanderà l'errore esatto dentro VS Code / REST Client
        res.status(500).json({ 
            error: "Errore server durante il salvataggio", 
            dettaglio_tecnico: err.message 
        }); 
    } finally {
        client.release();
    }
});

/**
 * POST /api/aree - Registrazione di una nuova area poligonale (GeoJSON supportato)
 */
app.post('/api/aree', async (req, res) => {
    const { nome, geometria } = req.body; 
    if (!nome || !geometria) return res.status(400).json({ error: "Nome e geometria GeoJSON obbligatori" });

    try {
        const query = `
            INSERT INTO aree (nome, confini) VALUES ($1, ST_SetSRID(ST_GeomFromGeoJSON($2), 4326))
            RETURNING id, nome, ST_AsGeoJSON(confini)::json AS geometria;
        `;
        const result = await pool.query(query, [nome, JSON.stringify(geometria)]);
        res.status(201).json({ message: "Area creata con successo", area: result.rows[0] });
    } catch (err) {
        console.error("Errore inserimento area:", err.message);
        res.status(500).json({ error: "Errore nella creazione dell'area" });
    }
});


// --- 4. OPERAZIONI DI AGGIORNAMENTO (UPDATE) ---

/**
 * PUT /api/aree/:id - Modifica il perimetro o il nome di un'area
 */
app.put('/api/aree/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, geometria } = req.body;
    if (!nome || !geometria) return res.status(400).json({ error: "Nome e geometria necessari" });

    try {
        const query = `
            UPDATE aree SET nome = $1, confini = ST_SetSRID(ST_GeomFromGeoJSON($2), 4326) WHERE id = $3
            RETURNING id, nome, ST_AsGeoJSON(confini)::json AS geometria;
        `;
        const result = await pool.query(query, [nome, JSON.stringify(geometria), id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Area non trovata" });
        res.json({ message: "Area aggiornata", area: result.rows[0] });
    } catch (err) {
        console.error("Errore aggiornamento area:", err.message);
        res.status(500).json({ error: "Errore nella modifica dell'area" });
    }
});

/**
 * PUT /api/punti/:id - Modifica la posizione geografica di un punto esistente
 */
app.put('/api/punti/:id', async (req, res) => {
    const { id } = req.params;
    const { lat, lon } = req.body;
    if (!lat || !lon) return res.status(400).json({ error: "Latitudine e Longitudine necessarie" });

    try {
        const query = `
            UPDATE punti SET posizione = ST_SetSRID(ST_MakePoint($1, $2), 4326) WHERE id = $3
            RETURNING id, ST_AsGeoJSON(posizione)::json AS geometria;
        `;
        const result = await pool.query(query, [lon, lat, id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Punto non trovato" });
        res.json({ message: "Posizione del punto aggiornata", punto: result.rows[0] });
    } catch (err) {
        console.error("Errore aggiornamento punto:", err.message);
        res.status(500).json({ error: "Errore nell'aggiornamento spaziale del punto" });
    }
});


// --- 5. OPERAZIONI DI ELIMINAZIONE (DELETE) ---

/**
 * DELETE /api/punti/:id - Rimuove un punto (ON DELETE CASCADE elimina letture e foto collegate)
 */
app.delete('/api/punti/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM punti WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Punto non trovato" });
        res.json({ message: "Punto e dati associati eliminati" });
    } catch (err) {
        console.error("Errore eliminazione punto:", err.message);
        res.status(500).json({ error: "Errore durante l'eliminazione" });
    }
});

/**
 * DELETE /api/aree/:id - Rimuove un'area geometrica senza intaccare i punti al suo interno
 */
app.delete('/api/aree/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM aree WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Area non trovata" });
        res.json({ message: "Area eliminata con successo" });
    } catch (err) {
        console.error("Errore eliminazione area:", err.message);
        res.status(500).json({ error: "Errore durante la rimozione" });
    }
});


// --- 6. GESTIONE TABELLA MISURAZIONI (CRUD) ---

app.post('/api/misurazioni', async (req, res) => {
    const { id_punto, temperatura } = req.body;
    if (!id_punto || temperatura === undefined) return res.status(400).json({ error: "Dati mancanti" });
    try {
        const result = await pool.query(`INSERT INTO misurazioni (id_punto, temperatura) VALUES ($1, $2) RETURNING *;`, [id_punto, temperatura]);
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Errore inserimento misurazione" }); }
});

app.get('/api/punti/:id/misurazioni', async (req, res) => {
    try {
        const result = await pool.query(`SELECT id, temperatura, to_char(data_ora, 'YYYY-MM-DD HH24:MI:SS') AS data_ora FROM misurazioni WHERE id_punto = $1 ORDER BY data_ora DESC;`, [req.params.id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Errore lettura storico misurazioni" }); }
});

app.put('/api/misurazioni/:id', async (req, res) => {
    const { temperatura } = req.body;
    try {
        const result = await pool.query(`UPDATE misurazioni SET temperatura = $1 WHERE id = $2 RETURNING *;`, [temperatura, req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Non trovata" });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Errore modifica misurazione" }); }
});

app.delete('/api/misurazioni/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM misurazioni WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Non trovata" });
        res.json({ message: "Misurazione rimossa" });
    } catch (err) { res.status(500).json({ error: "Errore eliminazione" }); }
});


// --- 7. GESTIONE TABELLA IMMAGINI (CRUD) ---

app.post('/api/immagini', async (req, res) => {
    const { id_punto, percorso_file } = req.body;
    if (!id_punto || !percorso_file) return res.status(400).json({ error: "Dati mancanti" });
    try {
        const result = await pool.query(`INSERT INTO immagini (id_punto, percorso_file) VALUES ($1, $2) RETURNING *;`, [id_punto, percorso_file]);
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Errore salvataggio immagine" }); }
});

app.get('/api/punti/:id/immagini', async (req, res) => {
    try {
        const result = await pool.query(`SELECT id, percorso_file, to_char(data_ora, 'YYYY-MM-DD HH24:MI:SS') AS data_ora FROM immagini WHERE id_punto = $1 ORDER BY data_ora DESC;`, [req.params.id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Errore galleria immagini" }); }
});

app.put('/api/immagini/:id', async (req, res) => {
    const { percorso_file } = req.body;
    try {
        const result = await pool.query(`UPDATE immagini SET percorso_file = $1 WHERE id = $2 RETURNING *;`, [percorso_file, req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Non trovata" });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Errore modifica immagine" }); }
});

app.delete('/api/immagini/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM immagini WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Non trovata" });
        res.json({ message: "Riferimento immagine rimosso" });
    } catch (err) { res.status(500).json({ error: "Errore eliminazione immagine" }); }
});


// --- 8. ROUTING DI BASE E AVVIO ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server attivo su http://localhost:${PORT}`));