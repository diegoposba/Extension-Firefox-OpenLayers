import { UIManager } from './ui.js';
import { MapManager } from './map.js';

const ui = new UIManager();
const mapManager = new MapManager('map', 'popup');

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
  ui.showHome();
});

// --- MENU NAVIGATION ---

// Bouton 1: Ma Position -> Vérifie les perms puis lance la carte
document.getElementById('btn-mode-geoloc').addEventListener('click', () => {
  browser.storage.local.get(['geolocationPermission']).then((result) => {
    if (result.geolocationPermission === 'always') {
      launchGeolocMode(true);
    } else {
      ui.showPermission();
    }
  });
});

// Bouton 2: Itinéraire -> Affiche "Hello World"
document.getElementById('btn-mode-route').addEventListener('click', () => {
  ui.showHelloWorld();
});

// Boutons Retour (fonctionnent sur tous les écrans)
document.querySelectorAll('.btn-back-home').forEach(btn => {
  btn.addEventListener('click', () => {
    mapManager.stopTracking(); // On coupe le GPS quand on revient au menu
    ui.showHome();
  });
});

// --- LOGIQUE GEOLOCALISATION ---

// Choix Permission : Toujours
document.getElementById('btn-always').addEventListener('click', () => {
  browser.storage.local.set({ geolocationPermission: 'always' });
  launchGeolocMode(true);
});

// Choix Permission : Une fois
document.getElementById('btn-once').addEventListener('click', () => {
  // On efface le "always" s'il existait
  browser.storage.local.remove('geolocationPermission');
  launchGeolocMode(false);
});

// Choix Permission : Refuser
document.getElementById('btn-deny').addEventListener('click', () => {
  ui.showHome(); // Retour case départ
});

// Checkbox footer (pendant la navigation)
document.getElementById('check-always-allow').addEventListener('change', (e) => {
  if (e.target.checked) {
    browser.storage.local.set({ geolocationPermission: 'always' });
  } else {
    browser.storage.local.remove('geolocationPermission');
  }
});

// Fermeture popup carte
document.getElementById('popup-closer').addEventListener('click', () => {
  mapManager.closePopup();
  document.getElementById('popup-closer').blur();
  return false;
});

// Fonction de lancement de la carte
async function launchGeolocMode(isAlways) {
  ui.showMap(isAlways);
  
  try {
    await mapManager.init(); // On s'assure que OpenLayers est prêt
    
    mapManager.startTracking(
      (coords) => {
        // Succès : on met à jour le texte de la popup
        const lonLat = ol.proj.toLonLat(coords);
        ui.updatePopup(`
          <h3>Votre position</h3>
          <p>Vous êtes ici !</p>
          <p><small>Lat: ${lonLat[1].toFixed(5)}, Lon: ${lonLat[0].toFixed(5)}</small></p>
        `);
      },
      (error) => {
        // Erreur
        ui.updatePopup(`
          <h3>Erreur</h3>
          <p>Impossible de vous localiser.</p>
          <p><small>${error.message}</small></p>
        `);
      }
    );
  } catch (e) {
    console.error(e);
    ui.updatePopup("<p>Erreur critique de chargement.</p>");
  }
}