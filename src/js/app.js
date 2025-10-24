/**
 * Menu Hebdo - Application principale
 * @description Application de planification de menus hebdomadaires
 * @version 2.0
 */

import { DEFAULT_INGREDIENTS, PREDEFINED_TAGS, SEASONAL_DATA, RAYON_LABELS, STATUS_LABELS, DAYS, MEALS } from './data.js';
import * as Storage from './storage.js';
import * as Utils from './utils.js';

class MenuApp {
  constructor() {
    // Données
    this.ingredients = [];
    this.recipes = [];
    this.weeks = [];
    this.availableTags = [...PREDEFINED_TAGS];
    this.customTags = [];
    this.customShoppingItems = [];
    this.seasonalData = SEASONAL_DATA;

    // État de l'application
    this.currentWeekId = null;
    this.currentCell = null;
    this.currentFilter = 'all';
    this.recipeSearchFilter = '';
    this.recipeTypeFilter = 'all';
    this.selectedRecipeIngredients = [];
    this.copiedMeal = null;
    this.confirmCallback = null;
    this.editIngredientId = null;
    this.editWeekId = null;
    this.newIngredientData = null;
    this.currentStatusCell = null;
    this.selectedStatus = null;
    this.currentSeasonalTab = 'legumes';
    this.seasonalSearchTerm = '';

    // Configuration
    this.defaultPortions = 2;
    this.defaultIngredients = Utils.deepClone(DEFAULT_INGREDIENTS);

    // Constantes
    this.rayonLabels = RAYON_LABELS;
    this.statusLabels = STATUS_LABELS;
    this.days = DAYS;
    this.meals = MEALS;
  }

  /**
   * Initialise l'application
   */
  init() {
    console.log('🚀 Initialisation de Menu Hebdo v2.0');

    // Charger les données
    this.loadData();

    // Charger les préférences
    this.loadTheme();
    this.defaultPortions = Storage.loadDefaultPortions();

    // Initialiser les ingrédients avec les types de portion
    this.initializeIngredients();

    // Créer une semaine par défaut si nécessaire
    if (this.weeks.length === 0) {
      this.createDefaultWeek();
    }

    // Attacher les gestionnaires d'événements
    this.attachEventListeners();

    // Rendre l'interface
    this.renderWeeksList();

    console.log('✅ Application initialisée');
  }

  /**
   * Initialise les ingrédients avec les champs manquants
   */
  initializeIngredients() {
    this.ingredients.forEach(ing => {
      if (ing.favorite === undefined) ing.favorite = false;
      if (ing.portionType === undefined) {
        // Déterminer le type par défaut
        const defaultIng = this.defaultIngredients.find(di => di.id === ing.id);
        if (defaultIng) {
          ing.portionType = defaultIng.portionType;
          ing.portionWeight = defaultIng.portionWeight;
        } else {
          ing.portionType = 'quantity';
          ing.portionWeight = null;
        }
      }
    });
  }

  /**
   * Crée une semaine par défaut
   */
  createDefaultWeek() {
    const today = new Date();
    const monday = Utils.getMonday(today);

    this.weeks.push({
      id: Utils.generateId(),
      name: 'Semaine en cours',
      startDate: Utils.formatDateISO(monday),
      portions: this.defaultPortions,
      menu: {},
      isCurrent: true
    });

    this.saveData();
  }

  /**
   * Charge les données depuis le localStorage
   */
  loadData() {
    const data = Storage.loadData();

    if (data) {
      // Charger les ingrédients seulement s'ils existent et ne sont pas vides
      if (data.ingredients && data.ingredients.length > 0) {
        this.ingredients = data.ingredients;
      } else {
        this.ingredients = Utils.deepClone(DEFAULT_INGREDIENTS);
      }

      this.recipes = data.recipes || [];
      this.weeks = data.weeks || [];
      this.customTags = data.customTags || [];
      this.customShoppingItems = data.customShoppingItems || [];
    } else {
      // Première utilisation
      this.ingredients = Utils.deepClone(DEFAULT_INGREDIENTS);
      this.saveData();
    }
  }

  /**
   * Sauvegarde les données
   */
  saveData() {
    const success = Storage.saveData({
      ingredients: this.ingredients,
      recipes: this.recipes,
      weeks: this.weeks,
      customTags: this.customTags,
      customShoppingItems: this.customShoppingItems
    });

    if (!success) {
      this.toast('Erreur lors de la sauvegarde', 'error');
    }
  }

  /**
   * Charge le thème
   */
  loadTheme() {
    const savedTheme = Storage.loadTheme();
    document.body.setAttribute('data-theme', savedTheme);

    // Mettre à jour les boutons
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === savedTheme);
    });
  }

  /**
   * Change le thème
   */
  changeTheme(theme) {
    document.body.setAttribute('data-theme', theme);

    // Mettre à jour les boutons
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });

    Storage.saveTheme(theme);
    this.toast('Thème changé ! 🎨', 'info');
  }

  /**
   * Affiche une notification toast
   */
  toast(message, type = 'success') {
    const icons = {
      success: '✅',
      error: '❌',
      info: 'ℹ️'
    };

    const toast = Utils.createElement('div', {
      className: `toast ${type}`
    }, [
      Utils.createElement('div', { className: 'toast-icon' }, icons[type] || icons.success),
      Utils.createElement('div', { className: 'toast-message' }, message)
    ]);

    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }

  /**
   * Affiche une boîte de dialogue de confirmation
   */
  confirm(title, message, callback) {
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-body').innerHTML = message;
    document.getElementById('confirm-modal').classList.add('active');
    this.confirmCallback = callback;
  }

  /**
   * Ferme la boîte de confirmation
   */
  closeConfirmModal(confirmed) {
    document.getElementById('confirm-modal').classList.remove('active');

    if (confirmed && this.confirmCallback) {
      this.confirmCallback();
    }

    this.confirmCallback = null;
  }

  /**
   * Attache les gestionnaires d'événements globaux
   */
  attachEventListeners() {
    // Fermer les popups en cliquant à l'extérieur
    document.addEventListener('click', (e) => {
      if (this.currentCell && !e.target.closest('.meal-cell')) {
        this.closeCurrentInput();
      }
    });

    // Empêcher le scroll sur les modales
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('wheel', (e) => {
        e.stopPropagation();
      });
    });
  }

  /**
   * Affiche une vue
   */
  showView(viewName) {
    // Masquer toutes les vues
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    // Désactiver tous les boutons de navigation
    document.querySelectorAll('.nav-buttons button').forEach(b => b.classList.remove('active'));

    // Afficher la vue demandée
    const view = document.getElementById(`${viewName}-view`);
    if (view) {
      view.classList.add('active');
    }

    // Activer le bouton correspondant
    const activeButton = Array.from(document.querySelectorAll('.nav-buttons button'))
      .find(btn => btn.onclick && btn.onclick.toString().includes(viewName));

    if (activeButton) {
      activeButton.classList.add('active');
    }

    // Actions spécifiques par vue
    switch (viewName) {
      case 'recipes':
        this.renderRecipeIngredientSelector();
        this.renderTagsSelector();
        this.renderRecipesList();
        break;
      case 'weeks':
        this.renderWeeksList();
        break;
      case 'ingredients':
        this.renderIngredientsList();
        break;
      case 'settings':
        this.initSettingsView();
        break;
    }
  }

  /**
   * Initialise la vue des paramètres
   */
  initSettingsView() {
    const input = document.getElementById('default-portions-input');
    if (input) {
      input.value = this.defaultPortions;
    }

    const countElem = document.getElementById('ingredient-count');
    if (countElem) {
      countElem.textContent = this.ingredients.length;
    }
  }

  /**
   * Met à jour les portions par défaut
   */
  updateDefaultPortions() {
    const input = document.getElementById('default-portions-input');
    if (input) {
      this.defaultPortions = parseInt(input.value, 10) || 2;
      Storage.saveDefaultPortions(this.defaultPortions);
      this.toast('Portions par défaut mises à jour !');
    }
  }

  /**
   * Réinitialise les ingrédients aux valeurs par défaut
   */
  resetIngredientsToDefault() {
    this.confirm(
      'Réinitialiser ?',
      `Êtes-vous sûr de vouloir remplacer tous vos ingrédients actuels (${this.ingredients.length}) par les 166 ingrédients par défaut ?`,
      () => {
        this.ingredients = Utils.deepClone(DEFAULT_INGREDIENTS);
        this.saveData();
        this.renderIngredientsList();

        const countElem = document.getElementById('ingredient-count');
        if (countElem) {
          countElem.textContent = this.ingredients.length;
        }

        this.toast(`Base de données réinitialisée ! ${this.ingredients.length} ingrédients`);
      }
    );
  }

  // ==================== GESTION DES SEMAINES ====================

  /**
   * Rend la liste des semaines
   */
  renderWeeksList() {
    const container = document.getElementById('weeks-list');
    if (!container) return;

    container.innerHTML = '';

    // Rendre les cartes de semaines
    this.weeks.forEach(week => {
      const card = this.createWeekCard(week);
      container.appendChild(card);
    });

    // Ajouter la carte "Créer une semaine"
    container.appendChild(this.createAddWeekCard());
  }

  /**
   * Crée une carte de semaine
   */
  createWeekCard(week) {
    const mealCount = Object.keys(week.menu || {}).length;
    const card = Utils.createElement('div', {
      className: `week-card${week.isCurrent ? ' current' : ''}`,
      onclick: () => this.openWeek(week.id)
    }, [
      Utils.createElement('div', { className: 'week-title' }, week.name),
      Utils.createElement('div', { className: 'week-dates' }, Utils.formatDateRange(week.startDate)),
      Utils.createElement('div', { style: 'color:var(--text-2);margin-bottom:10px' }, `🍽️ ${mealCount} repas`),
      this.createWeekActions(week.id)
    ]);

    return card;
  }

  /**
   * Crée les actions d'une carte de semaine
   */
  createWeekActions(weekId) {
    return Utils.createElement('div', { className: 'week-actions' }, [
      Utils.createElement('button', {
        className: 'btn-edit',
        onclick: (e) => {
          e.stopPropagation();
          this.editWeek(weekId);
        }
      }, '✏️ Modifier'),
      Utils.createElement('button', {
        className: 'btn-delete',
        onclick: (e) => {
          e.stopPropagation();
          this.deleteWeek(weekId);
        }
      }, '🗑️ Supprimer')
    ]);
  }

  /**
   * Crée la carte "Ajouter une semaine"
   */
  createAddWeekCard() {
    return Utils.createElement('div', {
      className: 'week-card add-week-card',
      onclick: () => this.showWeekModal()
    }, [
      Utils.createElement('div', { className: 'add-week-icon' }, '➕'),
      Utils.createElement('div', {}, Utils.createElement('strong', {}, 'Créer une semaine'))
    ]);
  }

  /**
   * Affiche la modale de création/édition de semaine
   */
  showWeekModal(weekId = null) {
    this.editWeekId = weekId;

    const modal = document.getElementById('week-modal');
    const titleElem = document.getElementById('week-modal-title');
    const nameInput = document.getElementById('week-name-input');
    const dateInput = document.getElementById('week-start-input');

    if (weekId) {
      const week = this.weeks.find(w => w.id === weekId);
      if (week) {
        titleElem.textContent = 'Modifier la semaine';
        nameInput.value = week.name;
        dateInput.value = week.startDate;
      }
    } else {
      titleElem.textContent = 'Créer une semaine';
      nameInput.value = '';

      // Définir la date du prochain lundi
      const nextMonday = Utils.getMonday(new Date());
      nextMonday.setDate(nextMonday.getDate() + 7);
      dateInput.value = Utils.formatDateISO(nextMonday);
    }

    modal.classList.add('active');
  }

  /**
   * Ferme la modale de semaine
   */
  closeWeekModal(save) {
    const modal = document.getElementById('week-modal');
    modal.classList.remove('active');

    if (save) {
      const name = document.getElementById('week-name-input').value.trim();
      const startDate = document.getElementById('week-start-input').value;

      if (!name || !startDate) {
        this.toast('Veuillez remplir tous les champs', 'error');
        return;
      }

      if (this.editWeekId) {
        // Modifier une semaine existante
        const week = this.weeks.find(w => w.id === this.editWeekId);
        if (week) {
          week.name = name;
          week.startDate = startDate;
          this.toast('Semaine modifiée !');
        }
      } else {
        // Créer une nouvelle semaine
        this.weeks.push({
          id: Utils.generateId(),
          name,
          startDate,
          portions: this.defaultPortions,
          menu: {},
          isCurrent: false
        });
        this.toast('Semaine créée !');
      }

      this.saveData();
      this.renderWeeksList();
    }

    this.editWeekId = null;
  }

  /**
   * Édite une semaine
   */
  editWeek(weekId) {
    this.showWeekModal(weekId);
  }

  /**
   * Supprime une semaine
   */
  deleteWeek(weekId) {
    const week = this.weeks.find(w => w.id === weekId);
    if (!week) return;

    this.confirm(
      'Supprimer la semaine ?',
      `La semaine "${week.name}" sera définitivement supprimée.`,
      () => {
        this.weeks = this.weeks.filter(w => w.id !== weekId);
        this.saveData();
        this.renderWeeksList();
        this.toast('Semaine supprimée');
      }
    );
  }

  /**
   * Ouvre une semaine pour l'éditer
   */
  openWeek(weekId) {
    this.currentWeekId = weekId;
    const week = this.weeks.find(w => w.id === weekId);

    if (!week) {
      this.toast('Semaine introuvable', 'error');
      return;
    }

    // Mettre à jour le titre
    document.getElementById('current-week-title').textContent =
      `${week.name} - ${Utils.formatDateRange(week.startDate)}`;

    // Afficher la vue du menu
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('menu-view').classList.add('active');

    // Rendre le menu
    this.renderMenu();
  }

  /**
   * Ouvre la semaine en cours
   */
  openCurrentWeek() {
    const currentWeek = this.weeks.find(w => w.isCurrent);
    const week = currentWeek || this.weeks[0];

    if (week) {
      this.openWeek(week.id);
    } else {
      this.toast('Aucune semaine disponible. Créez-en une !', 'error');
      this.showView('weeks');
    }
  }

  /**
   * Retour à la liste des semaines
   */
  backToWeeks() {
    this.currentWeekId = null;
    this.showView('weeks');
  }

  /**
   * Récupère la semaine en cours
   */
  getWeek() {
    return this.weeks.find(w => w.id === this.currentWeekId);
  }

  // ==================== GESTION DU MENU ====================

  /**
   * Rend le menu de la semaine
   */
  renderMenu() {
    const week = this.getWeek();
    if (!week) return;

    const tbody = document.getElementById('menu-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    this.days.forEach(day => {
      const row = Utils.createElement('tr');

      // Cellule du jour
      row.appendChild(Utils.createElement('td', { className: 'day-header' }, day));

      // Cellules des repas
      this.meals.forEach(meal => {
        const cell = this.createMealCell(day, meal, week);
        row.appendChild(cell);
      });

      tbody.appendChild(row);
    });
  }

  /**
   * Crée une cellule de repas
   */
  createMealCell(day, meal, week) {
    const key = `${day}-${meal}`;
    const mealData = week.menu[key] || { ingredients: [], recipes: [] };

    const cell = Utils.createElement('td', {
      className: 'meal-cell',
      dataset: { day, meal },
      onclick: () => this.openInputForCell(cell)
    });

    // Ajouter les actions
    cell.appendChild(this.createCellActions(day, meal));

    // Badge de portions personnalisées
    if (mealData.portions && mealData.portions !== week.portions) {
      const badge = Utils.createElement('div', {
        className: 'portion-badge',
        onclick: (e) => {
          e.stopPropagation();
          this.showPortionPopup(day, meal, badge, e);
        }
      }, `${mealData.portions}👤`);
      cell.appendChild(badge);
    }

    // Vérifier le statut du repas
    if (mealData.status && mealData.status !== 'normal') {
      cell.className += ` meal-status-${mealData.status}`;
      const statusLabel = Utils.createElement('div', {
        className: 'meal-status-label'
      }, this.statusLabels[mealData.status] || mealData.status);
      cell.appendChild(statusLabel);
    }

    // Tags des recettes et ingrédients
    const tags = Utils.createElement('div', { className: 'ingredient-tags' });

    // Ajouter les recettes
    if (mealData.recipes) {
      mealData.recipes.forEach(recipeId => {
        const recipe = this.recipes.find(r => r.id === recipeId);
        if (recipe) {
          const tag = this.createRecipeTag(recipe, day, meal);
          tags.appendChild(tag);
        }
      });
    }

    // Ajouter les ingrédients
    if (mealData.ingredients) {
      mealData.ingredients.forEach(ingId => {
        const ing = this.ingredients.find(i => i.id === ingId);
        if (ing) {
          const tag = this.createIngredientTag(ing, day, meal);
          tags.appendChild(tag);
        }
      });
    }

    cell.appendChild(tags);

    // Input d'autocomplete
    cell.appendChild(this.createInputContainer(day, meal));

    return cell;
  }

  /**
   * Crée les actions d'une cellule de repas
   */
  createCellActions(day, meal) {
    const actions = Utils.createElement('div', { className: 'cell-actions' });

    const buttons = [
      { icon: '👤', title: 'Portions', action: (e) => this.showPortionPopup(day, meal, e.target, e) },
      { icon: '🏠', title: 'Statut', action: (e) => { e.stopPropagation(); this.showStatusModal(day, meal); } },
      { icon: '📋', title: 'Copier', action: (e) => { e.stopPropagation(); this.copyMeal(day, meal); } },
      { icon: '📄', title: 'Coller', action: (e) => { e.stopPropagation(); this.pasteMeal(day, meal); } },
      { icon: '🗑️', title: 'Vider', action: (e) => { e.stopPropagation(); this.clearMeal(day, meal); } },
      { icon: '🎲', title: 'Aléatoire', action: (e) => { e.stopPropagation(); this.generateRandomMeal(day, meal); } }
    ];

    buttons.forEach(btn => {
      const button = Utils.createElement('button', {
        className: 'cell-btn',
        title: btn.title,
        onclick: btn.action
      }, btn.icon);
      actions.appendChild(button);
    });

    return actions;
  }

  /**
   * Crée un tag d'ingrédient
   */
  createIngredientTag(ingredient, day, meal) {
    return Utils.createElement('span', {
      className: `ingredient-tag type-${ingredient.type}`,
      onclick: (e) => {
        e.stopPropagation();
        this.removeIngredientFromMeal(day, meal, ingredient.id);
      }
    }, ingredient.name);
  }

  /**
   * Crée un tag de recette
   */
  createRecipeTag(recipe, day, meal) {
    return Utils.createElement('span', {
      className: 'recipe-tag',
      onclick: (e) => {
        e.stopPropagation();
        this.removeRecipeFromMeal(day, meal, recipe.id);
      }
    }, `📖 ${recipe.name}`);
  }

  /**
   * Crée le conteneur d'input avec autocomplete
   */
  createInputContainer(day, meal) {
    const container = Utils.createElement('div', {
      className: 'input-container',
      onclick: (e) => e.stopPropagation()
    });

    const input = Utils.createElement('input', {
      type: 'text',
      className: 'ingredient-input',
      placeholder: 'Ajouter un ingrédient ou une recette...'
    });

    const autocompleteList = Utils.createElement('div', {
      className: 'autocomplete-list'
    });

    container.appendChild(input);
    container.appendChild(autocompleteList);

    return container;
  }

  /**
   * Ouvre l'input pour une cellule
   */
  openInputForCell(cell) {
    // Fermer l'input précédent
    if (this.currentCell && this.currentCell !== cell) {
      this.closeCurrentInput();
    }

    this.currentCell = cell;
    cell.classList.add('has-popup');

    const container = cell.querySelector('.input-container');
    const input = cell.querySelector('.ingredient-input');

    container.classList.add('active');
    input.focus();

    // Setup de l'autocomplete
    this.setupAutocomplete(cell, input);
  }

  /**
   * Ferme l'input actuel
   */
  closeCurrentInput() {
    if (this.currentCell) {
      this.currentCell.classList.remove('has-popup');
      const container = this.currentCell.querySelector('.input-container');
      const input = this.currentCell.querySelector('.ingredient-input');
      const list = this.currentCell.querySelector('.autocomplete-list');

      container.classList.remove('active');
      input.value = '';
      list.innerHTML = '';

      this.currentCell = null;
    }
  }

  /**
   * Configure l'autocomplete pour un input
   */
  setupAutocomplete(cell, input) {
    const list = cell.querySelector('.autocomplete-list');
    const day = cell.dataset.day;
    const meal = cell.dataset.meal;

    // Debounce de la recherche
    const handleInput = Utils.debounce(() => {
      const value = input.value.toLowerCase().trim();
      list.innerHTML = '';

      if (value.length === 0) return;

      // Rechercher dans les recettes
      const matchedRecipes = this.recipes.filter(r =>
        r.name.toLowerCase().includes(value)
      );

      // Rechercher dans les ingrédients
      const matchedIngredients = Utils.filterBySearch(
        this.ingredients,
        value,
        ['name']
      ).sort((a, b) => {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return a.name.localeCompare(b.name);
      });

      // Afficher les recettes
      if (matchedRecipes.length > 0) {
        const header = Utils.createElement('div', {
          style: 'padding:8px 12px;font-weight:bold;color:var(--primary);background:rgba(102,126,234,0.1)'
        }, '📖 RECETTES');
        list.appendChild(header);

        matchedRecipes.forEach(recipe => {
          const item = Utils.createElement('div', {
            className: 'autocomplete-item',
            onclick: (e) => {
              e.stopPropagation();
              this.addRecipeToMeal(day, meal, recipe.id);
              this.closeCurrentInput();
            }
          }, `📖 ${recipe.name}`);
          list.appendChild(item);
        });
      }

      // Afficher les ingrédients
      if (matchedIngredients.length > 0) {
        matchedIngredients.forEach(ing => {
          const item = Utils.createElement('div', {
            className: 'autocomplete-item',
            onclick: (e) => {
              e.stopPropagation();
              this.addIngredientToMeal(day, meal, ing.id);
              this.closeCurrentInput();
            }
          });

          if (ing.favorite) {
            item.style.background = '#fffbeb';
            item.style.borderLeft = '3px solid #fbbf24';
          }

          item.textContent = (ing.favorite ? '⭐ ' : '') + ing.name;
          list.appendChild(item);
        });
      }

      // Option pour créer un nouvel ingrédient
      const existingMatch = matchedIngredients.some(i =>
        i.name.toLowerCase() === value
      );

      if (!existingMatch) {
        const newItem = Utils.createElement('div', {
          className: 'autocomplete-item',
          style: 'background:#e7f3ff;font-weight:600',
          onclick: (e) => {
            e.stopPropagation();
            this.showCreateIngredientDialog(input.value, cell);
            list.innerHTML = '';
          }
        }, `✨ Créer "${input.value}"`);
        list.appendChild(newItem);
      }
    }, 300);

    input.oninput = handleInput;
  }

  /**
   * Ajoute un ingrédient à un repas
   */
  addIngredientToMeal(day, meal, ingId) {
    const week = this.getWeek();
    if (!week) return;

    const key = `${day}-${meal}`;
    if (!week.menu[key]) {
      week.menu[key] = { ingredients: [], recipes: [] };
    }

    if (!week.menu[key].ingredients.includes(ingId)) {
      week.menu[key].ingredients.push(ingId);
      this.saveData();
      this.renderMenu();
    }
  }

  /**
   * Ajoute une recette à un repas
   */
  addRecipeToMeal(day, meal, recipeId) {
    const week = this.getWeek();
    if (!week) return;

    const key = `${day}-${meal}`;
    if (!week.menu[key]) {
      week.menu[key] = { ingredients: [], recipes: [] };
    }

    if (!week.menu[key].recipes) {
      week.menu[key].recipes = [];
    }

    if (!week.menu[key].recipes.includes(recipeId)) {
      week.menu[key].recipes.push(recipeId);
      this.saveData();
      this.renderMenu();
    }
  }

  /**
   * Retire un ingrédient d'un repas
   */
  removeIngredientFromMeal(day, meal, ingId) {
    const week = this.getWeek();
    if (!week) return;

    const key = `${day}-${meal}`;
    if (week.menu[key] && week.menu[key].ingredients) {
      week.menu[key].ingredients = week.menu[key].ingredients.filter(id => id !== ingId);
      this.saveData();
      this.renderMenu();
      this.toast('Ingrédient retiré');
    }
  }

  /**
   * Retire une recette d'un repas
   */
  removeRecipeFromMeal(day, meal, recipeId) {
    const week = this.getWeek();
    if (!week) return;

    const key = `${day}-${meal}`;
    if (week.menu[key] && week.menu[key].recipes) {
      week.menu[key].recipes = week.menu[key].recipes.filter(id => id !== recipeId);
      this.saveData();
      this.renderMenu();
      this.toast('Recette retirée');
    }
  }

  /**
   * Copie un repas
   */
  copyMeal(day, meal) {
    const week = this.getWeek();
    if (!week) return;

    const key = `${day}-${meal}`;
    if (week.menu[key]) {
      this.copiedMeal = Utils.deepClone(week.menu[key]);
      this.toast('Repas copié !', 'info');
    } else {
      this.toast('Case vide', 'error');
    }
  }

  /**
   * Colle un repas
   */
  pasteMeal(day, meal) {
    if (!this.copiedMeal) {
      this.toast('Rien à coller', 'error');
      return;
    }

    const week = this.getWeek();
    if (!week) return;

    const key = `${day}-${meal}`;
    week.menu[key] = Utils.deepClone(this.copiedMeal);
    this.saveData();
    this.renderMenu();
    this.toast('Repas collé !');
  }

  /**
   * Vide un repas
   */
  clearMeal(day, meal) {
    this.confirm(
      'Vider le repas ?',
      'Tous les ingrédients et recettes seront supprimés.',
      () => {
        const week = this.getWeek();
        if (week) {
          const key = `${day}-${meal}`;
          week.menu[key] = { ingredients: [], recipes: [] };
          this.saveData();
          this.renderMenu();
          this.toast('Repas vidé !');
        }
      }
    );
  }

  /**
   * Vide tout le menu
   */
  clearAllMenu() {
    this.confirm(
      'Vider tout le menu ?',
      'Tous les repas de la semaine seront supprimés.',
      () => {
        const week = this.getWeek();
        if (week) {
          week.menu = {};
          this.saveData();
          this.renderMenu();
          this.toast('Menu vidé !');
        }
      }
    );
  }

  /**
   * Génère un repas aléatoire
   */
  generateRandomMeal(day, meal) {
    const proteines = this.ingredients.filter(i => i.type === 'proteine');
    const feculents = this.ingredients.filter(i => i.type === 'feculent');
    const legumes = this.ingredients.filter(i => i.type === 'legume');

    if (proteines.length === 0 || feculents.length === 0 || legumes.length === 0) {
      this.toast('Ingrédients manquants pour générer un repas', 'error');
      return;
    }

    const week = this.getWeek();
    if (!week) return;

    const key = `${day}-${meal}`;
    week.menu[key] = {
      ingredients: [
        Utils.randomElement(proteines).id,
        Utils.randomElement(feculents).id,
        Utils.randomElement(legumes).id
      ],
      recipes: []
    };

    this.saveData();
    this.renderMenu();
    this.toast('Repas généré !');
  }

  /**
   * Remplit toute la semaine aléatoirement
   */
  fillWeekRandomly() {
    this.confirm(
      'Remplir la semaine aléatoirement ?',
      'Tous les repas actuels seront remplacés.',
      () => {
        const proteines = this.ingredients.filter(i => i.type === 'proteine');
        const feculents = this.ingredients.filter(i => i.type === 'feculent');
        const legumes = this.ingredients.filter(i => i.type === 'legume');

        if (proteines.length === 0 || feculents.length === 0 || legumes.length === 0) {
          this.toast('Ingrédients manquants', 'error');
          return;
        }

        const week = this.getWeek();
        if (week) {
          this.days.forEach(day => {
            this.meals.forEach(meal => {
              const key = `${day}-${meal}`;
              week.menu[key] = {
                ingredients: [
                  Utils.randomElement(proteines).id,
                  Utils.randomElement(feculents).id,
                  Utils.randomElement(legumes).id
                ],
                recipes: []
              };
            });
          });

          this.saveData();
          this.renderMenu();
          this.toast('Semaine générée !');
        }
      }
    );
  }

  // ==================== PORTIONS ====================

  /**
   * Affiche la popup de portions
   */
  showPortionPopup(day, meal, button, event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    const week = this.getWeek();
    if (!week) return;

    // Fermer les autres popups
    document.querySelectorAll('.portion-input-popup').forEach(p => p.remove());

    const key = `${day}-${meal}`;
    const currentPortions = week.menu[key]?.portions || week.portions || this.defaultPortions;

    const popup = Utils.createElement('div', {
      className: 'portion-input-popup active',
      onclick: (e) => e.stopPropagation()
    });

    const input = Utils.createElement('input', {
      type: 'number',
      min: '1',
      max: '20',
      value: currentPortions.toString(),
      onclick: (e) => e.stopPropagation()
    });

    input.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        this.saveCustomPortion(day, meal, input.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        popup.remove();
      }
    };

    const btnValidate = Utils.createElement('button', {
      onclick: (e) => {
        e.stopPropagation();
        this.saveCustomPortion(day, meal, input.value);
      }
    }, '✓ OK');

    const btnCancel = Utils.createElement('button', {
      onclick: (e) => {
        e.stopPropagation();
        popup.remove();
      },
      style: 'background:#ef4444'
    }, '✗');

    popup.appendChild(Utils.createElement('label', {
      style: 'color:var(--text-1);font-weight:700;margin-right:10px'
    }, 'Portions:'));
    popup.appendChild(input);
    popup.appendChild(btnValidate);
    popup.appendChild(btnCancel);

    const cell = button.closest('.meal-cell');
    cell.style.position = 'relative';
    cell.appendChild(popup);

    input.focus();
    input.select();
  }

  /**
   * Sauvegarde les portions personnalisées
   */
  saveCustomPortion(day, meal, value) {
    const week = this.getWeek();
    if (!week) return;

    const portions = parseInt(value, 10);
    if (isNaN(portions) || portions < 1) {
      this.toast('Nombre invalide', 'error');
      return;
    }

    const key = `${day}-${meal}`;
    if (!week.menu[key]) {
      week.menu[key] = { ingredients: [], recipes: [] };
    }

    if (portions === week.portions) {
      delete week.menu[key].portions;
    } else {
      week.menu[key].portions = portions;
    }

    this.saveData();
    this.renderMenu();
    this.toast('Portions mises à jour !');
  }

  // ==================== STATUTS DE REPAS ====================

  /**
   * Affiche la modale de statut
   */
  showStatusModal(day, meal) {
    this.currentStatusCell = { day, meal };

    const week = this.getWeek();
    const key = `${day}-${meal}`;
    const currentStatus = week.menu[key]?.status || 'normal';

    // Mettre à jour la sélection
    document.querySelectorAll('.status-option').forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.status === currentStatus);
    });

    this.selectedStatus = currentStatus;
    document.getElementById('status-modal').classList.add('active');
  }

  /**
   * Sélectionne un statut
   */
  selectStatus(element) {
    document.querySelectorAll('.status-option').forEach(opt => {
      opt.classList.remove('selected');
    });
    element.classList.add('selected');
    this.selectedStatus = element.dataset.status;
  }

  /**
   * Ferme la modale de statut
   */
  closeStatusModal() {
    document.getElementById('status-modal').classList.remove('active');
    this.currentStatusCell = null;
    this.selectedStatus = null;
  }

  /**
   * Confirme le statut
   */
  confirmStatus() {
    if (!this.currentStatusCell || !this.selectedStatus) return;

    const week = this.getWeek();
    if (!week) return;

    const { day, meal } = this.currentStatusCell;
    const key = `${day}-${meal}`;

    if (!week.menu[key]) {
      week.menu[key] = { ingredients: [], recipes: [] };
    }

    week.menu[key].status = this.selectedStatus;

    // Si statut spécial, vider le contenu
    if (this.selectedStatus !== 'normal') {
      week.menu[key].ingredients = [];
      week.menu[key].recipes = [];
    }

    this.saveData();
    this.renderMenu();
    this.closeStatusModal();
    this.toast('Statut mis à jour !');
  }

  // ==================== INGRÉDIENTS ====================

  /**
   * Rend la liste des ingrédients
   */
  renderIngredientsList() {
    const container = document.getElementById('ingredients-list');
    if (!container) return;

    container.innerHTML = '';

    // Filtrer les ingrédients
    let filtered;
    if (this.currentFilter === 'all') {
      filtered = this.ingredients;
    } else if (this.currentFilter === 'favorites') {
      filtered = this.ingredients.filter(i => i.favorite === true);
    } else {
      filtered = this.ingredients.filter(i => i.type === this.currentFilter);
    }

    // Trier : favoris en premier
    filtered = Utils.sortItems(filtered, 'name').sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return 0;
    });

    // Créer les cartes
    filtered.forEach(ing => {
      const card = this.createIngredientCard(ing);
      container.appendChild(card);
    });

    if (filtered.length === 0) {
      container.innerHTML = `<p style="text-align:center;color:var(--text-3);padding:40px">Aucun ingrédient${this.currentFilter === 'favorites' ? ' favori' : ''}</p>`;
    }
  }

  /**
   * Crée une carte d'ingrédient
   */
  createIngredientCard(ingredient) {
    const card = Utils.createElement('div', {
      className: `ingredient-card type-${ingredient.type}`
    });

    // Nom avec étoile de favori
    const nameDiv = Utils.createElement('div', { className: 'name' });

    const star = Utils.createElement('span', {
      className: `favorite-star${ingredient.favorite ? ' active' : ''}`,
      onclick: () => this.toggleFavorite(ingredient.id)
    }, ingredient.favorite ? '⭐' : '☆');

    nameDiv.appendChild(star);
    nameDiv.appendChild(Utils.createElement('span', {}, ingredient.name));

    // Actions
    const actionsContainer = Utils.createElement('div');

    // Rayon et portions
    if (ingredient.rayon) {
      let rayonText = this.rayonLabels[ingredient.rayon] || ingredient.rayon;

      // Info portion
      if (ingredient.portionType === 'weight' && ingredient.portionWeight) {
        rayonText += ` • ${ingredient.portionWeight}g/portion`;
      } else if (ingredient.portionType === 'volume' && ingredient.portionWeight) {
        rayonText += ` • ${ingredient.portionWeight}ml/portion`;
      } else if (ingredient.portionType === 'spoon') {
        rayonText += ' • En cuillères';
      }

      const rayon = Utils.createElement('div', {
        className: 'ingredient-rayon'
      }, rayonText);
      actionsContainer.appendChild(rayon);
    }

    // Boutons d'action
    const actions = Utils.createElement('div', { className: 'actions' });

    const editBtn = Utils.createElement('button', {
      onclick: () => this.editIngredient(ingredient.id)
    }, '✏️');

    const deleteBtn = Utils.createElement('button', {
      onclick: () => this.deleteIngredient(ingredient.id)
    }, '🗑️');

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    actionsContainer.appendChild(actions);

    card.appendChild(nameDiv);
    card.appendChild(actionsContainer);

    return card;
  }

  /**
   * Bascule le favori d'un ingrédient
   */
  toggleFavorite(ingId) {
    const ing = this.ingredients.find(i => i.id === ingId);
    if (ing) {
      ing.favorite = !ing.favorite;
      this.saveData();
      this.renderIngredientsList();
      this.toast(ing.favorite ? '⭐ Ajouté aux favoris' : 'Retiré des favoris');
    }
  }

  /**
   * Filtre les ingrédients
   */
  filterIngredients(filter) {
    this.currentFilter = filter;

    // Mettre à jour les boutons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    event.target.classList.add('active');

    this.renderIngredientsList();
  }

  /**
   * Gère la soumission du formulaire d'ingrédient
   */
  handleIngredientSubmit(event) {
    event.preventDefault();

    const name = document.getElementById('new-ingredient-name').value.trim();
    const type = document.getElementById('new-ingredient-type').value;
    const rayon = document.getElementById('new-ingredient-rayon').value;
    const portionType = document.getElementById('new-ingredient-portion-type').value;
    const portionWeight = parseInt(document.getElementById('new-ingredient-portion-weight').value, 10) || null;

    if (!name) {
      this.toast('Veuillez entrer un nom', 'error');
      return;
    }

    this.ingredients.push({
      id: Utils.generateId(),
      name,
      type,
      rayon,
      portionType,
      portionWeight,
      favorite: false
    });

    this.saveData();
    this.renderIngredientsList();

    // Réinitialiser le formulaire
    document.getElementById('new-ingredient-name').value = '';
    document.getElementById('new-ingredient-portion-weight').value = '';

    this.toast(`"${name}" ajouté !`);
  }

  /**
   * Active/désactive le champ de poids de portion
   */
  togglePortionWeightField(prefix) {
    const select = document.getElementById(`${prefix}-ingredient-portion-type`);
    const group = document.getElementById(`${prefix}-portion-weight-group`);
    const label = document.getElementById(`${prefix}-portion-weight-label`);

    if (!select || !group) return;

    const type = select.value;

    if (type === 'quantity' || type === 'spoon') {
      group.style.display = 'none';
    } else {
      group.style.display = 'block';
      if (type === 'weight') {
        label.textContent = 'Poids par portion (g)';
        document.getElementById(`${prefix}-ingredient-portion-weight`).placeholder = '100';
      } else if (type === 'volume') {
        label.textContent = 'Volume par portion (ml)';
        document.getElementById(`${prefix}-ingredient-portion-weight`).placeholder = '250';
      }
    }
  }

  /**
   * Édite un ingrédient
   */
  editIngredient(ingId) {
    const ing = this.ingredients.find(i => i.id === ingId);
    if (!ing) return;

    this.editIngredientId = ingId;

    document.getElementById('edit-ingredient-name').value = ing.name;
    document.getElementById('edit-ingredient-rayon').value = ing.rayon || 'epicerie';
    document.getElementById('edit-ingredient-portion-type').value = ing.portionType || 'quantity';
    document.getElementById('edit-ingredient-portion-weight').value = ing.portionWeight || '';

    this.togglePortionWeightField('edit');

    document.getElementById('edit-ingredient-modal').classList.add('active');
  }

  /**
   * Ferme la modale d'édition d'ingrédient
   */
  closeEditIngredientModal(save) {
    document.getElementById('edit-ingredient-modal').classList.remove('active');

    if (save && this.editIngredientId) {
      const ing = this.ingredients.find(i => i.id === this.editIngredientId);
      if (ing) {
        const newName = document.getElementById('edit-ingredient-name').value.trim();
        const newRayon = document.getElementById('edit-ingredient-rayon').value;
        const newPortionType = document.getElementById('edit-ingredient-portion-type').value;
        const newPortionWeight = parseInt(document.getElementById('edit-ingredient-portion-weight').value, 10) || null;

        if (newName) {
          ing.name = newName;
          ing.rayon = newRayon;
          ing.portionType = newPortionType;
          ing.portionWeight = newPortionWeight;

          this.saveData();
          this.renderIngredientsList();
          this.renderMenu();
          this.renderRecipesList();
          this.toast('Ingrédient modifié !');
        }
      }
    }

    this.editIngredientId = null;
  }

  /**
   * Supprime un ingrédient
   */
  deleteIngredient(ingId) {
    const ing = this.ingredients.find(i => i.id === ingId);
    if (!ing) return;

    this.confirm(
      'Supprimer l\'ingrédient ?',
      `"${ing.name}" sera supprimé de tous les menus et recettes.`,
      () => {
        // Supprimer l'ingrédient
        this.ingredients = this.ingredients.filter(i => i.id !== ingId);

        // Supprimer des menus
        this.weeks.forEach(week => {
          Object.values(week.menu).forEach(meal => {
            if (meal.ingredients) {
              meal.ingredients = meal.ingredients.filter(id => id !== ingId);
            }
          });
        });

        // Supprimer des recettes
        this.recipes.forEach(recipe => {
          recipe.ingredients = recipe.ingredients.filter(id => id !== ingId);
        });

        this.saveData();
        this.renderIngredientsList();
        this.renderRecipesList();
        this.toast('Ingrédient supprimé');
      }
    );
  }

  /**
   * Affiche la modale de création d'ingrédient
   */
  showCreateIngredientDialog(name, cell) {
    this.newIngredientData = { name, cell };

    document.getElementById('modal-ingredient-name').textContent = name;
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
    document.getElementById('create-ingredient-modal').classList.add('active');
  }

  /**
   * Sélectionne un type d'ingrédient
   */
  selectType(element) {
    document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
  }

  /**
   * Ferme la modale de création d'ingrédient
   */
  closeCreateIngredientModal() {
    document.getElementById('create-ingredient-modal').classList.remove('active');
    this.newIngredientData = null;
  }

  /**
   * Confirme la création d'un ingrédient
   */
  confirmCreateIngredient() {
    const selected = document.querySelector('.type-option.selected');
    if (!selected) {
      this.toast('Veuillez sélectionner un type', 'error');
      return;
    }

    const type = selected.dataset.type;
    const name = this.newIngredientData.name;

    // Déterminer le rayon par défaut
    let rayon = 'epicerie';
    if (type === 'proteine') rayon = 'boucherie';
    if (type === 'legume') rayon = 'frais';

    const newIng = {
      id: Utils.generateId(),
      name,
      type,
      rayon,
      portionType: 'quantity',
      favorite: false
    };

    this.ingredients.push(newIng);
    this.saveData();
    this.renderIngredientsList();

    // Ajouter au repas si nécessaire
    if (this.newIngredientData.cell) {
      const { day, meal } = this.newIngredientData.cell.dataset;
      this.addIngredientToMeal(day, meal, newIng.id);
      this.closeCurrentInput();
    }

    this.closeCreateIngredientModal();
    this.toast('Ingrédient créé !');
  }

  // ==================== RECETTES ====================

  /**
   * Rend la liste des recettes
   */
  renderRecipesList() {
    const container = document.getElementById('recipes-list');
    if (!container) return;

    container.innerHTML = '';

    if (this.recipes.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-3);padding:40px">Aucune recette</p>';
      return;
    }

    this.recipes.forEach(recipe => {
      const card = this.createRecipeCard(recipe);
      container.appendChild(card);
    });
  }

  /**
   * Crée une carte de recette
   */
  createRecipeCard(recipe) {
    const card = Utils.createElement('div', { className: 'recipe-card' });

    // En-tête avec nom et bouton supprimer
    const header = Utils.createElement('div', {
      style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:15px'
    });

    const name = Utils.createElement('div', {
      className: 'recipe-name'
    }, recipe.name);

    const deleteBtn = Utils.createElement('button', {
      className: 'btn-delete',
      onclick: () => this.deleteRecipe(recipe.id)
    }, '🗑️ Supprimer');

    header.appendChild(name);
    header.appendChild(deleteBtn);
    card.appendChild(header);

    // Ingrédients
    const ingredients = Utils.createElement('div', { className: 'recipe-ingredients' });
    recipe.ingredients.forEach(ingId => {
      const ing = this.ingredients.find(i => i.id === ingId);
      if (ing) {
        const tag = Utils.createElement('span', {
          className: `ingredient-tag type-${ing.type}`,
          style: 'cursor:default'
        }, ing.name);
        ingredients.appendChild(tag);
      }
    });
    card.appendChild(ingredients);

    // Tags
    if (recipe.tags && recipe.tags.length > 0) {
      const tagsContainer = Utils.createElement('div', { className: 'recipe-tags' });
      recipe.tags.forEach(tag => {
        const tagElem = Utils.createElement('span', {
          className: 'recipe-tag-item',
          style: `background-color:${tag.color}`
        }, `${tag.emoji} ${tag.name}`);
        tagsContainer.appendChild(tagElem);
      });
      card.appendChild(tagsContainer);
    }

    return card;
  }

  /**
   * Gère la soumission du formulaire de recette
   */
  handleRecipeSubmit(event) {
    event.preventDefault();

    const name = document.getElementById('new-recipe-name').value.trim();

    if (!name) {
      this.toast('Veuillez entrer un nom', 'error');
      return;
    }

    if (this.selectedRecipeIngredients.length === 0) {
      this.toast('Veuillez sélectionner au moins un ingrédient', 'error');
      return;
    }

    const selectedTags = this.getSelectedTags();

    this.recipes.push({
      id: Utils.generateId(),
      name,
      ingredients: [...this.selectedRecipeIngredients],
      tags: selectedTags
    });

    this.saveData();
    this.renderRecipesList();

    // Réinitialiser le formulaire
    document.getElementById('new-recipe-name').value = '';
    this.selectedRecipeIngredients = [];
    this.recipeSearchFilter = '';
    this.recipeTypeFilter = 'all';
    document.getElementById('recipe-search-input').value = '';

    // Désélectionner tous les tags
    document.querySelectorAll('.tag-option.selected').forEach(elem => {
      elem.classList.remove('selected');
    });

    this.renderRecipeIngredientSelector();
    this.toast(`Recette "${name}" créée !`);
  }

  /**
   * Supprime une recette
   */
  deleteRecipe(recipeId) {
    const recipe = this.recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    this.confirm(
      'Supprimer la recette ?',
      `La recette "${recipe.name}" sera supprimée de tous les menus.`,
      () => {
        // Supprimer la recette
        this.recipes = this.recipes.filter(r => r.id !== recipeId);

        // Supprimer des menus
        this.weeks.forEach(week => {
          Object.values(week.menu).forEach(meal => {
            if (meal.recipes) {
              meal.recipes = meal.recipes.filter(id => id !== recipeId);
            }
          });
        });

        this.saveData();
        this.renderRecipesList();
        this.toast('Recette supprimée');
      }
    );
  }

  /**
   * Rend le sélecteur d'ingrédients pour les recettes
   */
  renderRecipeIngredientSelector() {
    const container = document.getElementById('recipe-ingredients-selector');
    if (!container) return;

    container.innerHTML = '';

    // Filtrer les ingrédients
    let filtered = [...this.ingredients];

    if (this.recipeTypeFilter !== 'all') {
      filtered = filtered.filter(i => i.type === this.recipeTypeFilter);
    }

    if (this.recipeSearchFilter) {
      filtered = Utils.filterBySearch(filtered, this.recipeSearchFilter, ['name']);
    }

    filtered = Utils.sortItems(filtered, 'name');

    if (filtered.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-3);padding:20px">Aucun ingrédient</p>';
      return;
    }

    filtered.forEach(ing => {
      const isSelected = this.selectedRecipeIngredients.includes(ing.id);

      const card = Utils.createElement('div', {
        className: `ingredient-card type-${ing.type}`,
        style: `cursor:pointer;opacity:${isSelected ? '1' : '0.5'};border:${isSelected ? '3px solid var(--primary)' : '2px solid rgba(255,255,255,0.2)'}`,
        onclick: () => {
          if (isSelected) {
            this.selectedRecipeIngredients = this.selectedRecipeIngredients.filter(id => id !== ing.id);
          } else {
            this.selectedRecipeIngredients.push(ing.id);
          }
          this.renderRecipeIngredientSelector();
        }
      });

      const name = Utils.createElement('div', { className: 'name' }, ing.name);
      card.appendChild(name);
      container.appendChild(card);
    });
  }

  /**
   * Filtre les ingrédients pour les recettes
   */
  filterRecipeIngredients() {
    this.recipeSearchFilter = document.getElementById('recipe-search-input').value;
    this.renderRecipeIngredientSelector();
  }

  /**
   * Filtre les ingrédients par type pour les recettes
   */
  filterRecipeByType(type) {
    this.recipeTypeFilter = type;

    // Mettre à jour les boutons
    document.querySelectorAll('.type-filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    this.renderRecipeIngredientSelector();
  }

  // ==================== TAGS ====================

  /**
   * Rend le sélecteur de tags
   */
  renderTagsSelector() {
    const predefinedContainer = document.getElementById('predefined-tags-selector');
    const customContainer = document.getElementById('custom-tags-selector');

    if (!predefinedContainer || !customContainer) return;

    // Tags pré-définis
    predefinedContainer.innerHTML = '';
    this.availableTags.forEach(tag => {
      const tagElem = this.createTagOption(tag, 'predefined');
      predefinedContainer.appendChild(tagElem);
    });

    // Tags personnalisés
    customContainer.innerHTML = '';
    this.customTags.forEach(tag => {
      const tagElem = this.createTagOption(tag, 'custom');

      // Bouton de suppression
      const deleteBtn = Utils.createElement('span', {
        style: 'margin-left:8px;opacity:0.7;cursor:pointer',
        onclick: (e) => {
          e.stopPropagation();
          this.deleteCustomTag(tag.id);
        }
      }, '🗑️');

      tagElem.appendChild(deleteBtn);
      customContainer.appendChild(tagElem);
    });
  }

  /**
   * Crée une option de tag
   */
  createTagOption(tag, type) {
    return Utils.createElement('div', {
      className: 'tag-option',
      style: `background-color:${tag.color}`,
      dataset: { tagId: tag.id.toString(), tagType: type },
      onclick: function() {
        this.classList.toggle('selected');
      }
    }, `${tag.emoji} ${tag.name}`);
  }

  /**
   * Récupère les tags sélectionnés
   */
  getSelectedTags() {
    const selected = [];

    // Tags pré-définis
    document.querySelectorAll('#predefined-tags-selector .tag-option.selected').forEach(elem => {
      const tagId = parseInt(elem.dataset.tagId, 10);
      const tag = this.availableTags.find(t => t.id === tagId);
      if (tag) {
        selected.push({
          type: 'predefined',
          id: tag.id,
          name: tag.name,
          emoji: tag.emoji,
          color: tag.color
        });
      }
    });

    // Tags personnalisés
    document.querySelectorAll('#custom-tags-selector .tag-option.selected').forEach(elem => {
      const tagId = parseInt(elem.dataset.tagId, 10);
      const tag = this.customTags.find(t => t.id === tagId);
      if (tag) {
        selected.push({
          type: 'custom',
          id: tag.id,
          name: tag.name,
          emoji: tag.emoji,
          color: tag.color
        });
      }
    });

    return selected;
  }

  /**
   * Ajoute un tag personnalisé
   */
  addCustomTag() {
    const name = document.getElementById('new-tag-name').value.trim();
    const emoji = document.getElementById('new-tag-emoji').value.trim() || '🏷️';
    const color = document.getElementById('new-tag-color').value;

    if (!name) {
      this.toast('Veuillez entrer un nom', 'error');
      return;
    }

    this.customTags.push({
      id: Utils.generateId(),
      name,
      emoji,
      color
    });

    document.getElementById('new-tag-name').value = '';
    document.getElementById('new-tag-emoji').value = '';
    document.getElementById('new-tag-color').value = '#6366f1';

    this.saveData();
    this.renderTagsSelector();
    this.toast('Tag créé ! 🏷️');
  }

  /**
   * Supprime un tag personnalisé
   */
  deleteCustomTag(tagId) {
    this.confirm(
      'Supprimer ce tag ?',
      'Il sera retiré de toutes les recettes.',
      () => {
        // Supprimer le tag
        this.customTags = this.customTags.filter(t => t.id !== tagId);

        // Retirer des recettes
        this.recipes.forEach(recipe => {
          if (recipe.tags) {
            recipe.tags = recipe.tags.filter(t => !(t.type === 'custom' && t.id === tagId));
          }
        });

        this.saveData();
        this.renderTagsSelector();
        this.renderRecipesList();
        this.toast('Tag supprimé');
      }
    );
  }

  // ==================== LISTE DE COURSES ====================

  /**
   * Génère et affiche la liste de courses
   */
  generateAndShowShoppingList() {
    const week = this.getWeek();
    if (!week) return;

    document.getElementById('shopping-week-title').textContent = week.name;

    // Afficher la vue
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('shopping-view').classList.add('active');

    this.generateShoppingList();
  }

  /**
   * Génère la liste de courses
   */
  generateShoppingList() {
    const week = this.getWeek();
    if (!week) return;

    const container = document.getElementById('shopping-list-container');
    if (!container) return;

    container.innerHTML = '';

    // Compter les ingrédients
    const counts = {};

    Object.entries(week.menu).forEach(([key, meal]) => {
      // Ignorer les repas avec statut spécial
      if (meal.status && meal.status !== 'normal') {
        return;
      }

      const portions = meal.portions || week.portions;

      // Ingrédients
      if (meal.ingredients) {
        meal.ingredients.forEach(id => {
          counts[id] = (counts[id] || 0) + portions;
        });
      }

      // Recettes
      if (meal.recipes) {
        meal.recipes.forEach(recipeId => {
          const recipe = this.recipes.find(r => r.id === recipeId);
          if (recipe) {
            recipe.ingredients.forEach(id => {
              counts[id] = (counts[id] || 0) + portions;
            });
          }
        });
      }
    });

    if (Object.keys(counts).length === 0 && this.customShoppingItems.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-3);padding:40px">Menu vide</p>';
      return;
    }

    // Grouper par rayon
    const byRayon = {};

    Object.entries(counts).forEach(([ingId, count]) => {
      const ing = this.ingredients.find(i => i.id === parseInt(ingId, 10));
      if (ing) {
        const rayon = ing.rayon || 'epicerie';
        if (!byRayon[rayon]) {
          byRayon[rayon] = [];
        }
        byRayon[rayon].push({ ingredient: ing, count });
      }
    });

    // Afficher par rayon
    ['frais', 'boucherie', 'poissonnerie', 'cremerie', 'boulangerie', 'epicerie', 'surgeles'].forEach(rayon => {
      const items = byRayon[rayon];
      if (items && items.length > 0) {
        container.appendChild(this.createShoppingCategory(rayon, items));
      }
    });

    // Articles personnalisés
    if (this.customShoppingItems && this.customShoppingItems.length > 0) {
      container.appendChild(this.createCustomItemsCategory());
    }
  }

  /**
   * Crée une catégorie de la liste de courses
   */
  createShoppingCategory(rayon, items) {
    const category = Utils.createElement('div', { className: 'shopping-category' });

    const title = Utils.createElement('h3', {}, this.rayonLabels[rayon] || 'Autres');
    category.appendChild(title);

    // Trier les items
    items.sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name));

    items.forEach(item => {
      const shoppingItem = this.createShoppingItem(item);
      category.appendChild(shoppingItem);
    });

    return category;
  }

  /**
   * Crée un item de la liste de courses
   */
  createShoppingItem(item) {
    const div = Utils.createElement('div', { className: 'shopping-item' });

    // Partie gauche (checkbox + nom)
    const left = Utils.createElement('div', {
      style: 'display:flex;gap:10px;align-items:center;flex:1'
    });

    const checkbox = Utils.createElement('input', {
      type: 'checkbox',
      onchange: function() {
        div.classList.toggle('checked', this.checked);
      }
    });

    const name = Utils.createElement('span', { style: 'flex:1' }, item.ingredient.name);

    left.appendChild(checkbox);
    left.appendChild(name);

    // Partie droite (quantité + delete)
    const right = Utils.createElement('div', {
      style: 'display:flex;gap:8px;align-items:center'
    });

    // Badge de quantité
    const badge = this.createQuantityBadge(item);
    right.appendChild(badge);

    // Bouton supprimer
    const deleteBtn = Utils.createElement('button', {
      className: 'cell-btn',
      style: 'padding:6px 10px;font-size:14px',
      title: 'Supprimer',
      onclick: () => this.removeShoppingItem(item.ingredient.id)
    }, '🗑️');
    right.appendChild(deleteBtn);

    div.appendChild(left);
    div.appendChild(right);

    return div;
  }

  /**
   * Crée un badge de quantité
   */
  createQuantityBadge(item) {
    const { ingredient, count } = item;
    let displayText = '';

    const portionType = ingredient.portionType || 'quantity';
    const portionWeight = ingredient.portionWeight;

    if (portionType === 'weight' && portionWeight) {
      const totalGrams = count * portionWeight;
      displayText = totalGrams >= 1000
        ? `${(totalGrams / 1000).toFixed(1).replace('.0', '')} kg`
        : `${totalGrams} g`;
    } else if (portionType === 'volume' && portionWeight) {
      const totalMl = count * portionWeight;
      displayText = totalMl >= 1000
        ? `${(totalMl / 1000).toFixed(1).replace('.0', '')} L`
        : `${totalMl} ml`;
    } else if (portionType === 'spoon') {
      displayText = `${count} c.à.s`;
    } else {
      displayText = `×${count}`;
    }

    return Utils.createElement('span', {
      className: 'quantity-badge',
      style: 'cursor:pointer',
      title: 'Quantité',
      onclick: () => {
        // Possibilité d'éditer la quantité dans une future version
      }
    }, displayText);
  }

  /**
   * Crée la catégorie des articles personnalisés
   */
  createCustomItemsCategory() {
    const category = Utils.createElement('div', { className: 'shopping-category' });

    const title = Utils.createElement('h3', {}, '✨ Articles ajoutés manuellement');
    category.appendChild(title);

    this.customShoppingItems.forEach(item => {
      const div = Utils.createElement('div', { className: 'shopping-item' });

      // Partie gauche
      const left = Utils.createElement('div', {
        style: 'display:flex;gap:10px;align-items:center;flex:1'
      });

      const checkbox = Utils.createElement('input', {
        type: 'checkbox',
        onchange: function() {
          div.classList.toggle('checked', this.checked);
        }
      });

      const name = Utils.createElement('span', { style: 'flex:1' }, item.name);

      left.appendChild(checkbox);
      left.appendChild(name);

      // Partie droite
      const right = Utils.createElement('div', {
        style: 'display:flex;gap:8px;align-items:center'
      });

      const badge = Utils.createElement('span', {
        className: 'quantity-badge'
      }, item.quantity || '×1');
      right.appendChild(badge);

      const deleteBtn = Utils.createElement('button', {
        className: 'cell-btn',
        style: 'padding:6px 10px;font-size:14px',
        onclick: () => this.removeCustomShoppingItem(item.id)
      }, '🗑️');
      right.appendChild(deleteBtn);

      div.appendChild(left);
      div.appendChild(right);
      category.appendChild(div);
    });

    return category;
  }

  /**
   * Retour au menu depuis la liste de courses
   */
  backToMenu() {
    this.showView('menu');
    if (this.currentWeekId) {
      this.openWeek(this.currentWeekId);
    }
  }

  /**
   * Vide la liste de courses (décoche tous les items)
   */
  clearShoppingList() {
    this.confirm(
      'Vider la liste ?',
      'Tous les items seront décochés.',
      () => {
        document.querySelectorAll('#shopping-list-container input[type="checkbox"]').forEach(cb => {
          cb.checked = false;
          cb.closest('.shopping-item').classList.remove('checked');
        });
        this.toast('Liste vidée !');
      }
    );
  }

  /**
   * Retire un item de la liste de courses
   */
  removeShoppingItem(ingId) {
    // Dans une version future, on pourrait retirer réellement l'ingrédient
    this.toast('Fonctionnalité à venir', 'info');
  }

  /**
   * Affiche la modale d'ajout d'article personnalisé
   */
  showAddCustomItemModal() {
    document.getElementById('custom-item-name').value = '';
    document.getElementById('custom-item-quantity').value = '';
    document.getElementById('custom-item-rayon').value = 'epicerie';
    document.getElementById('custom-shopping-item-modal').classList.add('active');
  }

  /**
   * Ferme la modale d'article personnalisé
   */
  closeCustomItemModal(save) {
    const modal = document.getElementById('custom-shopping-item-modal');
    modal.classList.remove('active');

    if (save) {
      const name = document.getElementById('custom-item-name').value.trim();
      const quantity = document.getElementById('custom-item-quantity').value.trim();
      const rayon = document.getElementById('custom-item-rayon').value;

      if (name) {
        if (!this.customShoppingItems) {
          this.customShoppingItems = [];
        }

        this.customShoppingItems.push({
          id: Utils.generateId(),
          name,
          quantity: quantity || '×1',
          rayon
        });

        this.toast('Article ajouté !');
        this.generateShoppingList();
      }
    }
  }

  /**
   * Retire un article personnalisé
   */
  removeCustomShoppingItem(itemId) {
    this.confirm(
      'Supprimer cet article ?',
      'L\'article sera définitivement supprimé.',
      () => {
        this.customShoppingItems = this.customShoppingItems.filter(item => item.id !== itemId);
        this.toast('Article supprimé');
        this.generateShoppingList();
      }
    );
  }

  /**
   * Exporte la liste de courses en PDF
   */
  exportToPDF() {
    if (typeof window.jspdf === 'undefined') {
      this.toast('Erreur: jsPDF non chargé', 'error');
      return;
    }

    const week = this.getWeek();
    if (!week) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Compter les ingrédients
    const counts = {};

    Object.values(week.menu).forEach(meal => {
      if (meal.status && meal.status !== 'normal') return;

      const portions = meal.portions || week.portions;

      if (meal.ingredients) {
        meal.ingredients.forEach(id => {
          counts[id] = (counts[id] || 0) + portions;
        });
      }

      if (meal.recipes) {
        meal.recipes.forEach(recipeId => {
          const recipe = this.recipes.find(r => r.id === recipeId);
          if (recipe) {
            recipe.ingredients.forEach(id => {
              counts[id] = (counts[id] || 0) + portions;
            });
          }
        });
      }
    });

    if (Object.keys(counts).length === 0) {
      this.toast('Menu vide', 'error');
      return;
    }

    // Grouper par rayon
    const byRayon = {};

    Object.entries(counts).forEach(([ingId, count]) => {
      const ing = this.ingredients.find(i => i.id === parseInt(ingId, 10));
      if (ing) {
        const rayon = ing.rayon || 'epicerie';
        if (!byRayon[rayon]) {
          byRayon[rayon] = [];
        }
        byRayon[rayon].push({ name: ing.name, count });
      }
    });

    // Générer le PDF
    let y = 20;

    doc.setFontSize(20);
    doc.text('Liste de Courses', 105, y, { align: 'center' });

    y += 8;
    doc.setFontSize(12);
    doc.text(week.name, 105, y, { align: 'center' });

    y += 6;
    doc.text(`Générée le ${new Date().toLocaleDateString('fr-FR')}`, 105, y, { align: 'center' });

    y += 15;

    ['frais', 'boucherie', 'poissonnerie', 'cremerie', 'boulangerie', 'epicerie', 'surgeles'].forEach(rayon => {
      const items = byRayon[rayon];
      if (items && items.length > 0) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text(this.rayonLabels[rayon], 20, y);

        y += 8;
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');

        items.sort((a, b) => a.name.localeCompare(b.name));

        items.forEach(item => {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }

          doc.text(`☐ ${item.name} (×${item.count})`, 25, y);
          y += 7;
        });

        y += 5;
      }
    });

    doc.save(`liste-${week.name.replace(/\s+/g, '-')}.pdf`);
    this.toast('PDF généré !');
  }

  // ==================== CALENDRIER SAISONNIER ====================

  /**
   * Ouvre le calendrier saisonnier
   */
  openSeasonalCalendar() {
    document.getElementById('seasonal-calendar-modal').classList.add('active');
    this.currentSeasonalTab = 'legumes';
    this.seasonalSearchTerm = '';
    document.getElementById('seasonal-search-input').value = '';
    this.renderSeasonalCalendar();
  }

  /**
   * Ferme le calendrier saisonnier
   */
  closeSeasonalCalendar() {
    document.getElementById('seasonal-calendar-modal').classList.remove('active');
  }

  /**
   * Affiche un onglet du calendrier saisonnier
   */
  showSeasonalTab(tab) {
    this.currentSeasonalTab = tab;

    document.querySelectorAll('.seasonal-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    this.renderSeasonalCalendar();
  }

  /**
   * Filtre les données saisonnières
   */
  filterSeasonalData() {
    this.seasonalSearchTerm = document.getElementById('seasonal-search-input').value.toLowerCase();
    this.renderSeasonalCalendar();
  }

  /**
   * Rend le calendrier saisonnier
   */
  renderSeasonalCalendar() {
    const container = document.getElementById('seasonal-content');
    if (!container) return;

    const data = this.seasonalData[this.currentSeasonalTab];
    let filtered = data;

    if (this.seasonalSearchTerm) {
      filtered = data.filter(item =>
        item.name.toLowerCase().includes(this.seasonalSearchTerm)
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-3);padding:40px">Aucun résultat</p>';
      return;
    }

    const currentMonth = new Date().getMonth() + 1;
    const monthsShort = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    const monthsFull = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    let html = '<div style="margin-bottom:20px">';

    // Légende
    html += '<div style="display:flex;gap:25px;justify-content:center;padding:15px;background:rgba(255,255,255,0.05);border-radius:10px;margin-bottom:20px;flex-wrap:wrap">';
    html += '<div style="display:flex;align-items:center;gap:8px"><div style="width:24px;height:24px;background:#10b981;border-radius:6px"></div><span style="color:var(--text-1);font-weight:600;font-size:14px">Pleine saison</span></div>';
    html += '<div style="display:flex;align-items:center;gap:8px"><div style="width:24px;height:24px;background:#fbbf24;border-radius:6px"></div><span style="color:var(--text-1);font-weight:600;font-size:14px">Disponible</span></div>';
    html += '<div style="display:flex;align-items:center;gap:8px"><div style="width:24px;height:24px;background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.2);border-radius:6px"></div><span style="color:var(--text-1);font-weight:600;font-size:14px">Hors saison</span></div>';
    html += '</div>';

    // Tableau
    html += '<table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,0.03);border-radius:10px;overflow:hidden">';
    html += '<thead><tr style="background:var(--primary)">';
    html += '<th style="padding:12px;text-align:left;color:#fff;font-weight:700;font-size:13px;position:sticky;left:0;background:var(--primary);z-index:10;min-width:140px">PRODUIT</th>';

    // En-têtes des mois
    for (let i = 1; i <= 12; i++) {
      const isCurrentMonth = i === currentMonth;
      const style = `padding:10px 6px;text-align:center;color:#fff;font-weight:700;font-size:12px;min-width:35px;${isCurrentMonth ? 'background:#fbbf24;' : ''}`;
      html += `<th style="${style}" title="${monthsFull[i - 1]}">${monthsShort[i - 1]}`;
      if (isCurrentMonth) {
        html += '<div style="position:absolute;bottom:-3px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid #fbbf24"></div>';
      }
      html += '</th>';
    }
    html += '</tr></thead><tbody>';

    // Lignes des produits
    filtered.forEach((item, index) => {
      const rowStyle = `border-bottom:1px solid rgba(255,255,255,0.05);${index % 2 === 0 ? 'background:rgba(255,255,255,0.02);' : ''}`;

      html += `<tr style="${rowStyle}">`;
      html += `<td style="padding:10px 12px;font-weight:600;color:var(--text-1);font-size:13px;position:sticky;left:0;background:${index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.03)'};z-index:5">${item.name}</td>`;

      for (let month = 1; month <= 12; month++) {
        const isInSeason = item.months.includes(month);
        const cellStyle = 'padding:10px 6px;text-align:center;';

        if (isInSeason) {
          const isPeak = this.isPeakSeason(item.months, month);
          const bgColor = isPeak ? '#10b981' : '#fbbf24';
          html += `<td style="${cellStyle}background:${bgColor};">●</td>`;
        } else {
          html += `<td style="${cellStyle}"></td>`;
        }
      }
      html += '</tr>';
    });

    html += '</tbody></table>';

    // Info mois actuel
    html += '<div style="text-align:center;margin-top:20px;padding:12px;background:linear-gradient(135deg,#10b981,#059669);border-radius:10px;color:#fff;font-weight:600;font-size:14px">';
    html += `📅 Mois actuel : ${monthsFull[currentMonth - 1]}`;
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  /**
   * Détermine si un mois est en pleine saison
   */
  isPeakSeason(months, month) {
    if (months.length < 3) return true;

    const index = months.indexOf(month);
    if (index === -1) return false;

    const prevMonth = month === 1 ? 12 : month - 1;
    const nextMonth = month === 12 ? 1 : month + 1;

    const hasPrev = months.includes(prevMonth);
    const hasNext = months.includes(nextMonth);

    return hasPrev && hasNext;
  }
}

// ==================== INITIALISATION ====================

// Créer l'instance globale de l'application
const app = new MenuApp();

// Exposer les méthodes nécessaires au HTML
window.APP = {
  // Thème
  changeTheme: (theme) => app.changeTheme(theme),

  // Vues
  showView: (view) => app.showView(view),
  openCurrentWeek: () => app.openCurrentWeek(),
  backToWeeks: () => app.backToWeeks(),
  backToMenu: () => app.backToMenu(),

  // Semaines
  openWeek: (id) => app.openWeek(id),
  editWeek: (id) => app.editWeek(id),
  deleteWeek: (id) => app.deleteWeek(id),
  closeWeekModal: (save) => app.closeWeekModal(save),

  // Menu
  clearAllMenu: () => app.clearAllMenu(),
  fillWeekRandomly: () => app.fillWeekRandomly(),
  generateRandomMeal: (day, meal) => app.generateRandomMeal(day, meal),
  copyMeal: (day, meal) => app.copyMeal(day, meal),
  pasteMeal: (day, meal) => app.pasteMeal(day, meal),
  clearMeal: (day, meal) => app.clearMeal(day, meal),

  // Portions
  showPortionPopup: (day, meal, btn, e) => app.showPortionPopup(day, meal, btn, e),

  // Statuts
  showStatusModal: (day, meal) => app.showStatusModal(day, meal),
  closeStatusModal: () => app.closeStatusModal(),
  selectStatus: (elem) => app.selectStatus(elem),
  confirmStatus: () => app.confirmStatus(),

  // Ingrédients
  filterIngredients: (filter) => app.filterIngredients(filter),
  handleIngredientSubmit: (e) => app.handleIngredientSubmit(e),
  togglePortionWeightField: (prefix) => app.togglePortionWeightField(prefix),
  editIngredient: (id) => app.editIngredient(id),
  closeEditIngredientModal: (save) => app.closeEditIngredientModal(save),
  deleteIngredient: (id) => app.deleteIngredient(id),
  selectType: (elem) => app.selectType(elem),
  closeCreateIngredientModal: () => app.closeCreateIngredientModal(),
  confirmCreateIngredient: () => app.confirmCreateIngredient(),

  // Recettes
  handleRecipeSubmit: (e) => app.handleRecipeSubmit(e),
  filterRecipeIngredients: () => app.filterRecipeIngredients(),
  filterRecipeByType: (type) => app.filterRecipeByType(type),
  deleteRecipe: (id) => app.deleteRecipe(id),

  // Tags
  addCustomTag: () => app.addCustomTag(),
  deleteCustomTag: (id) => app.deleteCustomTag(id),

  // Liste de courses
  generateAndShowShoppingList: () => app.generateAndShowShoppingList(),
  clearShoppingList: () => app.clearShoppingList(),
  showAddCustomItemModal: () => app.showAddCustomItemModal(),
  closeCustomItemModal: (save) => app.closeCustomItemModal(save),
  exportToPDF: () => app.exportToPDF(),

  // Calendrier saisonnier
  openSeasonalCalendar: () => app.openSeasonalCalendar(),
  closeSeasonalCalendar: () => app.closeSeasonalCalendar(),
  showSeasonalTab: (tab) => app.showSeasonalTab(tab),
  filterSeasonalData: () => app.filterSeasonalData(),

  // Paramètres
  updateDefaultPortions: () => app.updateDefaultPortions(),
  resetIngredientsToDefault: () => app.resetIngredientsToDefault(),

  // Modales
  closeConfirmModal: (confirmed) => app.closeConfirmModal(confirmed)
};

// Initialiser l'application au chargement de la page
window.addEventListener('load', () => app.init());

export default app;
