/**
 * Menu Hebdo - Fonctions utilitaires
 * @description Helpers et fonctions utilitaires
 */

/**
 * Debounce une fonction
 * @param {Function} func - La fonction à debouncer
 * @param {number} wait - Le délai d'attente en ms
 * @returns {Function} - La fonction debouncée
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle une fonction
 * @param {Function} func - La fonction à throttler
 * @param {number} limit - L'intervalle minimum en ms
 * @returns {Function} - La fonction throttlée
 */
export function throttle(func, limit = 300) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Récupère le lundi d'une date donnée
 * @param {Date} date - La date de référence
 * @returns {Date} - Le lundi de la semaine
 */
export function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * Formate une plage de dates pour une semaine
 * @param {string} startDate - Date de début au format ISO
 * @returns {string} - Plage formatée (ex: "15 jan - 21 jan")
 */
export function formatDateRange(startDate) {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const options = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString('fr-FR', options)} - ${end.toLocaleDateString('fr-FR', options)}`;
}

/**
 * Formate une date au format ISO (YYYY-MM-DD)
 * @param {Date} date - La date à formater
 * @returns {string} - Date au format ISO
 */
export function formatDateISO(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

/**
 * Génère un ID unique
 * @returns {number} - ID basé sur le timestamp
 */
export function generateId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

/**
 * Capitalise la première lettre d'une chaîne
 * @param {string} str - La chaîne à capitaliser
 * @returns {string} - Chaîne capitalisée
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Nettoie une chaîne pour la recherche
 * @param {string} str - La chaîne à nettoyer
 * @returns {string} - Chaîne normalisée
 */
export function normalizeString(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Filtre un tableau d'objets par recherche textuelle
 * @param {Array} items - Les items à filtrer
 * @param {string} searchTerm - Le terme de recherche
 * @param {string[]} fields - Les champs à rechercher
 * @returns {Array} - Items filtrés
 */
export function filterBySearch(items, searchTerm, fields = ['name']) {
  if (!searchTerm) return items;

  const normalizedSearch = normalizeString(searchTerm);

  return items.filter(item => {
    return fields.some(field => {
      const value = item[field];
      if (!value) return false;
      return normalizeString(value.toString()).includes(normalizedSearch);
    });
  });
}

/**
 * Trie un tableau d'objets
 * @param {Array} items - Les items à trier
 * @param {string} field - Le champ de tri
 * @param {string} order - 'asc' ou 'desc'
 * @returns {Array} - Items triés
 */
export function sortItems(items, field, order = 'asc') {
  return [...items].sort((a, b) => {
    const aValue = a[field];
    const bValue = b[field];

    if (aValue === bValue) return 0;

    const comparison = aValue > bValue ? 1 : -1;
    return order === 'asc' ? comparison : -comparison;
  });
}

/**
 * Groupe un tableau d'objets par un champ
 * @param {Array} items - Les items à grouper
 * @param {string} field - Le champ de groupement
 * @returns {Object} - Objet avec les groupes
 */
export function groupBy(items, field) {
  return items.reduce((groups, item) => {
    const key = item[field];
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {});
}

/**
 * Copie du texte dans le presse-papiers
 * @param {string} text - Le texte à copier
 * @returns {Promise<boolean>} - Succès de l'opération
 */
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback pour navigateurs anciens
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  } catch (error) {
    console.error('Erreur lors de la copie:', error);
    return false;
  }
}

/**
 * Échappe les caractères HTML
 * @param {string} str - La chaîne à échapper
 * @returns {string} - Chaîne échappée
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Crée un élément DOM avec des attributs et du contenu
 * @param {string} tag - Le tag HTML
 * @param {Object} attributes - Les attributs
 * @param {string|Node|Node[]} content - Le contenu
 * @returns {HTMLElement} - L'élément créé
 */
export function createElement(tag, attributes = {}, content = null) {
  const element = document.createElement(tag);

  // Ajouter les attributs
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.substring(2).toLowerCase(), value);
    } else {
      element.setAttribute(key, value);
    }
  });

  // Ajouter le contenu
  if (content) {
    if (typeof content === 'string') {
      element.textContent = content;
    } else if (Array.isArray(content)) {
      content.forEach(child => {
        if (child instanceof Node) {
          element.appendChild(child);
        }
      });
    } else if (content instanceof Node) {
      element.appendChild(content);
    }
  }

  return element;
}

/**
 * Vérifie si un élément est visible dans le viewport
 * @param {HTMLElement} element - L'élément à vérifier
 * @returns {boolean} - Visibilité de l'élément
 */
export function isElementInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Scroll vers un élément de manière smooth
 * @param {HTMLElement|string} target - L'élément ou le sélecteur
 * @param {Object} options - Options de scroll
 */
export function scrollToElement(target, options = {}) {
  const element = typeof target === 'string' ? document.querySelector(target) : target;

  if (element) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      ...options
    });
  }
}

/**
 * Attend un délai
 * @param {number} ms - Délai en millisecondes
 * @returns {Promise} - Promise résolue après le délai
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Formate un nombre avec des séparateurs de milliers
 * @param {number} num - Le nombre à formater
 * @returns {string} - Nombre formaté
 */
export function formatNumber(num) {
  return new Intl.NumberFormat('fr-FR').format(num);
}

/**
 * Calcule le pourcentage
 * @param {number} value - La valeur
 * @param {number} total - Le total
 * @param {number} decimals - Nombre de décimales
 * @returns {number} - Pourcentage
 */
export function calculatePercentage(value, total, decimals = 0) {
  if (total === 0) return 0;
  return Number(((value / total) * 100).toFixed(decimals));
}

/**
 * Détecte si l'appareil est mobile
 * @returns {boolean} - true si mobile
 */
export function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Détecte si l'appareil supporte le touch
 * @returns {boolean} - true si touch supporté
 */
export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Clone profondément un objet
 * @param {*} obj - L'objet à cloner
 * @returns {*} - Clone de l'objet
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Mélange aléatoirement un tableau
 * @param {Array} array - Le tableau à mélanger
 * @returns {Array} - Tableau mélangé
 */
export function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Sélectionne un élément aléatoire d'un tableau
 * @param {Array} array - Le tableau
 * @returns {*} - Élément aléatoire
 */
export function randomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Vérifie si deux objets sont égaux (deep equality)
 * @param {*} obj1 - Premier objet
 * @param {*} obj2 - Deuxième objet
 * @returns {boolean} - Égalité
 */
export function deepEqual(obj1, obj2) {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}
