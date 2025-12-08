// Parser pour les capacités WMTS
const parser = new ol.format.WMTSCapabilities();

// URL du GetCapabilities de l'IGN
const capabilitiesUrl = 'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities';

// Récupérer les capacités et créer la carte
fetch(capabilitiesUrl)
  .then(response => response.text())
  .then(text => {
    const result = parser.read(text);
    
    // Générer automatiquement les options WMTS depuis les capacités
    const options = ol.source.WMTS.optionsFromCapabilities(result, {
      layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
      matrixSet: 'PM'
    });
    
    // Ajouter les attributions
    options.attributions = '© <a href="https://www.ign.fr/" target="_blank">IGN</a>';
    
    // Créer la source WMTS avec les options générées
    const wmtsSource = new ol.source.WMTS(options);
    
    const wmtsLayer = new ol.layer.Tile({
      source: wmtsSource
    });
    
    // Vue initiale centrée sur Paris par défaut
    const view = new ol.View({
      center: ol.proj.fromLonLat([2.3522, 48.8566]),
      zoom: 6
    });
    
    // Créer la carte
    const map = new ol.Map({
      target: 'map',
      layers: [wmtsLayer],
      view: view
    });
    
    // Créer une couche vectorielle pour le marqueur de position
    const positionFeature = new ol.Feature();
    positionFeature.setStyle(
      new ol.style.Style({
        image: new ol.style.Circle({
          radius: 8,
          fill: new ol.style.Fill({
            color: '#3399CC'
          }),
          stroke: new ol.style.Stroke({
            color: '#fff',
            width: 3
          })
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
    
    // Configurer la géolocalisation
    const geolocation = new ol.Geolocation({
      trackingOptions: {
        enableHighAccuracy: true
      },
      projection: view.getProjection()
    });
    
    // Activer le suivi de position
    geolocation.setTracking(true);
    
    // Gestion du popup
    const popup = document.getElementById('popup');
    const closer = document.getElementById('popup-closer');
    const popupContent = document.getElementById('popup-content');
    
    // Création d'un overlay pour le popup
    const overlay = new ol.Overlay({
      element: popup,
      positioning: 'bottom-center',
      stopEvent: false,
      offset: [0, -10]
    });
    
    map.addOverlay(overlay);
    
    // Fermer le popup au clic sur le bouton
    closer.onclick = function() {
      overlay.setPosition(undefined);
      closer.blur();
      return false;
    };
    
    // Écouter les changements de position
    geolocation.on('change:position', function() {
      const coordinates = geolocation.getPosition();
      
      if (coordinates) {
        // Mettre à jour la position du marqueur
        positionFeature.setGeometry(new ol.geom.Point(coordinates));
        
        // Animer le zoom vers la position de l'utilisateur
        view.animate({
          center: coordinates,
          zoom: 15,
          duration: 2000
        });
        
        // Positionner le popup sur la position de l'utilisateur
        overlay.setPosition(coordinates);
        
        // Mettre à jour le contenu du popup
        const lonLat = ol.proj.toLonLat(coordinates);
        popupContent.innerHTML = `
          <h3>Votre position</h3>
          <p>Vous êtes ici !</p>
          <p><small>Lat: ${lonLat[1].toFixed(5)}, Lon: ${lonLat[0].toFixed(5)}</small></p>
        `;
      }
    });
    
    // Gérer les erreurs de géolocalisation
    geolocation.on('error', function(error) {
      console.error('Erreur de géolocalisation:', error.message);
      
      // Afficher un message d'erreur dans le popup
      popupContent.innerHTML = `
        <h3>Erreur de géolocalisation</h3>
        <p>Impossible d'obtenir votre position.</p>
        <p><small>${error.message}</small></p>
      `;
      
      // Positionner le popup au centre de la vue par défaut (Paris)
      const parisCoords = ol.proj.fromLonLat([2.3522, 48.8566]);
      overlay.setPosition(parisCoords);
      
      // Centrer sur Paris en cas d'erreur
      view.animate({
        center: parisCoords,
        zoom: 12,
        duration: 1000
      });
    });
    
  })
  .catch(error => {
    console.error('Erreur lors du chargement des capacités WMTS:', error);
  });