export class RoutingMapManager {
  constructor(targetId) {
    this.targetId = targetId;
    this.map = null;
    this.view = null;
    this.routeLayer = null;
    this.isInitialized = false;
  }

  async init() {
    if (this.map) {
      this.map.setTarget(null);
      this.map = null;
    }

    // 1. WMTS IGN
    const response = await fetch('https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetCapabilities');
    const text = await response.text();
    const parser = new ol.format.WMTSCapabilities();
    const result = parser.read(text);
    
    const options = ol.source.WMTS.optionsFromCapabilities(result, {
      layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
      matrixSet: 'PM'
    });
    options.attributions = '© <a href="https://www.ign.fr/" target="_blank">IGN</a>';

    // 2. Vue centrée sur la France
    this.view = new ol.View({
      center: ol.proj.fromLonLat([2.2137, 46.2276]),
      zoom: 5
    });

    // 3. Création de la carte
    this.map = new ol.Map({
      target: this.targetId,
      layers: [
        new ol.layer.Tile({ source: new ol.source.WMTS(options) })
      ],
      view: this.view
    });

    // 4. Couche vectorielle pour l'itinéraire
    this.routeSource = new ol.source.Vector();
    this.routeLayer = new ol.layer.Vector({
      source: this.routeSource,
      style: this._getRouteStyle()
    });
    this.map.addLayer(this.routeLayer);

    this.isInitialized = true;
  }

  // Affiche le GeoJSON reçu d'OpenRouteService
  displayRoute(geoJson) {
    if (!this.map) return;
    this.routeSource.clear();

    // OpenRouteService renvoie du WGS84 (Lon, Lat). 
    // La carte est en WebMercator (EPSG:3857).
    // OpenLayers fait la conversion automatiquement si on précise featureProjection.
    const features = new ol.format.GeoJSON().readFeatures(geoJson, {
      featureProjection: 'EPSG:3857'
    });

    this.routeSource.addFeatures(features);

    // Zoomer pour voir tout l'itinéraire
    const extent = this.routeSource.getExtent();
    this.view.fit(extent, { 
      padding: [50, 50, 50, 50], 
      duration: 1000 
    });
  }

  // Style personnalisé : Ligne bleue épaisse, points Start/End
  _getRouteStyle() {
    return function(feature) {
      const geometry = feature.getGeometry();
      const styles = [];

      // Style de la ligne (Route)
      styles.push(new ol.style.Style({
        stroke: new ol.style.Stroke({
          color: '#218838',
          width: 5
        })
      }));
      
      return styles;
    };
  }

  // Nettoyage
  destroy() {
    if (this.map) {
      this.map.setTarget(null);
      this.map = null;
    }
    this.isInitialized = false;
  }
}