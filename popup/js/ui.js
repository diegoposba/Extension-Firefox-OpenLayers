export class UIManager {
  constructor() {
    this.screens = {
      home: document.getElementById('home-screen'),
      helloWorld: document.getElementById('hello-world-screen'),
      permission: document.getElementById('permission-screen'),
      mapWrapper: document.getElementById('map-wrapper')
    };

    this.loadingOverlay = document.getElementById('loading-overlay');
    this.checkboxAlways = document.getElementById('check-always-allow');
    
    // Popup Elements
    this.popupContainer = document.getElementById('popup');
    this.popupContent = document.getElementById('popup-content');
  }

  // --- NAVIGATION ---
  
  showHome() {
    this._hideAll();
    this.screens.home.style.display = 'flex';
  }

  showHelloWorld() {
    this._hideAll();
    this.screens.helloWorld.style.display = 'flex';
  }

  showPermission() {
    this._hideAll();
    this.screens.permission.style.display = 'flex';
  }

  showMap(isAlwaysAllowed) {
    this._hideAll();
    this.screens.mapWrapper.style.display = 'flex';
    this.checkboxAlways.checked = isAlwaysAllowed;
    
    // On affiche le chargement par défaut en entrant sur la carte
    this.setLoading(true);
  }

  // --- ETATS ---

  setLoading(isLoading) {
    this.loadingOverlay.style.display = isLoading ? 'flex' : 'none';
  }

  updatePopup(htmlContent) {
    this.setLoading(false); // Si on a du contenu, c'est qu'on a fini de charger
    this.popupContainer.style.display = 'block';
    this.popupContent.innerHTML = htmlContent;
  }

  _hideAll() {
    Object.values(this.screens).forEach(el => el.style.display = 'none');
  }
}