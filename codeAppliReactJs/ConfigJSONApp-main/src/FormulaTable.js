import React, { useState, useEffect } from 'react'; // Importation de React et des hooks useState et useEffect
import axios from 'axios'; // Importation de la bibliothèque axios

/*
La fonction FormulaTable est un composant react fils du composant App.
Elle s'éxecute uniquement quand l'utilisateur ouvre le noeud 'formulea'.
Elle est représentée par un tableau de dimension 4x4 et permet l'affichage, la création, la modification, et l'envoie des données des points d'étalonnages dans la table calibration de la base de données AEX.
*/

function FormulaTable({ value, setValue, isEditing, nodeData, setIsEditing, selectedStationId }) { // Déclaration du composant FormulaTable
  const [tableData, setTableData] = useState(Array(4).fill(Array(4).fill(''))); // État du tableau 4x4 qui gérera les données des points d'étalonnages.
  const gazName = nodeData.parentData.name; // Nom du gaz récupéré des données du nœud parent


// A l'initialisation, récupére les données de calibrations d'un gaz et d'une station, initialise et affiche les valeurs correspondantes dans le tableau.
  useEffect(() => {
    // Fonction qui récupére les données de calibrations d'un gaz à partir de son nom et de la station correspondante
    const fetchCalibrationData = async (gazName, selectedStationId) => {
      try {
        // Récupère les données de calibration pour un gaz et une station
        const response = await axios.get(`http://localhost:5000/api/getCalibrationData/${gazName}?selectedStationId=${selectedStationId}`);
        return response.data;
      } catch (error) {
        console.error('Error fetching calibration data:', error);
        return null;
      }
    };


    // Initialise les valeurs correspondantes dans le tableau
    const initializeTableData = async () => {
      try {
        if (value) { // Vérifie si une valeur est passée en prop
          const calibrationData = await fetchCalibrationData(gazName, selectedStationId); // récupération des donnéees de calibration de gazName
          if (calibrationData) {
            //Récupération des données - Ligne 1
            const C0 = parseFloat(calibrationData.find(row => row.cal_point === 'ZPH').c); 
            const RZPH = parseFloat(calibrationData.find(row => row.cal_point === 'ZPH').r);
            const Ph2 = parseFloat(calibrationData.find(row => row.cal_point === 'ZPH').pressure);

            //Récupération des données - Ligne 2
            const RZPL = parseFloat(calibrationData.find(row => row.cal_point === 'ZPL').r);
            const Pl2 = parseFloat(calibrationData.find(row => row.cal_point === 'ZPL').pressure);

            //Récupération des données - Ligne 3
            const CH = parseFloat(calibrationData.find(row => row.cal_point === 'HPH').c);
            const RHPH = parseFloat(calibrationData.find(row => row.cal_point === 'HPH').r);
            const Ph3 = parseFloat(calibrationData.find(row => row.cal_point === 'HPH').pressure);

            //Récupération des données - Ligne 4
            const RHPL = parseFloat(calibrationData.find(row => row.cal_point === 'HPL').r);
            const Pl3 = parseFloat(calibrationData.find(row => row.cal_point === 'HPL').pressure);

            // Initialise les données du tableau avec les valeurs récupérées
            const newData = [
              [C0, 0, RZPH, Ph2],
              [C0, 0, RZPL, Pl2],
              [CH, 0, RHPH, Ph3],
              [CH, 0, RHPL, Pl3]
            ];
            setTableData(newData);
          }
        }
      } catch (err) {// Gestion des erreurs
        console.error('An error occurred while displaying the cells:', err);
      }
    };
    
    initializeTableData(); // Lancement de la fonction si value ou gazName change

  }, [value, gazName, ]); // Effet exécuté lorsque les valeurs value ou gazName changent



  // Met à jour l'affichage des cellules à chaque modification de l'utilisateur
  function handleChange(rowIndex, colIndex, event) {
    const newTableData = tableData.map((row, rIdx) =>
      row.map((cell, cIdx) => (rIdx === rowIndex && cIdx === colIndex ? event.target.value : cell))
    );
    setTableData(newTableData);
  }



  // Vérifie les conditions des cellules, calcul la formule correspondante et stock le résultat dans l'état value
  async function handleSave() {

    // Vérifitions que les conditions sont remplies
    const allFilled = tableData.every(row => row.every(cell => cell !== '')); // bool : Vrai si toutes les cellules sont remplis, sinon faux
    const allFloats = tableData.every(row => row.every(cell => !isNaN(parseFloat(cell)) && isFinite(cell))); // bool : vrai si toutes les cellules sont des floats, sinon faux
    try {
      if (!allFilled) { // condition 1
        throw new Error('All cells must be filled');
      }

      if (!allFloats) { // condition 2
        throw new Error('All cells must be valid floats');
      }  

      if (tableData[0][0] !== tableData[1][0]) { // condition 3
        throw new Error('Cell [0][0] must be the same as cell [1][0]');
      }

      if (tableData[2][0] !== tableData[3][0]) { // condition 4
        throw new Error('Cell [2][0] must be the same as cell [3][0]');
      }
      

      // Calcul de la formule grace aux valeurs des cellules et stock le résultat dans l'état value
      const formula = await calculateFormula(gazName);
      setValue(formula);
      setIsEditing(false);
      alert('Formula has been saved');

    } catch (err) {
      console.error('An error occurred while saving the formula:', err);
      alert(err.message);
    }
  }



  // Récupére les données de calibrations et la formule du gaz depuis le serveur, puis parse la formule finale et stock le résultat dans finalFormula
  async function calculateFormula(gazName) {
    try {

      //Récupére les données de calibrations et la formule du gaz depuis le serveur
      const calibrationData = await updateOrCreateCalibrationData(gazName, selectedStationId);
      const formulaResponse = await axios.get(`http://localhost:5000/api/getFormulas/${gazName}`); // Récupération de la ligne contenant la formule de gazName dans la base de données
      const formulaTemplate = formulaResponse.data.formulae;

      // Parse la formule et stock le résultat dans parseFormula
      const finalFormula = await parseFormule(formulaTemplate, calibrationData, gazName); 

      return finalFormula;
    } 
    catch (error) { // Gestion des erreurs
      console.error('Error calculating formula:', error);
      throw new Error('Failed to calculate formula');
    }
  }



// Définit les opérateurs valides, parse et évalue la formule en remplaçant les variables par leurs valeurs.
async function parseFormule(formule, values, gazName) {

  // Ensemble des opérateurs reconnus
  const operators = new Set(['+', '-', '*', '/', '(', ')', '^', '**', ',', '[', ']']);
  const elements = [];
  let currentElement = ''; 

  // Parcourt chaque caractère de la formule
  for (let i = 0; i < formule.length; i++) {
    const char = formule[i]; 
    const nextChar = formule[i + 1];

    if (operators.has(char)) { 
      // On vérifie si c'est l'opérateur puissance **
      if (char === '*' && nextChar === '*') { 
        elements.push('**');
        i++; 
      } else {
        elements.push(char);
      }
    } else {
      currentElement += char; // Accumule les caractères pour former un élément
    }

    // Si l'élément en cours est terminé (le prochain caractère est un opérateur ou la fin de la chaîne)
    if (currentElement && (operators.has(nextChar) || i === formule.length - 1)) {
      elements.push(currentElement.trim()); // Ajoute l'élément à la liste après avoir supprimé les espaces
      currentElement = '';
    }
  }

  // Remplacement des variables par leurs valeurs
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];

    // Si l'élément n'est pas un opérateur, un nombre, un index de capteur ou une fonction Math
    if (!operators.has(el) && isNaN(el) && !el.startsWith('Math')) {
      if (values[el] !== undefined) {
        elements[i] = values[el];

      } else {
        try {
          // Récupère la formule ou la valeur de l'élément depuis le backend
          const response = await axios.get(`http://localhost:5000/api/getFormulas/${el}`);
          const variableValue = response.data.formulae;

          if (isFormula(variableValue)) { // Si la valeur récupérée est une formule
            const noEvaluateFormula = await parseFormule(variableValue, values, gazName);
            elements[i] = eval(noEvaluateFormula); // Évalue la formule après l'avoir parsée
          } else {
            elements[i] = variableValue; // Sinon, remplace par la valeur récupérée
          }
        } catch (err) {
          // Si ce n'est pas une formule, cherche l'index du capteur dans la configuration
          const sensorIndex = searchIndex(el);
          if (sensorIndex !== undefined) {
            elements[i] = `y[${sensorIndex}]`; // Remplace par y[index du capteur]
          } else {
            throw new Error(`Unrecognized element: ${el}`); // Erreur si l'élément n'est pas reconnu
          }
        }
      }
    } else if (el === 'Math.pow') {
      elements[i] = 'Math.pow'; // Conserve Math.pow tel quel
    }
  }

  return elements.join(' '); // Renvoie la formule finale en tant que chaîne
}



  // Fonction pour vérifier si une chaîne est une formule
  function isFormula(value) {
    return /[+\-*/()^]/.test(value);
  }

  // Vérifie si les points de calibration renseignés par l'utilisateur dans le tableau existent dans la base de données AEX, si oui alors on met à jour les données, sinon on les créer.
  async function updateOrCreateCalibrationData(gazName, selectedStationId) {
    const calibrationData = {
      C0: parseFloat(tableData[0][0]),
      Ch: parseFloat(tableData[2][0]),
      Ph: parseFloat(tableData[0][1]),
      Pl: parseFloat(tableData[1][1]),
      Ph1: parseFloat(tableData[2][1]),
      Pl1: parseFloat(tableData[3][1]),
      RZPH: parseFloat(tableData[0][2]),
      RZPL: parseFloat(tableData[1][2]),
      RHPH: parseFloat(tableData[2][2]),
      RHPL: parseFloat(tableData[3][2]),
      Ph2: parseFloat(tableData[0][3]),
      Pl2: parseFloat(tableData[1][3]),
      Ph3: parseFloat(tableData[2][3]),
      Pl3: parseFloat(tableData[3][3])
    };

    try {
      // Vérifie l'existence des points de calibration
      const existingPoints = await axios.get(`http://localhost:5000/api/getCalibrationData/${gazName}?selectedStationId=${selectedStationId}`);

      if (existingPoints.data.length > 0) {
        // Mise à jour des points de calibration existants
        await axios.post(`http://localhost:5000/api/updateCalibrationData/${gazName}?selectedStationId=${selectedStationId}`, calibrationData);
      } else {
        // Création des nouveaux points de calibration
        await axios.post(`http://localhost:5000/api/createCalibrationData/${gazName}?selectedStationId=${selectedStationId}`, calibrationData);
      }

      return calibrationData;

    } catch (error) {
      console.error('Error updating or creating calibration data:', error);
      throw new Error('Failed to update or create calibration data');
    }
  }

  // Cherche l'index du capteur dans la configuration
  function searchIndex(name) {
    const sensors = nodeData.fullData.sensors;
    let cmt = 0;
    try {
      for (const sensor of sensors) {
        if (sensor.name === name) {
          return cmt;
        }
        cmt++;
      }
    } catch (e) { // gestion des erreurs
      console.error(e);
    }
  }

  
  const rowHeaders = [
    "Point 0 P.amb",
    "Point 0 P.basse",
    "Point H P.amb",
    "Point H P.basse"
  ];
 
  return ( // Affichage du tableau de formule 
    <div>
      <h3>Calibration measurements for : {gazName}</h3>
      <table>
        <thead>
          <tr>
            <th className="rowHeaders"></th>
            {/*Nom des colonnes du tableau */}
            <th>C consigne (ppm)</th>
            <th>P consigne (mBar)</th>
            <th>C mesure brute (µA)</th>
            <th>P mesure (mBar)</th>
          </tr>
        </thead>
        <tbody>
          {tableData.map((row, rowIndex) => ( // Parcourt chaque ligne du tableau
            <tr key={rowIndex}>
              <td className="rowHeaders">{rowHeaders[rowIndex]}</td> {/* Ajoute un en-tête de ligne */}
              {row.map((cell, colIndex) => ( // Parcourt chaque cellule du tableau
                <td key={colIndex}>
                  <input
                    type="text"
                    value={cell}
                    onChange={(event) => handleChange(rowIndex, colIndex, event)} // Appelle handleChange en cas de changement du tableau
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button className="saveButton" onClick={handleSave}>Save Formula</button> {/* Appelle handleSave si on clique sur le bouton save */}
    </div>
  );
}

export default FormulaTable;