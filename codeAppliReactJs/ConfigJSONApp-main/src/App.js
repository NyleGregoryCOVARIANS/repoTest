import React, { useState, useEffect } from 'react'; // Importation de React et des hooks useState et useEffect
import './index.css'; // Importation du fichier CSS
import { JsonEditor } from 'json-edit-react'; // Importation de JsonEditor depuis la bibliothèque json-edit-react
import FormulaTable from './FormulaTable'; // Importation du composant FormulaTable
import axios from 'axios'; // Importation de la bibliothèque axios pour les requêtes HTTP


/*
La fonction App est le composant principal de l'application React.
Elle gère l'affichage, la modification, l'envoie, et le téléchargement de la configuration de la station sélectionnée par l'utilisateur.
Elle permet aussi de créez une nouvelle station en utilisant la configuration d'une station existante.
*/


export default function App() {

  // Déclaration des états de l'application
  const [configState, setConfigState] = useState(null); // État pour stocker les données JSON de la configuration actuelle.
  const [fileName, setFileName] = useState(""); // État pour stocker le nom du fichier JSON télécharger.
  const [stations, setStations] = useState([]); //  État pour stocker la liste des stations récupérées depuis le backend.
  const [selectedStationId, setSelectedStationId] = useState(''); // État pour stocker l'ID de la station actuellement sélectionnée.

  const [newStation, setNewStation] = useState({ // État en test
    serial_nr: '',
    description: '',
    name_short: '',
    config: '',
    station_id: ''
  });

  const [showForm, setShowForm] = useState(false);

  // A l'initialisation, stocke dans l'état "stations" toutes les données de la table station de la base AEX
  useEffect(() => {
    axios.get('http://localhost:5000/api/getStations')
      .then(response => {
        const Stations = response.data; 
        setStations(Stations);
      })
      .catch(error => console.error('Error fetching data:', error));
  }, []); 

  // Quand une station est sélectionnée dans le menu déroulant, stocke sa config dans l'état "configState"
  useEffect(() => {
    if (selectedStationId) {
      const stationIdNumber = parseInt(selectedStationId, 10); 
      const station = stations.find(station => station.station_id === stationIdNumber);
      if (station && station.config) {
        setConfigState(station.config);
      } else {
        console.error('Configuration non trouvée pour la station:', selectedStationId);
      }
    }
  }, [selectedStationId, stations]);

  // Quand Récupère le fichier séléctionné par l'utilisateur, le lit comme texte, le convertie en JSON et met à jour les états "configState" et "fileName"
  function handleFileUpload(event) {
    const file = event.target.files[0]; 
    if (file) {
      const reader = new FileReader(); 
      reader.onload = (e) => {
        try {
          setConfigState(JSON.parse(e.target.result));
          setFileName(file.name);
        } catch (error) {
          alert("Invalid JSON file."); 
        }
      };
      reader.readAsText(file); 
    }
  }

  // Met à jour l'état "configState" avec les nouvelles données JSON 
  function handleUpdate({ newData }) {
    setConfigState(newData);
  }

  // Quand le bouton "Save Json" est cliqué, télécharge le JSON sélectionné
  function handleSave() {
    const blob = new Blob([JSON.stringify(configState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'updated.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Met à jour l'ID de la station sélectionnée dans l'état "selectedStationId" 
  function handleSelectChange(event) {
    setSelectedStationId(event.target.value);
  }

  // Quand l'utilisateur clique sur le bouton "Upload to Database", envoie la config de la station sélectionnée au backend pour les sauvegarder dans la base de données AEXBASE
  function handleUploadToDatabase() {
    if (selectedStationId && configState) {
      axios.post(`http://localhost:5000/api/updateStation/${selectedStationId}`, configState)
        .then(response => {
          alert(`Station ${selectedStationId} uploaded successfully:`);
        })
        .catch(error => {
          alert(`Error uploading data:`, error);
        });
    } else {
      alert(`Please select a station and modify the data before uploading.`);
    }
  }

  // Quand l'utilisateur clique sur le bouton "Créer une nouvelle station" et remplit le formulaire, 
  // Crée une nouvelle station en utilisant la config d'une autre station et ajoute cette nouvelle station à la base de données AEXBASE et à l'état local.
  const handleCreateStation = async () => {
    const selectedStationConfig = stations.find(station => station.station_id === parseInt(newStation.config, 10)).config;
    const selectedConfigName = stations.find(station => station.station_id === parseInt(newStation.config, 10)).config_name;

    const newStationData = {
      serial_nr: newStation.serial_nr, 
      config: selectedStationConfig, 
      description: newStation.description,
      name_short: `{${newStation.name_short}}`, 
      config_name: selectedConfigName 
    };

    try {
      await axios.post('http://localhost:5000/api/createStation', newStationData);
      alert('New station created successfully');
      setShowForm(false);
      setStations([...stations, newStationData]);
    } catch (error) {
      alert('Error creating new station');
    }
  };

  return (
    <div>
      <h1>JSON Editor</h1>
      <p>
        Cette application vous permet de gérer vos fichiers JSON à travers une interface utilisateur intuitive.
        Voici les principales fonctionnalités qu'offre l'application :
      </p>

      <ul>

        <li><strong> Affichage des configurations : </strong> Visualisez facilement les configurations JSON des stations.</li>
        <li><strong> Modification des configurations : </strong> Modifiez les configurations des stations directement via l'interface utilisateur.</li>
        <li><strong> Envoi des configurations : </strong> Envoyez les configurations mises à jour à la base de données PostgreSQL nommée AEX.</li>
        <li><strong>Création de nouvelles stations : </strong> Créez une nouvelle station en utilisant la configuration d'une station existante.</li>
        <li><strong> Téléchargement de la configuration d'une station : </strong> Télécharge la configuration de la station sélectionnée par l'utilisateur.</li>

      </ul>
      <input type="file" accept=".json" onChange={handleFileUpload} />

      {configState && (
        <>
          <JsonEditor 
            data={configState}
            onUpdate={handleUpdate}
            theme={'default'}
            customNodeDefinitions={[ 
              {
                condition: ({ key }) => key === 'formulae',
                element: (props) => <FormulaTable {...props} selectedStationId={selectedStationId} />,
                showOnView: false,
                showOnEdit: true,
                name: 'Formula',
                showInTypesSelector: true,
                defaultValue: Array(4).fill(Array(5).fill('')),
              },
            ]}
          />
          <button onClick={handleSave}>Save JSON</button>
        </>
      )}

      <div className={selectedStationId ? 'fixed-position' : ''}> 
        <div className="vertical-align">
          <h2>Select Station ID</h2>
          <select
            className="select-style"
            value={selectedStationId}
            onChange={handleSelectChange}
          >
            <option value="">Select a station</option>
            {stations.map(station => (
              <option key={station.station_id} value={station.station_id}>
                {station.station_id} - {station.config_name}
              </option>
            ))}
          </select>
          <button onClick={handleUploadToDatabase}>Upload to Database</button>
          <button onClick={() => setShowForm(true)}>Créer une nouvelle station</button>

          {showForm && (
            <div className="form-container">
              <h2>Créer une nouvelle station</h2>
              <label>
                Serial Number:
                <input
                  type="number"
                  value={newStation.serial_nr}
                  onChange={(e) => setNewStation({ ...newStation, serial_nr: e.target.value })}
                />
              </label>
              <label>
                Description:
                <input
                  type="text"
                  value={newStation.description}
                  onChange={(e) => setNewStation({ ...newStation, description: e.target.value })}
                />
              </label>
              <label>
                Nom Court:
                <input
                  type="text"
                  value={newStation.name_short}
                  onChange={(e) => setNewStation({ ...newStation, name_short: e.target.value })}
                />
              </label>
              <label>
              Copier la configuration de la station:
                <select
                  value={newStation.config}
                  onChange={(e) => setNewStation({ ...newStation, config: e.target.value })}
                >
                  <option value="">Sélectionnez une station</option>
                  {stations.map((station) => (
                    <option key={station.station_id} value={station.station_id}>
                      {station.station_id} - {station.config_name}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={handleCreateStation}>Créer la station</button>
              <button onClick={() => setShowForm(false)}>Annuler</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
