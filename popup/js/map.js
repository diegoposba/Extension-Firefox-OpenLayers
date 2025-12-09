export class MapManager {
  constructor(targetId, popupId) {
    this.map = null;
    this.view = null;
    this.geolocation = null;
    this.overlay = null;
    
    // Features
    this.positionFeature = null;
    this.accuracyFeature = null;
    
    this.targetId = targetId;
    this.popupElement = document.getElementById(popupId);
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

      // 2. Map Setup
      this.view = new ol.View({
        center: ol.proj.fromLonLat([2.3522, 48.8566]),
        zoom: 6
      });

      this.map = new ol.Map({
        target: this.targetId,
        layers: [
          new ol.layer.Tile({ source: new ol.source.WMTS(options) })
        ],
        view: this.view
      });

      setTimeout(() => this.map.updateSize(), 200);

      // 3. Features (C'est ici qu'on remet votre style !)
      
      // Feature Cercle de Précision (Bleu transparent)
      this.accuracyFeature = new ol.Feature();
      this.accuracyFeature.setStyle(
        new ol.style.Style({
          fill: new ol.style.Fill({ color: 'rgba(51, 153, 204, 0.2)' }),    
          stroke: new ol.style.Stroke({ color: 'rgba(51, 153, 204, 0.7)', width: 2 })
        })
      );
      
      // Feature Point de Position (Point bleu solide)
      this.positionFeature = new ol.Feature();
      this.positionFeature.setStyle(
        new ol.style.Style({
          image: new ol.style.Circle({
            radius: 8,
            fill: new ol.style.Fill({ color: '#3399CC' }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 3 })
          })
        })
      );
      
      const vectorSource = new ol.source.Vector({
        features: [this.accuracyFeature, this.positionFeature] 
      });
      
      const vectorLayer = new ol.layer.Vector({
        source: vectorSource
      });
      this.map.addLayer(vectorLayer);

      // 4. Overlay
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

    if (this._lastChangeHandler) {
      this.geolocation.un('change:position', this._lastChangeHandler);
    }
    if (this._lastErrorHandler) {
      this.geolocation.un('error', this._lastErrorHandler);
    }

    this._lastChangeHandler = () => {
      const coords = this.geolocation.getPosition();
      // On utilise la méthode native d'OpenLayers pour avoir la bonne géométrie projetée
      const accuracyGeometry = this.geolocation.getAccuracyGeometry();
      
      if (coords) {
        // Mise à jour position
        this.positionFeature.setGeometry(new ol.geom.Point(coords));
        
        // Mise à jour cercle précision
        if (accuracyGeometry) {
          this.accuracyFeature.setGeometry(accuracyGeometry);
        }

        // Animation
        this.view.animate({ center: coords, zoom: 15, duration: 1000 });
        this.overlay.setPosition(coords);
        
        if (onPositionChange) onPositionChange(coords);
      }
    };

    this._lastErrorHandler = (err) => {
      console.warn("Erreur Geoloc OpenLayers:", err);
      const paris = ol.proj.fromLonLat([2.3522, 48.8566]);
      this.view.animate({ center: paris, zoom: 12, duration: 1000 });
      this.overlay.setPosition(paris);
      if (onError) onError(err);
    };

    this.geolocation.on('change:position', this._lastChangeHandler);
    this.geolocation.on('error', this._lastErrorHandler);

    this.geolocation.setTracking(true);

    const cachedCoords = this.geolocation.getPosition();
    if (cachedCoords) {
      this._lastChangeHandler();
    }
  }

  stopTracking() {
    if(this.geolocation) {
      this.geolocation.setTracking(false);
      // On nettoie aussi les listeners
      if (this._lastChangeHandler) this.geolocation.un('change:position', this._lastChangeHandler);
      if (this._lastErrorHandler) this.geolocation.un('error', this._lastErrorHandler);
    }
  }

  closePopup() {
    if (this.overlay) {
      this.overlay.setPosition(undefined);
    }
  }
}