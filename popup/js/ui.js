export class UIManager {
  constructor() {
    this.screens = {
      permission: document.getElementById('permission-screen'),
      denied: document.getElementById('denied-screen'),
      map: document.getElementById('map-container')
    };
    
    this.footer = document.getElementById('footer-controls');
    this.loadingOverlay = document.getElementById('loading-overlay');
    this.checkboxAlways = document.getElementById('check-always-allow');
    
    // Éléments Popup
    this.popupContainer = document.getElementById('popup');
    this.popupContent = document.getElementById('popup-content');
    this.popupCloser = document.getElementById('popup-closer');
  }

  showPermission() {
    this._hideAll();
    this.screens.permission.style.display = 'flex';
  }

  showDenied() {
    this._hideAll();
    this.screens.denied.style.display = 'flex';
  }

  showMap(isAlwaysAllowed) {
    this._hideAll();
    this.screens.map.style.display = 'block';
    this.footer.style.display = 'flex';
    this.checkboxAlways.checked = isAlwaysAllowed;
    
    // Réinitialiser l'état de chargement
    this.setLoading(true);
  }

  setLoading(isLoading) {
    this.loadingOverlay.style.display = isLoading ? 'flex' : 'none';
  }

  updatePopupContent(coordinates) {
    // Si on a des coordonnées, on arrête le chargement
    this.setLoading(false);
    this.popupContainer.style.display = 'block';

    const lonLat = ol.proj.toLonLat(coordinates);
    this.popupContent.innerHTML = `
      <h3>Votre position</h3>
      <p>Vous êtes ici !</p>
      <p><small>Lat: ${lonLat[1].toFixed(5)}, Lon: ${lonLat[0].toFixed(5)}</small></p>
    `;
  }

  showError(message) {
    this.setLoading(false);
    this.popupContainer.style.display = 'block';
    this.popupContent.innerHTML = `
      <h3>Erreur</h3>
      <p>Impossible de vous localiser.</p>
      <p><small>${message}</small></p>
    `;
  }

  _hideAll() {
    Object.values(this.screens).forEach(el => el.style.display = 'none');
    this.footer.style.display = 'none';
  }
}