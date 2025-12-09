export class UIManager {
  constructor() {
    this.screens = {
      home: document.getElementById('home-screen'),
      permission: document.getElementById('permission-screen'),
      mapWrapper: document.getElementById('map-wrapper')
    };

    // Sous-éléments du wrapper carte
    this.controls = {
      routing: document.getElementById('routing-controls'),
      footerGeoloc: document.getElementById('footer-controls')
    };

    this.loadingOverlay = document.getElementById('loading-overlay');
    this.loadingText = document.getElementById('loading-text');
    this.checkboxAlways = document.getElementById('check-always-allow');
    
    // Popup
    this.popupContainer = document.getElementById('popup');
    this.popupContent = document.getElementById('popup-content');
  }

  showHome() {
    this._hideAll();
    this.screens.home.style.display = 'flex';
  }

  showPermission() {
    this._hideAll();
    this.screens.permission.style.display = 'flex';
  }

  // Mode Géolocalisation
  showGeolocMap(isAlwaysAllowed) {
    this._hideAll();
    this.screens.mapWrapper.style.display = 'flex';
    
    // UI spécifique Geoloc
    this.controls.routing.style.display = 'none';
    this.controls.footerGeoloc.style.display = 'flex';
    
    this.checkboxAlways.checked = isAlwaysAllowed;
    this.setLoading(true, "Recherche position...");
  }

  // Mode Itinéraire
  showRoutingMap() {
    this._hideAll();
    this.screens.mapWrapper.style.display = 'flex';
    
    // UI spécifique Route
    this.controls.routing.style.display = 'flex';
    this.controls.footerGeoloc.style.display = 'none';
    
    this.setLoading(true, "Chargement carte...");
  }

  setLoading(isLoading, text = "Chargement...") {
    this.loadingOverlay.style.display = isLoading ? 'flex' : 'none';
    if(this.loadingText) this.loadingText.textContent = text;
  }

  updatePopup(htmlContent) {
    this.setLoading(false);
    this.popupContainer.style.display = 'block';
    this.popupContent.innerHTML = htmlContent;
  }

  _hideAll() {
    Object.values(this.screens).forEach(el => el.style.display = 'none');
  }

  displayRouteStats(distanceMeters, durationSeconds) {
    const statsDiv = document.getElementById('route-stats');
    
    // Conversion Distance
    let distStr = '';
    if (distanceMeters >= 1000) {
      distStr = (distanceMeters / 1000).toFixed(1) + ' km';
    } else {
      distStr = Math.round(distanceMeters) + ' m';
    }

    // Conversion Durée
    let timeStr = '';
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.round((durationSeconds % 3600) / 60);

    if (hours > 0) {
      timeStr = `${hours}h ${minutes}min`;
    } else {
      timeStr = `${minutes} min`;
    }

    statsDiv.style.display = 'block';
    statsDiv.innerHTML = `🏁 Distance : ${distStr} <br> ⏱️ Temps : ${timeStr}`;
  }

  clearRouteStats() {
    const statsDiv = document.getElementById('route-stats');
    if (statsDiv) {
      statsDiv.style.display = 'none';
      statsDiv.innerHTML = '';
    }
  }
}