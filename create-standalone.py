#!/usr/bin/env python3
"""
Script pour créer une version standalone de Menu Hebdo
qui fonctionne sans serveur HTTP (en ouvrant directement le fichier)
"""

import os
import re

def read_file(path):
    """Lit le contenu d'un fichier"""
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def create_standalone():
    """Crée le fichier standalone"""
    print("🚀 Création de la version standalone...")

    # Lire les fichiers
    print("📖 Lecture des fichiers...")
    css_content = read_file('src/css/style.css')
    js_data = read_file('src/js/data.js')
    js_storage = read_file('src/js/storage.js')
    js_utils = read_file('src/js/utils.js')
    js_app = read_file('src/js/app.js')

    # Retirer les imports/exports des modules JS
    print("🔧 Conversion des modules ES6...")
    js_data = re.sub(r'export (const|function|class)', r'\1', js_data)
    js_storage = re.sub(r'export (const|function|class)', r'\1', js_storage)
    js_utils = re.sub(r'export (const|function|class)', r'\1', js_utils)
    js_app = re.sub(r'export (default )?', '', js_app)

    # Retirer les imports
    js_app = re.sub(r"import .* from ['\"].*['\"];\n", '', js_app)

    # Créer le HTML standalone
    print("📝 Génération du HTML...")
    html_content = f'''<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Planificateur de menus hebdomadaires avec génération automatique de liste de courses">
  <title>Menu Hebdo - Planificateur de Menus</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍽️</text></svg>">

  <style>
{css_content}
  </style>
</head>

<body data-theme="dark">
  <div class="container">
    <header>
      <h1>🍽️ Planificateur de Menus</h1>
      <nav class="nav-buttons" role="navigation" aria-label="Navigation principale">
        <button type="button" onclick="APP.openCurrentWeek()">📅 Menu en cours</button>
        <button type="button" onclick="APP.showView('weeks')">🗂️ Gestion semaines</button>
        <button type="button" onclick="APP.showView('recipes')">📖 Recettes</button>
        <button type="button" onclick="APP.showView('ingredients')">🥕 Ingrédients</button>
        <button type="button" onclick="APP.showView('settings')">⚙️ Paramètres</button>
      </nav>
    </header>

    <main class="content">
      <section id="weeks-view" class="view active">
        <div class="weeks-list" id="weeks-list" role="list"></div>
      </section>

      <section id="menu-view" class="view">
        <button type="button" class="back-button" onclick="APP.backToWeeks()">← Retour</button>
        <h2 id="current-week-title" style="margin-bottom:20px"></h2>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px">
          <button type="button" class="btn-clear" onclick="APP.clearAllMenu()">🗑️ Vider tout le menu</button>
          <button type="button" class="random-meal-btn" onclick="APP.fillWeekRandomly()">🎲 Remplir aléatoirement</button>
          <button type="button" class="btn" onclick="APP.openSeasonalCalendar()">📅 Calendrier fruits & légumes</button>
        </div>
        <table class="menu-table" role="table">
          <thead>
            <tr>
              <th scope="col" style="width:15%">Jour</th>
              <th scope="col" style="width:42.5%">Midi</th>
              <th scope="col" style="width:42.5%">Soir</th>
            </tr>
          </thead>
          <tbody id="menu-body"></tbody>
        </table>
        <button type="button" class="btn" onclick="APP.generateAndShowShoppingList()">🛒 Générer liste de courses</button>
      </section>

      <section id="shopping-view" class="view">
        <button type="button" class="back-button" onclick="APP.backToMenu()">← Retour</button>
        <h2>🛒 Liste de courses - <span id="shopping-week-title"></span></h2>
        <div style="margin-top:15px;margin-bottom:15px;display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" class="btn" onclick="APP.showAddCustomItemModal()">➕ Ajouter un article</button>
          <button type="button" class="btn-clear" onclick="APP.clearShoppingList()">🗑️ Vider la liste</button>
          <button type="button" class="btn" onclick="APP.exportToPDF()">📄 Export PDF</button>
        </div>
        <div id="shopping-list-container" style="margin-top:20px"></div>
      </section>

      <section id="recipes-view" class="view">
        <div class="add-ingredient-form">
          <h2>📖 Créer une recette</h2>
          <form id="add-recipe-form" onsubmit="APP.handleRecipeSubmit(event);return false">
            <div class="form-group">
              <label for="new-recipe-name">Nom de la recette</label>
              <input type="text" id="new-recipe-name" required>
            </div>
            <div class="form-group">
              <label for="recipe-search-input">Ingrédients</label>
              <input type="text" id="recipe-search-input" class="search-input" placeholder="🔍 Rechercher..." oninput="APP.filterRecipeIngredients()">
              <div class="type-filters" role="group">
                <button type="button" class="type-filter-btn active" onclick="APP.filterRecipeByType('all')">Tous</button>
                <button type="button" class="type-filter-btn" onclick="APP.filterRecipeByType('proteine')">🍗</button>
                <button type="button" class="type-filter-btn" onclick="APP.filterRecipeByType('feculent')">🍚</button>
                <button type="button" class="type-filter-btn" onclick="APP.filterRecipeByType('legume')">🥬</button>
                <button type="button" class="type-filter-btn" onclick="APP.filterRecipeByType('autre')">🧂</button>
              </div>
              <div id="recipe-ingredients-selector" class="ingredients-list" style="max-height:300px;overflow-y:auto;border:2px solid #dee2e6;padding:15px;border-radius:8px"></div>
            </div>
            <div class="form-group">
              <label>🏷️ Tags</label>
              <div class="tag-selector">
                <h4>Tags pré-définis</h4>
                <div class="available-tags" id="predefined-tags-selector"></div>
                <h4 style="margin-top:20px">Tags personnalisés</h4>
                <div class="available-tags" id="custom-tags-selector"></div>
                <div class="custom-tag-input">
                  <input type="text" id="new-tag-name" placeholder="Nom du tag">
                  <input type="text" id="new-tag-emoji" placeholder="🏷️" maxlength="2" style="width:60px;text-align:center">
                  <input type="color" id="new-tag-color" value="#6366f1">
                  <button type="button" class="btn" onclick="APP.addCustomTag()" style="padding:10px 20px">+ Ajouter</button>
                </div>
              </div>
            </div>
            <button type="submit" class="btn">Créer</button>
          </form>
        </div>
        <h2 style="margin-top:30px;margin-bottom:15px">Mes recettes</h2>
        <div id="recipes-list"></div>
      </section>

      <section id="ingredients-view" class="view">
        <div class="add-ingredient-form">
          <h2>Ajouter un ingrédient</h2>
          <form id="add-ingredient-form" onsubmit="APP.handleIngredientSubmit(event);return false">
            <div class="form-group">
              <label for="new-ingredient-name">Nom</label>
              <input type="text" id="new-ingredient-name" required>
            </div>
            <div class="form-group">
              <label for="new-ingredient-type">Type</label>
              <select id="new-ingredient-type">
                <option value="proteine">Protéine</option>
                <option value="feculent">Féculent</option>
                <option value="legume">Légume</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div class="form-group">
              <label for="new-ingredient-rayon">Rayon</label>
              <select id="new-ingredient-rayon">
                <option value="boucherie">🍖 Boucherie</option>
                <option value="poissonnerie">🐟 Poissonnerie</option>
                <option value="frais">🥬 Fruits & Légumes</option>
                <option value="cremerie">🧀 Crèmerie</option>
                <option value="epicerie">🛒 Épicerie</option>
                <option value="surgeles">❄️ Surgelés</option>
                <option value="boulangerie">🥖 Boulangerie</option>
              </select>
            </div>
            <div class="form-group">
              <label for="new-ingredient-portion-type">📊 Type de portion</label>
              <select id="new-ingredient-portion-type" onchange="APP.togglePortionWeightField('new')">
                <option value="quantity">🔢 Quantité (pièces)</option>
                <option value="weight">⚖️ Poids (grammes)</option>
                <option value="volume">📏 Volume (ml)</option>
                <option value="spoon">🥄 Cuillères</option>
              </select>
            </div>
            <div class="form-group" id="new-portion-weight-group" style="display:none">
              <label for="new-ingredient-portion-weight" id="new-portion-weight-label">Poids par portion (g)</label>
              <input type="number" id="new-ingredient-portion-weight" min="1" step="1" placeholder="100">
              <p style="color:var(--text-3);font-size:12px;margin-top:5px">Exemple : 100g pour les pâtes, 80g pour le riz</p>
            </div>
            <button type="submit" class="btn">Ajouter</button>
          </form>
        </div>
        <div class="filter-buttons" role="group">
          <button class="filter-btn active" onclick="APP.filterIngredients('all')">Tous</button>
          <button class="filter-btn" onclick="APP.filterIngredients('favorites')">⭐ Favoris</button>
          <button class="filter-btn" onclick="APP.filterIngredients('proteine')">Protéines</button>
          <button class="filter-btn" onclick="APP.filterIngredients('feculent')">Féculents</button>
          <button class="filter-btn" onclick="APP.filterIngredients('legume')">Légumes</button>
          <button class="filter-btn" onclick="APP.filterIngredients('autre')">Autres</button>
        </div>
        <div class="ingredients-list" id="ingredients-list"></div>
      </section>

      <section id="settings-view" class="view">
        <h2>⚙️ Paramètres</h2>
        <div class="add-ingredient-form">
          <h3 style="margin-bottom:20px">🎨 Thème de l'application</h3>
          <div class="theme-selector" style="position:static;background:transparent;border:none;padding:0;box-shadow:none;justify-content:flex-start">
            <button type="button" class="theme-btn active" data-theme="dark" onclick="APP.changeTheme('dark')" title="Sombre"></button>
            <button type="button" class="theme-btn" data-theme="light" onclick="APP.changeTheme('light')" title="Clair"></button>
            <button type="button" class="theme-btn" data-theme="forest" onclick="APP.changeTheme('forest')" title="Forêt"></button>
          </div>
          <p style="color:var(--text-3);font-size:13px;margin-top:15px">Choisissez le thème de couleur de l'application</p>
        </div>
        <div class="add-ingredient-form">
          <h3 style="margin-bottom:20px">👥 Portions par défaut</h3>
          <div class="form-group">
            <label for="default-portions-input">Nombre de portions pour les nouvelles semaines</label>
            <input type="number" id="default-portions-input" value="2" min="1" max="20" onchange="APP.updateDefaultPortions()">
            <p style="color:var(--text-3);font-size:13px;margin-top:8px">Cette valeur sera utilisée par défaut lors de la création d'une nouvelle semaine.</p>
          </div>
        </div>
        <div class="add-ingredient-form">
          <h3 style="margin-bottom:20px">🥕 Base de données des ingrédients</h3>
          <p style="color:var(--text-2);font-size:14px;margin-bottom:15px">Vous avez actuellement <strong id="ingredient-count">0</strong> ingrédients dans votre base de données.</p>
          <button type="button" class="btn" onclick="APP.resetIngredientsToDefault()">🔄 Réinitialiser aux 166 ingrédients par défaut</button>
          <p style="color:var(--text-3);font-size:13px;margin-top:10px">⚠️ Attention : Cette action remplacera tous vos ingrédients actuels par la liste complète des 166 ingrédients par défaut.</p>
        </div>
      </section>
    </main>
  </div>

  <!-- MODALES (Toutes les modales ici) -->
  <div id="create-ingredient-modal" class="modal-overlay" onclick="if(event.target.id==='create-ingredient-modal')APP.closeCreateIngredientModal()">
    <div class="custom-modal">
      <div class="modal-header"><div class="modal-icon">✨</div><div class="modal-title">Créer</div></div>
      <div class="modal-body">
        <p>Nom: <strong id="modal-ingredient-name"></strong></p>
        <div class="type-selector">
          <div class="type-option type-proteine" data-type="proteine" onclick="APP.selectType(this)">🍗 Protéine</div>
          <div class="type-option type-feculent" data-type="feculent" onclick="APP.selectType(this)">🍚 Féculent</div>
          <div class="type-option type-legume" data-type="legume" onclick="APP.selectType(this)">🥬 Légume</div>
          <div class="type-option type-autre" data-type="autre" onclick="APP.selectType(this)">🧂 Autre</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-cancel" onclick="APP.closeCreateIngredientModal()">Annuler</button>
        <button class="modal-btn modal-btn-confirm" onclick="APP.confirmCreateIngredient()">Créer</button>
      </div>
    </div>
  </div>

  <div id="confirm-modal" class="modal-overlay" onclick="if(event.target.id==='confirm-modal')APP.closeConfirmModal(false)">
    <div class="custom-modal">
      <div class="modal-header"><div class="modal-icon" id="confirm-modal-icon">❓</div><div class="modal-title" id="confirm-modal-title">Confirmation</div></div>
      <div class="modal-body" id="confirm-modal-body"></div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-cancel" onclick="APP.closeConfirmModal(false)">Annuler</button>
        <button class="modal-btn modal-btn-danger" onclick="APP.closeConfirmModal(true)">Confirmer</button>
      </div>
    </div>
  </div>

  <div id="edit-ingredient-modal" class="modal-overlay" onclick="if(event.target.id==='edit-ingredient-modal')APP.closeEditIngredientModal(false)">
    <div class="custom-modal">
      <div class="modal-header"><div class="modal-icon">✏️</div><div class="modal-title">Modifier</div></div>
      <div class="modal-body">
        <div class="modal-input-group"><label>Nom</label><input type="text" id="edit-ingredient-name"></div>
        <div class="modal-input-group"><label>Rayon</label>
          <select id="edit-ingredient-rayon">
            <option value="boucherie">🍖 Boucherie</option>
            <option value="poissonnerie">🐟 Poissonnerie</option>
            <option value="frais">🥬 Fruits & Légumes</option>
            <option value="cremerie">🧀 Crèmerie</option>
            <option value="epicerie">🛒 Épicerie</option>
            <option value="surgeles">❄️ Surgelés</option>
            <option value="boulangerie">🥖 Boulangerie</option>
          </select>
        </div>
        <div class="modal-input-group">
          <label>📊 Type de portion</label>
          <select id="edit-ingredient-portion-type" onchange="APP.togglePortionWeightField('edit')">
            <option value="quantity">🔢 Quantité (pièces)</option>
            <option value="weight">⚖️ Poids (grammes)</option>
            <option value="volume">📏 Volume (ml)</option>
            <option value="spoon">🥄 Cuillères</option>
          </select>
        </div>
        <div class="modal-input-group" id="edit-portion-weight-group" style="display:none">
          <label id="edit-portion-weight-label">Poids par portion (g)</label>
          <input type="number" id="edit-ingredient-portion-weight" min="1" step="1" placeholder="100">
          <p style="color:var(--text-3);font-size:12px;margin-top:5px">Exemple : 100g pour les pâtes, 80g pour le riz</p>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-cancel" onclick="APP.closeEditIngredientModal(false)">Annuler</button>
        <button class="modal-btn modal-btn-confirm" onclick="APP.closeEditIngredientModal(true)">Sauvegarder</button>
      </div>
    </div>
  </div>

  <div id="week-modal" class="modal-overlay" onclick="if(event.target.id==='week-modal')APP.closeWeekModal(false)">
    <div class="custom-modal">
      <div class="modal-header"><div class="modal-icon">📅</div><div class="modal-title" id="week-modal-title">Créer</div></div>
      <div class="modal-body">
        <div class="modal-input-group"><label>Nom</label><input type="text" id="week-name-input"></div>
        <div class="modal-input-group"><label>Date début</label><input type="date" id="week-start-input"></div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-cancel" onclick="APP.closeWeekModal(false)">Annuler</button>
        <button class="modal-btn modal-btn-confirm" onclick="APP.closeWeekModal(true)">Créer</button>
      </div>
    </div>
  </div>

  <div id="status-modal" class="modal-overlay" onclick="if(event.target.id==='status-modal')APP.closeStatusModal()">
    <div class="custom-modal">
      <div class="modal-header"><div class="modal-icon">🏠</div><div class="modal-title">Statut du repas</div></div>
      <div class="modal-body">
        <p style="margin-bottom:15px">Choisissez le statut pour ce repas :</p>
        <div class="status-selector">
          <div class="status-option status-normal" data-status="normal" onclick="APP.selectStatus(this)">🍽️ Normal</div>
          <div class="status-option status-restaurant" data-status="restaurant" onclick="APP.selectStatus(this)">🍴 Restaurant</div>
          <div class="status-option status-verseaux" data-status="verseaux" onclick="APP.selectStatus(this)">🏡 Les Verseaux</div>
          <div class="status-option status-copains" data-status="copains" onclick="APP.selectStatus(this)">👥 Copains</div>
          <div class="status-option status-joker" data-status="joker" onclick="APP.selectStatus(this)">🃏 Joker</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-cancel" onclick="APP.closeStatusModal()">Annuler</button>
        <button class="modal-btn modal-btn-confirm" onclick="APP.confirmStatus()">Valider</button>
      </div>
    </div>
  </div>

  <div id="custom-shopping-item-modal" class="modal-overlay" onclick="if(event.target.id==='custom-shopping-item-modal')APP.closeCustomItemModal(false)">
    <div class="custom-modal">
      <div class="modal-header"><div class="modal-icon">➕</div><div class="modal-title">Ajouter un article</div></div>
      <div class="modal-body">
        <div class="modal-input-group"><label>Nom de l'article</label><input type="text" id="custom-item-name" placeholder="Ex: Pain, Lait..."></div>
        <div class="modal-input-group"><label>Quantité (optionnel)</label><input type="text" id="custom-item-quantity" placeholder="Ex: 2, 500g, 1L..."></div>
        <div class="modal-input-group"><label>Rayon</label>
          <select id="custom-item-rayon">
            <option value="frais">🥬 Fruits & Légumes</option>
            <option value="boucherie">🍖 Boucherie</option>
            <option value="poissonnerie">🐟 Poissonnerie</option>
            <option value="cremerie">🧀 Crèmerie</option>
            <option value="boulangerie">🥖 Boulangerie</option>
            <option value="epicerie">🛒 Épicerie</option>
            <option value="surgeles">❄️ Surgelés</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-cancel" onclick="APP.closeCustomItemModal(false)">Annuler</button>
        <button class="modal-btn modal-btn-confirm" onclick="APP.closeCustomItemModal(true)">Ajouter</button>
      </div>
    </div>
  </div>

  <div id="seasonal-calendar-modal" class="modal-overlay" onclick="if(event.target.id==='seasonal-calendar-modal')APP.closeSeasonalCalendar()">
    <div class="custom-modal" style="max-width:1100px;width:95%;max-height:90vh">
      <div class="modal-header"><div class="modal-icon">📅</div><div class="modal-title">Calendrier des Fruits & Légumes</div></div>
      <div class="modal-body" style="overflow-y:auto;max-height:70vh">
        <div class="seasonal-tabs">
          <button class="seasonal-tab active" onclick="APP.showSeasonalTab('legumes')">🥬 Légumes</button>
          <button class="seasonal-tab" onclick="APP.showSeasonalTab('fruits')">🍓 Fruits</button>
        </div>
        <div class="seasonal-search"><input type="text" id="seasonal-search-input" placeholder="🔍 Rechercher un produit..." oninput="APP.filterSeasonalData()"></div>
        <div id="seasonal-content"></div>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-confirm" onclick="APP.closeSeasonalCalendar()" style="width:100%">Fermer</button>
      </div>
    </div>
  </div>

  <footer style="text-align:center;padding:20px;color:var(--text-3);font-size:14px;margin-top:40px">
    <p>Menu Hebdo v2.0 - Version Standalone</p>
    <p style="margin-top:5px">💾 Données sauvegardées localement dans votre navigateur</p>
  </footer>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script>
// === CODE JAVASCRIPT CONSOLIDÉ ===
{js_data}

{js_storage}

{js_utils}

{js_app}
  </script>
</body>
</html>'''

    # Écrire le fichier
    output_file = 'menu-hebdo-standalone.html'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f"✅ Fichier créé : {output_file}")
    print(f"📁 Taille : {os.path.getsize(output_file) / 1024:.1f} KB")
    print("")
    print("🎉 Terminé ! Vous pouvez maintenant ouvrir le fichier directement dans votre navigateur.")
    print(f"   Double-cliquez sur : {output_file}")

if __name__ == '__main__':
    try:
        create_standalone()
    except Exception as e:
        print(f"❌ Erreur : {e}")
        import traceback
        traceback.print_exc()
