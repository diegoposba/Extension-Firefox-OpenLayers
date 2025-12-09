import { UIManager } from './ui.js';
import { MapManager } from './map.js';          // Gestionnaire Geoloc
import { RoutingMapManager } from './routing-map.js'; // Gestionnaire Route

// --- CONFIGURATION ---
const ORS_API_KEY = '5b3ce3597851110001cf624830f2bffe4d7d45f6a9b4fb0648a945ec'; // <-- Mettre la clé ici !

const ui = new UIManager();
const geolocMap = new MapManager('map', 'popup');
const routingMap = new RoutingMapManager('map');

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  
  // Vérification initiale (pour le mode "Toujours autoriser")
  browser.storage.local.get(['geolocationPermission']).then((result) => {
    if (result.geolocationPermission === 'always') {
      launchGeolocMode(true);
    } else {
      ui.showHome();
    }
  });
});

function setupEventListeners() {
  // 1. Boutons du Menu Principal
  const btnGeoloc = document.getElementById('btn-mode-geoloc');
  if (btnGeoloc) {
    btnGeoloc.addEventListener('click', () => {
      browser.storage.local.get(['geolocationPermission']).then((result) => {
        if (result.geolocationPermission === 'always') {
          launchGeolocMode(true);
        } else {
          ui.showPermission();
        }
      });
    });
  }

  const btnRoute = document.getElementById('btn-mode-route');
  if (btnRoute) {
    btnRoute.addEventListener('click', () => {
      launchRoutingMode();
    });
  }

  // 2. Bouton "Calculer" (Mode Itinéraire)
  const btnCalc = document.getElementById('btn-calculate');
  if (btnCalc) {
    btnCalc.addEventListener('click', handleRouteCalculation);
  }

  // 3. Boutons Retour
  document.querySelectorAll('.btn-back-home').forEach(btn => {
    btn.addEventListener('click', () => {
      // On nettoie tout avant de revenir
      geolocMap.stopTracking();
      // On détruit la carte active pour éviter les conflits
      if (geolocMap.map) geolocMap.map.setTarget(null); 
      if (routingMap.map) routingMap.map.setTarget(null);
      
      ui.showHome();
    });
  });

  // 4. Events Geoloc (Permission, Checkbox...)
  // ... (Garder les écouteurs existants pour btn-always, btn-once, etc.)
  document.getElementById('btn-always')?.addEventListener('click', () => {
    browser.storage.local.set({ geolocationPermission: 'always' });
    launchGeolocMode(true);
  });

  document.getElementById('btn-once')?.addEventListener('click', () => {
    browser.storage.local.remove('geolocationPermission');
    launchGeolocMode(false);
  });
}

// --- MODE GEOLOCALISATION ---
async function launchGeolocMode(isAlways) {
  // Nettoyer l'autre carte si elle existe
  routingMap.destroy();
  
  ui.showGeolocMap(isAlways);
  try {
    await geolocMap.init(); // Recrée la carte dans la div 'map'
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

// --- MODE ITINÉRAIRE ---
async function launchRoutingMode() {
  // Nettoyer la carte geoloc
  geolocMap.stopTracking();
  if (geolocMap.map) geolocMap.map.setTarget(null);

  ui.showRoutingMap();
  
  try {
    await routingMap.init(); // Crée la carte routing dans la div 'map'
    ui.setLoading(false);    // Carte prête, on cache le loader
  } catch (e) {
    console.error(e);
    ui.setLoading(false);
  }
}

// --- LOGIQUE API OPENROUTESERVICE ---

async function handleRouteCalculation() {
  const startCity = document.getElementById('input-start').value;
  const endCity = document.getElementById('input-end').value;

  if (!startCity || !endCity) {
    alert("Veuillez remplir les deux villes.");
    return;
  }

  ui.setLoading(true, "Calcul de l'itinéraire...");

  try {
    // 1. Géocodage
    const startCoords = await geocodeCity(startCity);
    const endCoords = await geocodeCity(endCity);

    // 2. Routing
    const routeGeoJSON = await getRoute(startCoords, endCoords);

    // 3. Affichage
    routingMap.displayRoute(routeGeoJSON);
    ui.setLoading(false);

  } catch (error) {
    console.error(error);
    ui.setLoading(false);
    alert("Erreur: " + error.message);
  }
}

async function geocodeCity(query) {
  // Documentation ORS: https://openrouteservice.org/dev/#/api-docs/geocode/search/get
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(query)}&size=1`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error("Erreur geocoding network");
  
  const data = await response.json();
  if (!data.features || data.features.length === 0) {
    throw new Error(`Ville introuvable : ${query}`);
  }
  
  return data.features[0].geometry.coordinates; // [lon, lat]
}

async function getRoute(startCoords, endCoords) {
  // Documentation ORS: https://openrouteservice.org/dev/#/api-docs/v2/directions/{profile}/get
  const startStr = `${startCoords[0]},${startCoords[1]}`;
  const endStr = `${endCoords[0]},${endCoords[1]}`;
  
  const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_API_KEY}&start=${startStr}&end=${endStr}`;
  
  const response = await fetch(url);
  const data = await response.json();

  if (data.error) throw new Error(data.error.message || "Erreur itinéraire");
  
  return data;
}