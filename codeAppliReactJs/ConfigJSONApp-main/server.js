/*  
Le fichier server.js crée et configure un serveur Express pour gérer les requêtes HTTP. 
Il utilise une base de données PostgreSQL pour stocker et récupérer les données.
*/

// initialisation d'un serveur Express
const express = require('express'); 
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = 5000;

// Configurer la connexion à la base de données AEX sur PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'aex',
  password: 'Cova280524',
  port: 5432,
});

app.use(cors());
app.use(express.json());

// Endpoint pour récupérer les données des stations dans la table "station" de la base de données AEX 
app.get('/api/getStations', async (req, res) => {
  try {

    // Récupére les stations de la table station et les tries par id croissant
    const result = await pool.query('SELECT station_id, config, config_name FROM station ORDER BY station_id ASC'); 
    res.json(result.rows);

  } catch (err) {
    console.error('Erreur lors de la récupération des données', err);
    res.status(500).send('Erreur du serveur');

  }
});

// Endpoint pour mettre à jour les données d'une station modifié dans la table "station" de la base de données AEX 
app.post('/api/updateStation/:id', async (req, res) => {

  //Récupére l'id et la config de la station modifiée
  const { id } = req.params; 
  const newConfig = req.body;
  
  try {

    // Met à jour les données de la station sélectionnée par l'utilisateur dans la base de données AEX
    const result = await pool.query(
      'UPDATE station SET config =  $1 WHERE station_id = $2 RETURNING *',
      [newConfig, id]
    );


    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).send('Station not found');
    }

  } catch (err) {
    console.error('Erreur lors de la mise à jour des données', err);
    res.status(500).send('Erreur du serveur');

  }
});

// Endpoint pour récupérer les formules d'un gaz spécifique dans la table "cal_template" de la base de données AEX
app.get('/api/getFormulas/:gazName', async (req, res) => {
  const { gazName } = req.params;
  try {
    const result = await pool.query('SELECT formulae FROM cal_template WHERE name = $1', [gazName]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).send('Formule non trouvée');
    }
  } catch (err) {
    console.error('Erreur lors de la récupération de la formule', err);
    res.status(500).send('Erreur du serveur');
  }
});

// Endpoint pour récupérer les données de calibration d'un gaz spécifique dans la table "calibration" de la base de données AEX
app.get('/api/getCalibrationData/:gazType', async (req, res) => {
  const { gazType } = req.params;
  const { selectedStationId } = req.query; // Récupération du paramètre supplémentaire depuis l'URL

  try {
    const result = await pool.query('SELECT * FROM calibration WHERE param = $1 AND station = $2', [gazType, selectedStationId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur lors de la récupération des données de calibration', err);
    res.status(500).send('Erreur du serveur');
  }
});

// Endpoint pour mettre à jour les données de calibrations d'un gaz spécifique dans la table "calibration" de la base de données AEX
app.post('/api/updateCalibrationData/:gazType', async (req, res) => {
  const { C0, Ch, RZPH, RZPL, RHPH, RHPL, Ph2, Pl2, Ph3, Pl3 } = req.body;
  const { gazType } = req.params;
  const { selectedStationId } = req.query; // Récupération du paramètre supplémentaire depuis l'URL

  try {
    await pool.query(
      'UPDATE calibration SET c = $1 WHERE param = $2 AND (cal_point = \'ZPH\' OR cal_point = \'ZPL\') AND station = $3',
      [C0, gazType, selectedStationId]
    );

    await pool.query(
      'UPDATE calibration SET c = $1 WHERE param = $2 AND (cal_point = \'HPH\' OR cal_point = \'HPL\') AND station = $3',
      [Ch, gazType, selectedStationId]
    );

    await pool.query(
      'UPDATE calibration SET pressure = $1 WHERE param = $2 AND cal_point = \'ZPH\' AND station = $3',
      [Ph2, gazType, selectedStationId]
    );

    await pool.query(
      'UPDATE calibration SET pressure = $1 WHERE param = $2 AND cal_point = \'ZPL\' AND station = $3',
      [Pl2, gazType, selectedStationId]
    );

    await pool.query(
      'UPDATE calibration SET pressure = $1 WHERE param = $2 AND cal_point = \'HPH\' AND station = $3',
      [Ph3, gazType, selectedStationId]
    );

    await pool.query(
      'UPDATE calibration SET pressure = $1 WHERE param = $2 AND cal_point = \'HPL\' AND station = $3',
      [Pl3, gazType, selectedStationId]
    );

    await pool.query(
      'UPDATE calibration SET r = $1 WHERE param = $2 AND cal_point = \'ZPH\' AND station = $3',
      [RZPH, gazType, selectedStationId]
    );

    await pool.query(
      'UPDATE calibration SET r = $1 WHERE param = $2 AND cal_point = \'ZPL\' AND station = $3',
      [RZPL, gazType, selectedStationId]
    );

    await pool.query(
      'UPDATE calibration SET r = $1 WHERE param = $2 AND cal_point = \'HPH\' AND station = $3',
      [RHPH, gazType, selectedStationId]
    );

    await pool.query(
      'UPDATE calibration SET r = $1 WHERE param = $2 AND cal_point = \'HPL\' AND station = $3',
      [RHPL, gazType, selectedStationId]
    );

    res.send('Calibration data updated successfully');
  } catch (err) {
    console.error('Erreur lors de la mise à jour des données de calibration:', err);
    res.status(500).send('Erreur du serveur');
  }
});

// Endpoint pour créer de nouvelles données de calibration
app.post('/api/createCalibrationData/:gazType', async (req, res) => {
  const { C0, Ch, RZPH, RZPL, RHPH, RHPL, Ph2, Pl2, Ph3, Pl3 } = req.body;
  const { gazType } = req.params;
  const { selectedStationId } = req.query;

  try {

    await pool.query(
      'INSERT INTO calibration (param, station, cal_point, c, r, pressure) VALUES ($1, $2, \'ZPH\', $3, $4, $5)',
      [gazType, selectedStationId, C0, RZPH, Ph2]
    );

    await pool.query(
      'INSERT INTO calibration (param, station, cal_point, c, r, pressure) VALUES ($1, $2, \'ZPL\', $3, $4, $5)',
      [gazType, selectedStationId, C0, RZPL, Pl2]
    );

    await pool.query(
      'INSERT INTO calibration (param, station, cal_point, c, r, pressure) VALUES ($1, $2, \'HPH\', $3, $4, $5)',
      [gazType, selectedStationId, Ch, RHPH, Ph3]
    );

    await pool.query(
      'INSERT INTO calibration (param, station, cal_point, c, r, pressure) VALUES ($1, $2, \'HPL\', $3, $4, $5)',
      [gazType, selectedStationId, Ch, RHPL, Pl3]
    );
    

  } catch (err) {
    console.error('Erreur lors de la création des données de calibration:', err);
    res.status(500).send('Erreur du serveur');
  }
});

// Endpoint destiné à enregistrer une nouvelle station dans la table "station" de la base de données AEX en utilisant les données saisies par l'utilisateur.
app.post('/api/createStation', async (req, res) => {

  const { serial_nr, config, description, name_short, config_name } = req.body;

  console.log('Requête reçue pour créer une nouvelle station :', req.body);

  try {
    // Créer une nouvelle station avec un ID généré automatiquement par PostgreSQL
    const result = await pool.query(
      'INSERT INTO station (serial_nr, config, description, name_short, config_name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [serial_nr, config, description, name_short, config_name]
    );



    console.log('Nouvelle station créée avec succès :', result.rows[0]);
    res.json(result.rows[0]);

  } catch (err) {
    console.error('Erreur lors de la création de la station :', err);
    res.status(500).send('Erreur du serveur');
  }
});


app.listen(port, () => {
  console.log(`Le serveur fonctionne sur le port ${port}`);
});