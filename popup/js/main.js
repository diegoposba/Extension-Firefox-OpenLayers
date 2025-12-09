import { UIManager } from './ui.js';
import { MapManager } from './map.js';
import { RoutingMapManager } from './routing-map.js';
import { AutocompleteManager } from './autocomplete.js'; // <-- Import

// --- CONFIGURATION ---
const ORS_API_KEY = '5b3ce3597851110001cf624830f2bffe4d7d45f6a9b4fb0648a945ec'; // <-- REMETTRE LA CLÉ ICI

const ui = new UIManager();
const geolocMap = new MapManager('map', 'popup');
const routingMap = new RoutingMapManager('map');
const autocomplete = new AutocompleteManager(ORS_API_KEY); // <-- Init

// Variables pour stocker les coordonnées sélectionnées
let selectedStartCoords = null;
let selectedEndCoords = null;

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupAutocomplete(); // <-- Configuration des inputs
  
  browser.storage.local.get(['geolocationPermission']).then((result) => {
    if (result.geolocationPermission === 'always') {
      launchGeolocMode(true);
    } else {
      ui.showHome();
    }
  });
});

function setupAutocomplete() {
  // Configurer l'input DÉPART
  autocomplete.attach(
    'input-start', 
    'suggestions-start', 
    (coords, label) => {
      selectedStartCoords = coords; // On sauvegarde les coords
      console.log("Départ choisi:", label, coords);
    },
    true // <-- TRUE = Activer "Ma position"
  );

  // Configurer l'input ARRIVÉE
  autocomplete.attach(
    'input-end', 
    'suggestions-end', 
    (coords, label) => {
      selectedEndCoords = coords; // On sauvegarde les coords
      console.log("Arrivée choisie:", label, coords);
    },
    false // Pas de "Ma position" pour l'arrivée (généralement)
  );
}

function setupEventListeners() {
  // Navigation
  document.getElementById('btn-mode-geoloc')?.addEventListener('click', () => {
    browser.storage.local.get(['geolocationPermission']).then((result) => {
      if (result.geolocationPermission === 'always') launchGeolocMode(true);
      else ui.showPermission();
    });
  });

  document.getElementById('btn-mode-route')?.addEventListener('click', launchRoutingMode);

  // Calcul Itinéraire
  document.getElementById('btn-calculate')?.addEventListener('click', handleRouteCalculation);

  // Retour
  document.querySelectorAll('.btn-back-home').forEach(btn => {
    btn.addEventListener('click', () => {
      geolocMap.destroy();
      routingMap.destroy();
      
      // Reset des inputs et variables
      document.getElementById('input-start').value = '';
      document.getElementById('input-end').value = '';
      selectedStartCoords = null;
      selectedEndCoords = null;
      
      ui.showHome();
    });
  });

  // Permissions & Checkbox
  document.getElementById('btn-always')?.addEventListener('click', () => {
    browser.storage.local.set({ geolocationPermission: 'always' });
    launchGeolocMode(true);
  });
  document.getElementById('btn-once')?.addEventListener('click', () => {
    browser.storage.local.remove('geolocationPermission');
    launchGeolocMode(false);
  });
  document.getElementById('btn-deny')?.addEventListener('click', () => ui.showHome());
  document.getElementById('popup-closer')?.addEventListener('click', () => {
    geolocMap.closePopup();
    document.getElementById('popup-closer').blur();
  });

  const checkAlways = document.getElementById('check-always-allow');
  if (checkAlways) {
    checkAlways.addEventListener('change', (e) => {
      if (e.target.checked) browser.storage.local.set({ geolocationPermission: 'always' });
      else browser.storage.local.remove('geolocationPermission');
    });
  }
}

// --- MODES ---
async function launchGeolocMode(isAlways) {
  routingMap.destroy();
  ui.showGeolocMap(isAlways);
  try {
    await geolocMap.init(); 
    geolocMap.startTracking(
      (coords) => {
        const lonLat = ol.proj.toLonLat(coords);
        ui.updatePopup(`
          <h3>Votre position</h3>
          <p><small>Lat: ${lonLat[1].toFixed(5)}, Lon: ${lonLat[0].toFixed(5)}</small></p>
        `);
      },
      (err) => ui.updatePopup(`<p>Erreur: ${err.message}</p>`)
    );
  } catch (e) {
    console.error(e);
  }
}

async function launchRoutingMode() {
  geolocMap.destroy();
  ui.showRoutingMap();
  try {
    await routingMap.init();
    ui.setLoading(false);
  } catch (e) {
    console.error(e);
    ui.setLoading(false);
  }
}

// --- ROUTING LOGIC ---

async function handleRouteCalculation() {
  // 1. Vérification : est-ce qu'on a bien sélectionné via la liste ?
  // Si l'utilisateur a tapé du texte sans cliquer sur une suggestion, les variables seront nulles.
  // Dans ce cas, on pourrait tenter un géocodage de secours, mais pour l'instant forçons la sélection.
  
  const startInputVal = document.getElementById('input-start').value;
  const endInputVal = document.getElementById('input-end').value;

  if (!startInputVal || !endInputVal) {
    alert("Veuillez remplir les champs.");
    return;
  }

  // Si l'utilisateur a tapé "Paris" mais n'a pas cliqué, on tente de le géocoder à la volée
  if (!selectedStartCoords) {
    try { selectedStartCoords = await geocodeCity(startInputVal); } 
    catch(e) { alert("Ville de départ introuvable. Veuillez sélectionner dans la liste."); return; }
  }

  if (!selectedEndCoords) {
    try { selectedEndCoords = await geocodeCity(endInputVal); } 
    catch(e) { alert("Ville d'arrivée introuvable. Veuillez sélectionner dans la liste."); return; }
  }

  ui.setLoading(true, "Calcul de l'itinéraire...");

  try {
    const routeGeoJSON = await getRoute(selectedStartCoords, selectedEndCoords);
    routingMap.displayRoute(routeGeoJSON);
    ui.setLoading(false);
  } catch (error) {
    console.error(error);
    ui.setLoading(false);
    alert("Erreur: " + error.message);
  }
}

// Fonction de secours (si on ne passe pas par l'autocomplete)
async function geocodeCity(query) {
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(query)}&size=1`;
  const response = await fetch(url);
  const data = await response.json();
  if (!data.features || data.features.length === 0) throw new Error(`Introuvable : ${query}`);
  return data.features[0].geometry.coordinates;
}

async function getRoute(startCoords, endCoords) {
  const startStr = `${startCoords[0]},${startCoords[1]}`;
  const endStr = `${endCoords[0]},${endCoords[1]}`;
  const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_API_KEY}&start=${startStr}&end=${endStr}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "Erreur itinéraire");
  return data;
}