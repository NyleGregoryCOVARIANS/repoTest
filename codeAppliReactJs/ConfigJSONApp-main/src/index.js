import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Importation du code css
import App from './App'; // Assurez-vous que le chemin est correct et que App est votre composant racine

/*
Le fichier index.js sert de point d'entrée principal, il initialise et monte l'application sur la page web.
*/

const root = ReactDOM.createRoot(document.getElementById('root'));

// Render l'application dans le mode strict de React
root.render(
  <React.StrictMode>
    <App /> {/* Affiche le composant App */}
  </React.StrictMode>
);
