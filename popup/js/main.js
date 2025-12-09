import { UIManager } from './ui.js';
import { MapManager } from './map.js';
import { RoutingMapManager } from './routing-map.js';
import { AutocompleteManager } from './autocomplete.js';

// --- CONFIGURATION ---
const ORS_API_KEY = '5b3ce3597851110001cf624830f2bffe4d7d45f6a9b4fb0648a945ec';

const ui = new UIManager();
const geolocMap = new MapManager('map', 'popup');
const routingMap = new RoutingMapManager('map');
const autocomplete = new AutocompleteManager(ORS_API_KEY);

let selectedStartCoords = null;
let selectedEndCoords = null;
let currentProfile = 'driving-car'; 

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupAutocomplete();
  
  ui.showHome();
});

function setupAutocomplete() {
  autocomplete.attach('input-start', 'suggestions-start', (coords) => { selectedStartCoords = coords; }, true);
  autocomplete.attach('input-end', 'suggestions-end', (coords) => { selectedEndCoords = coords; }, false);
}

function setupEventListeners() {
  // Navigation Menus
  document.getElementById('btn-mode-geoloc')?.addEventListener('click', () => {
    browser.storage.local.get(['geolocationPermission']).then((r) => {
      if (r.geolocationPermission === 'always') launchGeolocMode(true);
      else ui.showPermission();
    });
  });

  document.getElementById('btn-mode-route')?.addEventListener('click', launchRoutingMode);

  document.getElementById('btn-calculate')?.addEventListener('click', handleRouteCalculation);

  // Boutons Retour
  document.querySelectorAll('.btn-back-home').forEach(btn => {
    btn.addEventListener('click', () => {
      geolocMap.destroy();
      routingMap.destroy();
      
      // Reset total
      document.getElementById('input-start').value = '';
      document.getElementById('input-end').value = '';
      selectedStartCoords = null;
      selectedEndCoords = null;
      ui.clearRouteStats(); 
      
      ui.showHome();
    });
  });

  // Permissions & Checkbox
  document.getElementById('btn-always')?.addEventListener('click', () => { browser.storage.local.set({ geolocationPermission: 'always' }); launchGeolocMode(true); });
  document.getElementById('btn-once')?.addEventListener('click', () => { browser.storage.local.remove('geolocationPermission'); launchGeolocMode(false); });
  document.getElementById('btn-deny')?.addEventListener('click', () => ui.showHome());
  document.getElementById('popup-closer')?.addEventListener('click', () => { geolocMap.closePopup(); document.getElementById('popup-closer').blur(); });
  const checkAlways = document.getElementById('check-always-allow');
  if (checkAlways) checkAlways.addEventListener('change', (e) => { if (e.target.checked) browser.storage.local.set({ geolocationPermission: 'always' }); else browser.storage.local.remove('geolocationPermission'); });

  // --- NOUVEAU : GESTION DES MODES DE TRANSPORT ---
  const modeBtns = document.querySelectorAll('.mode-btn');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      // 1. Gestion visuelle (classe .active)
      modeBtns.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');

      // 2. Mise à jour de la variable
      currentProfile = e.currentTarget.dataset.mode;
      console.log("Mode changé pour :", currentProfile);

      // 3. Recalcul automatique si les champs sont déjà remplis
      if (selectedStartCoords && selectedEndCoords) {
        handleRouteCalculation();
      }
    });
  });
}

// --- MODES ---
async function launchGeolocMode(isAlways) {
  routingMap.destroy();
  ui.showGeolocMap(isAlways);
  try { await geolocMap.init(); geolocMap.startTracking((c) => { const ll = ol.proj.toLonLat(c); ui.updatePopup(`<h3>Votre position</h3><p><small>Lat: ${ll[1].toFixed(5)}, Lon: ${ll[0].toFixed(5)}</small></p>`); }, (err) => ui.updatePopup(`<p>Erreur: ${err.message}</p>`)); } catch (e) { console.error(e); }
}

async function launchRoutingMode() {
  geolocMap.destroy();
  ui.showRoutingMap();
  try { await routingMap.init(); ui.setLoading(false); } catch (e) { console.error(e); ui.setLoading(false); }
}

// --- ROUTING LOGIC ---

async function handleRouteCalculation() {
  const startInput = document.getElementById('input-start').value;
  const endInput = document.getElementById('input-end').value;

  if (!startInput || !endInput) { alert("Veuillez remplir les champs."); return; }

  // Géocodage de secours si nécessaire
  if (!selectedStartCoords) {
    try { selectedStartCoords = await geocodeCity(startInput); } catch(e) { alert("Ville de départ introuvable."); return; }
  }
  if (!selectedEndCoords) {
    try { selectedEndCoords = await geocodeCity(endInput); } catch(e) { alert("Ville d'arrivée introuvable."); return; }
  }

  ui.setLoading(true, "Calcul de l'itinéraire...");
  ui.clearRouteStats(); 

  try {
    // On passe currentProfile à la fonction getRoute
    const data = await getRoute(selectedStartCoords, selectedEndCoords, currentProfile);
    
    // 1. Afficher la ligne
    routingMap.displayRoute(data);

    // 2. Afficher les stats 
    // ORS renvoie les stats dans features[0].properties.summary
    if (data.features && data.features.length > 0) {
      const summary = data.features[0].properties.summary;
      // summary.distance est en mètres, summary.duration en secondes
      ui.displayRouteStats(summary.distance, summary.duration);
    }

    ui.setLoading(false);
  } catch (error) {
    console.error(error);
    ui.setLoading(false);
    alert("Erreur: " + error.message);
  }
}

// --- API ---

async function geocodeCity(query) {
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(query)}&size=1`;
  const response = await fetch(url);
  const data = await response.json();
  if (!data.features || data.features.length === 0) throw new Error(`Introuvable : ${query}`);
  return data.features[0].geometry.coordinates;
}

// Mise à jour de getRoute pour accepter le profile
async function getRoute(startCoords, endCoords, profile) {
  const startStr = `${startCoords[0]},${startCoords[1]}`;
  const endStr = `${endCoords[0]},${endCoords[1]}`;
  
  // Utilisation dynamique du profil (driving-car, cycling-regular, foot-walking)
  const url = `https://api.openrouteservice.org/v2/directions/${profile}?api_key=${ORS_API_KEY}&start=${startStr}&end=${endStr}`;
  
  const response = await fetch(url);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "Erreur itinéraire");
  return data;
}