export class MapManager {
  constructor(targetId, popupId) {
    this.targetId = targetId;
    this.popupElement = document.getElementById(popupId);
    
    // État initial vide
    this.map = null;
    this.view = null;
    this.geolocation = null;
    this.overlay = null;
    this.positionFeature = null;
    this.accuracyFeature = null;
    
    this.isInitialized = false;
    
    this._lastChangeHandler = null;
    this._lastErrorHandler = null;
  }

  async init() {
    if (this.isInitialized) return;

    try {
      // 1. WMTS Capabilities
      const response = await fetch('https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities');
      const text = await response.text();
      const parser = new ol.format.WMTSCapabilities();
      const result = parser.read(text);
      
      const options = ol.source.WMTS.optionsFromCapabilities(result, {
        layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
        matrixSet: 'PM'
      });
      options.attributions = '© <a href="https://www.ign.fr/" target="_blank">IGN</a>';

      // 2. Vue et Carte
      this.view = new ol.View({
        center: ol.proj.fromLonLat([2.3522, 48.8566]),
        zoom: 6
      });

      this.map = new ol.Map({
        target: this.targetId,
        layers: [new ol.layer.Tile({ source: new ol.source.WMTS(options) })],
        view: this.view
      });

      // Petit fix pour forcer l'affichage si la div était cachée
      setTimeout(() => { if(this.map) this.map.updateSize(); }, 200);

      // 3. Features
      
      // Feature CERCLE (Accuracy)
      this.accuracyFeature = new ol.Feature();
      // On applique le style directement ici
      this.accuracyFeature.setStyle(new ol.style.Style({
        fill: new ol.style.Fill({ color: 'rgba(51, 153, 204, 0.3)' }), // Un peu plus opaque (0.3)
        stroke: new ol.style.Stroke({ color: 'rgba(51, 153, 204, 0.8)', width: 2 })
      }));
      
      // Feature POINT (Position)
      this.positionFeature = new ol.Feature();
      this.positionFeature.setStyle(new ol.style.Style({
        image: new ol.style.Circle({
          radius: 8,
          fill: new ol.style.Fill({ color: '#3399CC' }),
          stroke: new ol.style.Stroke({ color: '#fff', width: 3 })
        })
      }));
      
      // Layer unique pour les deux
      const vectorLayer = new ol.layer.Vector({
        source: new ol.source.Vector({ features: [this.accuracyFeature, this.positionFeature] }),
        zIndex: 999
      });
      this.map.addLayer(vectorLayer);

      // 4. Overlay Popup
      this.overlay = new ol.Overlay({
        element: this.popupElement,
        positioning: 'bottom-center',
        stopEvent: false,
        offset: [0, -10]
      });
      this.map.addOverlay(this.overlay);

      // 5. Geolocation
      this.geolocation = new ol.Geolocation({
        trackingOptions: { enableHighAccuracy: true },
        projection: this.view.getProjection()
      });

      this.isInitialized = true;

    } catch (error) {
      console.error("Erreur init map:", error);
      throw error;
    }
  }

  startTracking(onPositionChange, onError) {
    if (!this.geolocation) return;

    // Nettoyage des vieux listeners
    if (this._lastChangeHandler) this.geolocation.un('change:position', this._lastChangeHandler);
    if (this._lastErrorHandler) this.geolocation.un('error', this._lastErrorHandler);

    this._lastChangeHandler = () => {
      const coords = this.geolocation.getPosition();
      // ON REVIENT À LA MÉTHODE MANUELLE (Chiffre en mètres)
      const accuracy = this.geolocation.getAccuracy(); 
      
      if (coords) {
        // 1. Mise à jour du Point
        this.positionFeature.setGeometry(new ol.geom.Point(coords));
        
        // 2. Mise à jour du Cercle (Méthode manuelle)
        // On crée un cercle géométrique centré sur coords avec le rayon accuracy
        if (accuracy) {
          this.accuracyFeature.setGeometry(new ol.geom.Circle(coords, accuracy));
        }

        // 3. Animation Vue
        this.view.animate({ center: coords, zoom: 15, duration: 1000 });
        this.overlay.setPosition(coords);
        
        if (onPositionChange) onPositionChange(coords);
      }
    };

    this._lastErrorHandler = (err) => {
      const paris = ol.proj.fromLonLat([2.3522, 48.8566]);
      this.view.animate({ center: paris, zoom: 12, duration: 1000 });
      if (onError) onError(err);
    };

    this.geolocation.on('change:position', this._lastChangeHandler);
    this.geolocation.on('error', this._lastErrorHandler);

    this.geolocation.setTracking(true);
    
    // Check cache
    const cached = this.geolocation.getPosition();
    if (cached) this._lastChangeHandler();
  }

  destroy() {
    if (this.geolocation) {
      this.geolocation.setTracking(false);
      this.geolocation.un('change:position', this._lastChangeHandler);
      this.geolocation.un('error', this._lastErrorHandler);
      this.geolocation = null;
    }

    if (this.map) {
      this.map.setTarget(null);
      this.map = null;
    }
    
    this.view = null;
    this.positionFeature = null;
    this.accuracyFeature = null;
    this.overlay = null;
    this.isInitialized = false;
  }

  stopTracking() {
    // Alias pour la compatibilité
    if(this.geolocation) this.geolocation.setTracking(false);
  }

  closePopup() {
    if (this.overlay) this.overlay.setPosition(undefined);
  }
}