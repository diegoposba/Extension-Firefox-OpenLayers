import { UIManager } from './ui.js';
import { MapManager } from './map.js';
import { RoutingMapManager } from './routing-map.js';

// --- CONFIGURATION ---
const ORS_API_KEY = '5b3ce3597851110001cf624830f2bffe4d7d45f6a9b4fb0648a945ec'; // <-- Remettez votre clé ici !

const ui = new UIManager();
const geolocMap = new MapManager('map', 'popup');
const routingMap = new RoutingMapManager('map');

// --- INITIALISATION ---
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  
  // Vérification au démarrage
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
      // On détruit PROPREMENT les instances de carte
      geolocMap.destroy();
      routingMap.destroy();
      
      // Retour à l'accueil
      ui.showHome();
    });
  });

  // 4. Events Permissions & UI
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

  // --- C'EST ICI QUE J'AVAIS OUBLIÉ CE BLOC ---
  // Gestion de la case à cocher en bas de la carte
  const checkAlways = document.getElementById('check-always-allow');
  if (checkAlways) {
    checkAlways.addEventListener('change', (e) => {
      if (e.target.checked) {
        // Si on coche -> on sauve "always"
        browser.storage.local.set({ geolocationPermission: 'always' });
      } else {
        // Si on décoche -> on supprime la permission du stockage
        browser.storage.local.remove('geolocationPermission');
      }
    });
  }
}

// --- MODES ---

async function launchGeolocMode(isAlways) {
  // On s'assure que le mode routing est éteint
  routingMap.destroy();
  
  ui.showGeolocMap(isAlways);
  
  try {
    await geolocMap.init(); 
    geolocMap.startTracking(
      (coords) => {
        const lonLat = ol.proj.toLonLat(coords);
        ui.updatePopup(`
          <h3>Votre position</h3>
          <p>Vous êtes ici !</p>
          <p><small>Lat: ${lonLat[1].toFixed(5)}, Lon: ${lonLat[0].toFixed(5)}</small></p>
        `);
      },
      (err) => ui.updatePopup(`<p>Erreur: ${err.message}</p>`)
    );
  } catch (e) {
    console.error(e);
    ui.updatePopup("<p>Erreur critique chargement carte.</p>");
  }
}

async function launchRoutingMode() {
  // On détruit le mode geoloc pour libérer les ressources
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
  const startCity = document.getElementById('input-start').value;
  const endCity = document.getElementById('input-end').value;

  if (!startCity || !endCity) {
    alert("Veuillez remplir les deux villes.");
    return;
  }

  ui.setLoading(true, "Calcul de l'itinéraire...");

  try {
    const startCoords = await geocodeCity(startCity);
    const endCoords = await geocodeCity(endCity);
    const routeGeoJSON = await getRoute(startCoords, endCoords);
    
    routingMap.displayRoute(routeGeoJSON);
    ui.setLoading(false);

  } catch (error) {
    console.error(error);
    ui.setLoading(false);
    alert("Erreur: " + error.message);
  }
}

async function geocodeCity(query) {
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(query)}&size=1`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Erreur geocoding");
  const data = await response.json();
  if (!data.features || data.features.length === 0) throw new Error(`Ville introuvable : ${query}`);
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