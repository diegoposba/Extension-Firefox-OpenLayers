export class AutocompleteManager {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.debounceTimer = null;
  }

  /**
   * Attache l'autocomplétion à un input
   * @param {string} inputId - ID de l'input
   * @param {string} listId - ID de la div de suggestions
   * @param {Function} onSelect - Callback quand l'utilisateur clique (renvoie coords + label)
   * @param {boolean} allowCurrentPos - Si true, ajoute "Ma position" en premier
   */
  attach(inputId, listId, onSelect, allowCurrentPos = false) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);

    // 1. Écouteur de frappe (Input)
    input.addEventListener('input', (e) => {
      const query = e.target.value;
      
      // Nettoyer l'ancien timer pour éviter de spammer l'API
      clearTimeout(this.debounceTimer);

      if (query.length < 3) {
        list.style.display = 'none';
        return;
      }

      // Attendre 300ms après la dernière frappe avant de chercher
      this.debounceTimer = setTimeout(() => {
        this._fetchSuggestions(query, list, input, onSelect);
      }, 300);
    });

    // 2. Gestion du focus pour afficher "Ma position" si vide
    if (allowCurrentPos) {
      input.addEventListener('focus', () => {
        if (input.value === '') {
          this._renderCurrentPositionOption(list, input, onSelect);
        }
      });
    }

    // 3. Cacher la liste si on clique ailleurs
    document.addEventListener('click', (e) => {
      if (e.target !== input && e.target !== list) {
        list.style.display = 'none';
      }
    });
  }

  // Affiche juste l'option "Ma position"
  _renderCurrentPositionOption(list, input, onSelect) {
    list.innerHTML = '';
    const item = document.createElement('div');
    item.className = 'suggestion-item current-location';
    item.innerHTML = `<span class="suggestion-icon">📍</span> Ma position actuelle`;
    
    item.addEventListener('click', () => {
      // On demande la position navigateur
      if ("geolocation" in navigator) {
        input.value = "Récupération en cours...";
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords = [pos.coords.longitude, pos.coords.latitude];
            input.value = "Ma position";
            list.style.display = 'none';
            onSelect(coords, "Ma position");
          },
          (err) => {
            alert("Erreur de géolocalisation : " + err.message);
            input.value = "";
          },
          { enableHighAccuracy: true }
        );
      }
    });

    list.appendChild(item);
    list.style.display = 'block';
  }

  async _fetchSuggestions(query, list, input, onSelect) {
    try {
      // Appel API OpenRouteService (Autocomplete)
      const url = `https://api.openrouteservice.org/geocode/autocomplete?api_key=${this.apiKey}&text=${encodeURIComponent(query)}&size=5`;
      const response = await fetch(url);
      const data = await response.json();

      list.innerHTML = ''; // Vider la liste

      if (!data.features || data.features.length === 0) {
        list.style.display = 'none';
        return;
      }

      // Créer les éléments de la liste
      data.features.forEach(feature => {
        const label = feature.properties.label;
        const coords = feature.geometry.coordinates; // [lon, lat]

        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `<span class="suggestion-icon">🌍</span> ${label}`;

        item.addEventListener('click', () => {
          input.value = label;
          list.style.display = 'none';
          onSelect(coords, label); // On renvoie les coordonnées direct !
        });

        list.appendChild(item);
      });

      list.style.display = 'block';

    } catch (error) {
      console.error("Erreur autocomplete:", error);
    }
  }
}