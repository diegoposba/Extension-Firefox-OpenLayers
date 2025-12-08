import { UIManager } from './ui.js';
import { MapManager } from './map.js';

const ui = new UIManager();
const mapManager = new MapManager('map', 'popup');

// --- Initialisation ---

document.addEventListener('DOMContentLoaded', () => {
  // Vérification du stockage
  browser.storage.local.get(['geolocationPermission']).then((result) => {
    if (result.geolocationPermission === 'always') {
      launchMap(true);
    } else {
      ui.showPermission();
    }
  });
});

// --- Gestionnaires d'événements UI ---

document.getElementById('btn-always').addEventListener('click', () => {
  browser.storage.local.set({ geolocationPermission: 'always' });
  launchMap(true);
});

document.getElementById('btn-once').addEventListener('click', () => {
  browser.storage.local.remove('geolocationPermission');
  launchMap(false);
});

document.getElementById('btn-deny').addEventListener('click', () => {
  ui.showDenied();
});

document.getElementById('btn-back-menu').addEventListener('click', () => {
  ui.showPermission();
});

// Checkbox footer
document.getElementById('check-always-allow').addEventListener('change', (e) => {
  if (e.target.checked) {
    browser.storage.local.set({ geolocationPermission: 'always' });
  } else {
    browser.storage.local.remove('geolocationPermission');
  }
});

// Fermeture popup
document.getElementById('popup-closer').addEventListener('click', () => {
  mapManager.closePopup();
  document.getElementById('popup-closer').blur();
  return false;
});

// --- Logique Métier ---

async function launchMap(isAlways) {
  ui.showMap(isAlways);
  
  try {
    await mapManager.init();
    
    // Callbacks pour la géolocalisation
    mapManager.startTracking(
      (coords) => {
        // Succès : mise à jour UI
        ui.updatePopupContent(coords);
      },
      (error) => {
        // Erreur : affichage erreur UI
        console.error("Erreur Geoloc:", error);
        ui.showError(error.message);
      }
    );
  } catch (e) {
    ui.showError("Erreur critique lors du chargement de la carte.");
  }
}