// Éléments du DOM
const permissionScreen = document.getElementById('permission-screen');
const deniedScreen = document.getElementById('denied-screen');
const mapContainer = document.getElementById('map-container');
const footerControls = document.getElementById('footer-controls');
const loadingOverlay = document.getElementById('loading-overlay');
const checkAlwaysAllow = document.getElementById('check-always-allow');

// Boutons
const btnAlways = document.getElementById('btn-always');
const btnOnce = document.getElementById('btn-once');
const btnDeny = document.getElementById('btn-deny');
const btnBackMenu = document.getElementById('btn-back-menu');

// Variables globales pour la carte
let map, view, positionFeature, overlay, geolocation;
let isMapInitialized = false;

// --- 1. Gestion du démarrage et du stockage ---

document.addEventListener('DOMContentLoaded', () => {
  // Vérifier si l'utilisateur a déjà donné une permission permanente
  browser.storage.local.get(['geolocationPermission']).then((result) => {
    if (result.geolocationPermission === 'always') {
      showMap(true); // true = mode "toujours"
    } else {
      showPermissionScreen();
    }
  });
});

// --- 2. Gestion des écrans ---

function showPermissionScreen() {
  permissionScreen.style.display = 'flex';
  deniedScreen.style.display = 'none';
  mapContainer.style.display = 'none';
  footerControls.style.display = 'none';
}

function showDeniedScreen() {
  permissionScreen.style.display = 'none';
  deniedScreen.style.display = 'flex';
  mapContainer.style.display = 'none';
  footerControls.style.display = 'none';
}

function showMap(isAlways) {
  permissionScreen.style.display = 'none';
  deniedScreen.style.display = 'none';
  mapContainer.style.display = 'block';
  footerControls.style.display = 'flex';
  
  // Mettre à jour la case à cocher en bas selon le mode actuel
  checkAlwaysAllow.checked = isAlways;

  // Lancer OpenLayers si ce n'est pas déjà fait
  if (!isMapInitialized) {
    initOpenLayers();
    isMapInitialized = true;
  } else {
    // Si la carte existe déjà, on relance juste le tracking
    geolocation.setTracking(true);
    loadingOverlay.style.display = 'flex'; // Réafficher le chargement
  }
}

// --- 3. Gestion des événements boutons ---

btnAlways.addEventListener('click', () => {
  // Sauvegarder le choix
  browser.storage.local.set({ geolocationPermission: 'always' });
  showMap(true);
});

btnOnce.addEventListener('click', () => {
  // S'assurer qu'on ne garde pas le choix "always" si c'était le cas avant (nettoyage)
  browser.storage.local.remove('geolocationPermission');
  showMap(false);
});

btnDeny.addEventListener('click', () => {
  showDeniedScreen();
});

btnBackMenu.addEventListener('click', () => {
  showPermissionScreen();
});

// Gestion du changement de la checkbox en bas de page
checkAlwaysAllow.addEventListener('change', (e) => {
  if (e.target.checked) {
    browser.storage.local.set({ geolocationPermission: 'always' });
  } else {
    browser.storage.local.remove('geolocationPermission');
  }
});

// --- 4. Logique OpenLayers (votre code original encapsulé et adapté) ---

function initOpenLayers() {
  // Parser pour les capacités WMTS
  const parser = new ol.format.WMTSCapabilities();

  // URL du GetCapabilities de l'IGN
  const capabilitiesUrl = 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities';

  fetch(capabilitiesUrl)
    .then(response => response.text())
    .then(text => {
      const result = parser.read(text);
      
      const options = ol.source.WMTS.optionsFromCapabilities(result, {
        layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
        matrixSet: 'PM'
      });
      
      options.attributions = '© <a href="https://www.ign.fr/" target="_blank">IGN</a>';
      
      const wmtsSource = new ol.source.WMTS(options);
      const wmtsLayer = new ol.layer.Tile({ source: wmtsSource });
      
      // Vue initiale centrée sur Paris (en attendant la géoloc)
      view = new ol.View({
        center: ol.proj.fromLonLat([2.3522, 48.8566]),
        zoom: 6
      });
      
      map = new ol.Map({
        target: 'map',
        layers: [wmtsLayer],
        view: view
      });
      
      // Feature pour la position
      positionFeature = new ol.Feature();
      positionFeature.setStyle(
        new ol.style.Style({
          image: new ol.style.Circle({
            radius: 8,
            fill: new ol.style.Fill({ color: '#3399CC' }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 3 })
          })
        })
      );
      
      const vectorSource = new ol.source.Vector({
        features: [positionFeature]
      });
      
      const vectorLayer = new ol.layer.Vector({
        source: vectorSource
      });
      
      map.addLayer(vectorLayer);
      
      // Configuration Géolocalisation
      geolocation = new ol.Geolocation({
        trackingOptions: { enableHighAccuracy: true },
        projection: view.getProjection()
      });
      
      // Overlay Popup
      const popupContainer = document.getElementById('popup');
      const closer = document.getElementById('popup-closer');
      const popupContent = document.getElementById('popup-content');
      
      overlay = new ol.Overlay({
        element: popupContainer,
        positioning: 'bottom-center',
        stopEvent: false,
        offset: [0, -10]
      });
      
      map.addOverlay(overlay);
      
      closer.onclick = function() {
        overlay.setPosition(undefined);
        closer.blur();
        return false;
      };
      
      // --- Écouteurs de la géolocalisation ---

      // Démarrer le suivi
      geolocation.setTracking(true);
      
      // Dès qu'on a une position
      geolocation.on('change:position', function() {
        const coordinates = geolocation.getPosition();
        
        if (coordinates) {
          // 1. Cacher le loader car on a trouvé la position
          loadingOverlay.style.display = 'none';
          
          // 2. Afficher la popup (maintenant qu'on a du contenu)
          popupContainer.style.display = 'block';

          positionFeature.setGeometry(new ol.geom.Point(coordinates));
          
          // Zoomer si c'est la première détection ou si on est loin (optionnel)
          // Ici on le fait à chaque changement significatif pour suivre l'utilisateur
          view.animate({
            center: coordinates,
            zoom: 15,
            duration: 1000
          });
          
          overlay.setPosition(coordinates);
          
          const lonLat = ol.proj.toLonLat(coordinates);
          popupContent.innerHTML = `
            <h3>Votre position</h3>
            <p>Vous êtes ici !</p>
            <p><small>Lat: ${lonLat[1].toFixed(5)}, Lon: ${lonLat[0].toFixed(5)}</small></p>
          `;
        }
      });
      
      geolocation.on('error', function(error) {
        console.error('Erreur de géolocalisation:', error.message);
        loadingOverlay.style.display = 'none'; // Cacher le loader même en erreur
        
        popupContainer.style.display = 'block';
        popupContent.innerHTML = `
          <h3>Erreur</h3>
          <p>Impossible de vous localiser.</p>
          <p><small>${error.message}</small></p>
        `;
        
        const parisCoords = ol.proj.fromLonLat([2.3522, 48.8566]);
        overlay.setPosition(parisCoords);
        view.animate({ center: parisCoords, zoom: 12, duration: 1000 });
      });

    })
    .catch(error => {
      console.error('Erreur chargement WMTS:', error);
      loadingOverlay.innerHTML = '<p style="color:red">Erreur de chargement de la carte.</p>';
    });
}