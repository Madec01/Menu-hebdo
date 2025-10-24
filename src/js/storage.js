/**
 * Menu Hebdo - Gestion du stockage local
 * @description Gère le localStorage avec gestion d'erreurs robuste
 */

const STORAGE_KEY = 'menuData';
const THEME_KEY = 'menuTheme';
const PORTIONS_KEY = 'defaultPortions';

/**
 * Vérifie si le localStorage est disponible
 * @returns {boolean}
 */
export function isStorageAvailable() {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Sauvegarde les données dans le localStorage
 * @param {Object} data - Les données à sauvegarder
 * @returns {boolean} - Succès de l'opération
 */
export function saveData(data) {
  if (!isStorageAvailable()) {
    console.error('localStorage non disponible');
    return false;
  }

  try {
    const jsonData = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, jsonData);
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);

    // Si l'erreur est due à un quota dépassé
    if (error.name === 'QuotaExceededError') {
      alert('Espace de stockage saturé. Certaines données anciennes vont être supprimées.');
      // Ici on pourrait implémenter une logique de nettoyage
    }

    return false;
  }
}

/**
 * Charge les données depuis le localStorage
 * @returns {Object|null} - Les données chargées ou null en cas d'erreur
 */
export function loadData() {
  if (!isStorageAvailable()) {
    console.warn('localStorage non disponible');
    return null;
  }

  try {
    const jsonData = localStorage.getItem(STORAGE_KEY);
    if (!jsonData) {
      return null;
    }

    return JSON.parse(jsonData);
  } catch (error) {
    console.error('Erreur lors du chargement:', error);
    return null;
  }
}

/**
 * Supprime toutes les données
 * @returns {boolean} - Succès de l'opération
 */
export function clearData() {
  if (!isStorageAvailable()) {
    return false;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    return false;
  }
}

/**
 * Sauvegarde le thème
 * @param {string} theme - Le thème à sauvegarder
 */
export function saveTheme(theme) {
  if (isStorageAvailable()) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du thème:', error);
    }
  }
}

/**
 * Charge le thème
 * @returns {string} - Le thème chargé ou 'dark' par défaut
 */
export function loadTheme() {
  if (isStorageAvailable()) {
    try {
      return localStorage.getItem(THEME_KEY) || 'dark';
    } catch (error) {
      console.error('Erreur lors du chargement du thème:', error);
    }
  }
  return 'dark';
}

/**
 * Sauvegarde les portions par défaut
 * @param {number} portions - Le nombre de portions
 */
export function saveDefaultPortions(portions) {
  if (isStorageAvailable()) {
    try {
      localStorage.setItem(PORTIONS_KEY, portions.toString());
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des portions:', error);
    }
  }
}

/**
 * Charge les portions par défaut
 * @returns {number} - Le nombre de portions ou 2 par défaut
 */
export function loadDefaultPortions() {
  if (isStorageAvailable()) {
    try {
      const portions = localStorage.getItem(PORTIONS_KEY);
      return portions ? parseInt(portions, 10) : 2;
    } catch (error) {
      console.error('Erreur lors du chargement des portions:', error);
    }
  }
  return 2;
}

/**
 * Exporte les données en JSON pour téléchargement
 * @param {Object} data - Les données à exporter
 * @param {string} filename - Nom du fichier
 */
export function exportToFile(data, filename = 'menu-hebdo-export.json') {
  try {
    const jsonData = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'export:', error);
    return false;
  }
}

/**
 * Importe les données depuis un fichier JSON
 * @param {File} file - Le fichier à importer
 * @returns {Promise<Object>} - Les données importées
 */
export function importFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        resolve(data);
      } catch (error) {
        reject(new Error('Fichier JSON invalide'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Erreur lors de la lecture du fichier'));
    };

    reader.readAsText(file);
  });
}

/**
 * Calcule la taille des données stockées
 * @returns {string} - Taille formatée (ex: "150 Ko")
 */
export function getStorageSize() {
  if (!isStorageAvailable()) {
    return '0 o';
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY) || '';
    const sizeInBytes = new Blob([data]).size;

    if (sizeInBytes < 1024) {
      return `${sizeInBytes} o`;
    } else if (sizeInBytes < 1024 * 1024) {
      return `${(sizeInBytes / 1024).toFixed(2)} Ko`;
    } else {
      return `${(sizeInBytes / (1024 * 1024)).toFixed(2)} Mo`;
    }
  } catch (error) {
    console.error('Erreur lors du calcul de la taille:', error);
    return '? o';
  }
}
