/**
 * Menu Hebdo - Données par défaut
 * @description Contient les ingrédients, tags et données saisonnières par défaut
 */

// Ingrédients par défaut (166 ingrédients)
export const DEFAULT_INGREDIENTS = [
  // Boucherie - Bœuf
  { id: 1, name: 'Bœuf (steak)', type: 'proteine', rayon: 'boucherie', portionType: 'quantity' },
  { id: 2, name: 'Bœuf (haché)', type: 'proteine', rayon: 'boucherie', portionType: 'weight', portionWeight: 125 },
  { id: 3, name: 'Bœuf (rôti)', type: 'proteine', rayon: 'boucherie', portionType: 'weight', portionWeight: 150 },

  // Boucherie - Porc
  { id: 4, name: 'Porc (côtelette)', type: 'proteine', rayon: 'boucherie', portionType: 'quantity' },
  { id: 5, name: 'Porc (filet mignon)', type: 'proteine', rayon: 'boucherie', portionType: 'weight', portionWeight: 150 },
  { id: 6, name: 'Saucisse', type: 'proteine', rayon: 'boucherie', portionType: 'quantity' },
  { id: 7, name: 'Lardons', type: 'autre', rayon: 'boucherie', portionType: 'weight', portionWeight: 75 },

  // Boucherie - Volaille
  { id: 8, name: 'Poulet (escalope)', type: 'proteine', rayon: 'boucherie', portionType: 'quantity' },
  { id: 9, name: 'Poulet (cuisse)', type: 'proteine', rayon: 'boucherie', portionType: 'quantity' },
  { id: 10, name: 'Poulet (aile)', type: 'proteine', rayon: 'boucherie', portionType: 'quantity' },
  { id: 11, name: 'Dinde (escalope)', type: 'proteine', rayon: 'boucherie', portionType: 'quantity' },
  { id: 12, name: 'Dinde (rôti)', type: 'proteine', rayon: 'boucherie', portionType: 'weight', portionWeight: 150 },

  // Boucherie - Autres viandes
  { id: 13, name: 'Veau (escalope)', type: 'proteine', rayon: 'boucherie', portionType: 'quantity' },
  { id: 14, name: 'Veau (côte)', type: 'proteine', rayon: 'boucherie', portionType: 'quantity' },
  { id: 15, name: 'Agneau (gigot)', type: 'proteine', rayon: 'boucherie', portionType: 'weight', portionWeight: 150 },
  { id: 16, name: 'Agneau (côtelette)', type: 'proteine', rayon: 'boucherie', portionType: 'quantity' },
  { id: 17, name: 'Canard (magret)', type: 'proteine', rayon: 'boucherie', portionType: 'quantity' },
  { id: 18, name: 'Canard (confit)', type: 'proteine', rayon: 'boucherie', portionType: 'quantity' },

  // Poissonnerie
  { id: 19, name: 'Saumon', type: 'proteine', rayon: 'poissonnerie', portionType: 'weight', portionWeight: 150 },
  { id: 20, name: 'Thon frais', type: 'proteine', rayon: 'poissonnerie', portionType: 'weight', portionWeight: 150 },
  { id: 21, name: 'Thon en conserve', type: 'proteine', rayon: 'epicerie', portionType: 'quantity' },
  { id: 22, name: 'Cabillaud', type: 'proteine', rayon: 'poissonnerie', portionType: 'weight', portionWeight: 150 },
  { id: 23, name: 'Lieu noir', type: 'proteine', rayon: 'poissonnerie', portionType: 'weight', portionWeight: 150 },
  { id: 24, name: 'Sardine', type: 'proteine', rayon: 'poissonnerie', portionType: 'quantity' },
  { id: 25, name: 'Maquereau', type: 'proteine', rayon: 'poissonnerie', portionType: 'quantity' },
  { id: 26, name: 'Crevettes', type: 'proteine', rayon: 'poissonnerie', portionType: 'weight', portionWeight: 150 },
  { id: 27, name: 'Moules', type: 'proteine', rayon: 'poissonnerie', portionType: 'weight', portionWeight: 400 },
  { id: 28, name: 'Huîtres', type: 'proteine', rayon: 'poissonnerie', portionType: 'quantity' },
  { id: 29, name: 'Saint-Jacques', type: 'proteine', rayon: 'poissonnerie', portionType: 'quantity' },

  // Protéines alternatives
  { id: 30, name: 'Œufs', type: 'proteine', rayon: 'cremerie', portionType: 'quantity' },
  { id: 31, name: 'Tofu', type: 'proteine', rayon: 'epicerie', portionType: 'weight', portionWeight: 150 },
  { id: 32, name: 'Tempeh', type: 'proteine', rayon: 'epicerie', portionType: 'weight', portionWeight: 100 },
  { id: 33, name: 'Seitan', type: 'proteine', rayon: 'epicerie', portionType: 'weight', portionWeight: 100 },

  // Légumineuses
  { id: 34, name: 'Lentilles vertes', type: 'proteine', rayon: 'epicerie', portionType: 'weight', portionWeight: 80 },
  { id: 35, name: 'Lentilles corail', type: 'proteine', rayon: 'epicerie', portionType: 'weight', portionWeight: 80 },
  { id: 36, name: 'Lentilles brunes', type: 'proteine', rayon: 'epicerie', portionType: 'weight', portionWeight: 80 },
  { id: 37, name: 'Pois chiches', type: 'proteine', rayon: 'epicerie', portionType: 'weight', portionWeight: 80 },
  { id: 38, name: 'Haricots rouges', type: 'proteine', rayon: 'epicerie', portionType: 'weight', portionWeight: 80 },
  { id: 39, name: 'Haricots blancs', type: 'proteine', rayon: 'epicerie', portionType: 'weight', portionWeight: 80 },
  { id: 40, name: 'Soja', type: 'proteine', rayon: 'epicerie', portionType: 'weight', portionWeight: 80 },

  // Légumes feuilles
  { id: 41, name: 'Salade (laitue)', type: 'legume', rayon: 'frais', portionType: 'quantity' },
  { id: 42, name: 'Roquette', type: 'legume', rayon: 'frais', portionType: 'quantity' },
  { id: 43, name: 'Mâche', type: 'legume', rayon: 'frais', portionType: 'quantity' },
  { id: 44, name: 'Épinards', type: 'legume', rayon: 'frais', portionType: 'weight', portionWeight: 200 },
  { id: 45, name: 'Blettes', type: 'legume', rayon: 'frais', portionType: 'weight', portionWeight: 200 },

  // Choux
  { id: 46, name: 'Chou vert', type: 'legume', rayon: 'frais', portionType: 'weight', portionWeight: 200 },
  { id: 47, name: 'Chou rouge', type: 'legume', rayon: 'frais', portionType: 'weight', portionWeight: 200 },
  { id: 48, name: 'Chou frisé', type: 'legume', rayon: 'frais', portionType: 'weight', portionWeight: 150 },

  // Légumes racines
  { id: 49, name: 'Pomme de terre', type: 'feculent', rayon: 'frais', portionType: 'weight', portionWeight: 200 },
  { id: 50, name: 'Carotte', type: 'legume', rayon: 'frais', portionType: 'quantity' },
  { id: 51, name: 'Navet', type: 'legume', rayon: 'frais', portionType: 'quantity' },
  { id: 52, name: 'Panais', type: 'legume', rayon: 'frais', portionType: 'quantity' },
  { id: 53, name: 'Betterave', type: 'legume', rayon: 'frais', portionType: 'quantity' },
  { id: 54, name: 'Radis', type: 'legume', rayon: 'frais', portionType: 'quantity' },

  // Tomates
  { id: 55, name: 'Tomate fraîche', type: 'legume', rayon: 'frais', portionType: 'quantity' },
  { id: 56, name: 'Tomate concassée', type: 'legume', rayon: 'epicerie', portionType: 'quantity' },
  { id: 57, name: 'Concentré de tomate', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },

  // Légumes fruits
  { id: 58, name: 'Courgette', type: 'legume', rayon: 'frais', portionType: 'quantity' },
  { id: 59, name: 'Aubergine', type: 'legume', rayon: 'frais', portionType: 'quantity' },
  { id: 60, name: 'Poivron vert', type: 'legume', rayon: 'frais', portionType: 'quantity' },
  { id: 61, name: 'Poivron rouge', type: 'legume', rayon: 'frais', portionType: 'quantity' },
  { id: 62, name: 'Poivron jaune', type: 'legume', rayon: 'frais', portionType: 'quantity' },
  { id: 63, name: 'Concombre', type: 'legume', rayon: 'frais', portionType: 'quantity' },
  { id: 64, name: 'Avocat', type: 'legume', rayon: 'frais', portionType: 'quantity' },

  // Cucurbitacées
  { id: 65, name: 'Citrouille', type: 'legume', rayon: 'frais', portionType: 'weight', portionWeight: 250 },
  { id: 66, name: 'Potimarron', type: 'legume', rayon: 'frais', portionType: 'weight', portionWeight: 250 },

  // Alliacés
  { id: 67, name: 'Oignon', type: 'legume', rayon: 'frais', portionType: 'quantity' },
  { id: 68, name: 'Ail', type: 'autre', rayon: 'frais', portionType: 'quantity' },
  { id: 69, name: 'Échalote', type: 'autre', rayon: 'frais', portionType: 'quantity' },
  { id: 70, name: 'Poireau', type: 'legume', rayon: 'frais', portionType: 'quantity' },

  // Légumes fleurs
  { id: 71, name: 'Brocoli', type: 'legume', rayon: 'frais', portionType: 'quantity' },
  { id: 72, name: 'Chou-fleur', type: 'legume', rayon: 'frais', portionType: 'quantity' },
  { id: 73, name: 'Asperge', type: 'legume', rayon: 'frais', portionType: 'quantity' },

  // Légumes cosses
  { id: 74, name: 'Haricots verts', type: 'legume', rayon: 'frais', portionType: 'weight', portionWeight: 200 },
  { id: 75, name: 'Petits pois', type: 'legume', rayon: 'frais', portionType: 'weight', portionWeight: 150 },

  // Champignons
  { id: 76, name: 'Champignons de Paris', type: 'legume', rayon: 'frais', portionType: 'weight', portionWeight: 150 },

  // Pâtes
  { id: 77, name: 'Pâtes spaghetti', type: 'feculent', rayon: 'epicerie', portionType: 'weight', portionWeight: 100 },
  { id: 78, name: 'Pâtes penne', type: 'feculent', rayon: 'epicerie', portionType: 'weight', portionWeight: 100 },
  { id: 79, name: 'Lasagne', type: 'feculent', rayon: 'epicerie', portionType: 'weight', portionWeight: 100 },

  // Riz
  { id: 80, name: 'Riz basmati', type: 'feculent', rayon: 'epicerie', portionType: 'weight', portionWeight: 80 },
  { id: 81, name: 'Riz thaï', type: 'feculent', rayon: 'epicerie', portionType: 'weight', portionWeight: 80 },
  { id: 82, name: 'Riz rond', type: 'feculent', rayon: 'epicerie', portionType: 'weight', portionWeight: 80 },
  { id: 83, name: 'Riz complet', type: 'feculent', rayon: 'epicerie', portionType: 'weight', portionWeight: 80 },

  // Autres céréales
  { id: 84, name: 'Semoule', type: 'feculent', rayon: 'epicerie', portionType: 'weight', portionWeight: 70 },
  { id: 85, name: 'Boulgour', type: 'feculent', rayon: 'epicerie', portionType: 'weight', portionWeight: 70 },
  { id: 86, name: 'Épeautre', type: 'feculent', rayon: 'epicerie', portionType: 'weight', portionWeight: 70 },
  { id: 87, name: 'Quinoa', type: 'feculent', rayon: 'epicerie', portionType: 'weight', portionWeight: 70 },
  { id: 88, name: 'Sarrasin', type: 'feculent', rayon: 'epicerie', portionType: 'weight', portionWeight: 70 },
  { id: 89, name: 'Maïs en grain', type: 'feculent', rayon: 'epicerie', portionType: 'weight', portionWeight: 80 },
  { id: 90, name: 'Polenta', type: 'feculent', rayon: 'epicerie', portionType: 'weight', portionWeight: 70 },

  // Pain
  { id: 91, name: 'Baguette', type: 'feculent', rayon: 'boulangerie', portionType: 'weight', portionWeight: 50 },
  { id: 92, name: 'Pain de mie', type: 'feculent', rayon: 'boulangerie', portionType: 'quantity' },
  { id: 93, name: 'Pain complet', type: 'feculent', rayon: 'boulangerie', portionType: 'weight', portionWeight: 50 },
  { id: 94, name: 'Flocons d\'avoine', type: 'feculent', rayon: 'epicerie', portionType: 'weight', portionWeight: 60 },

  // Fruits
  { id: 95, name: 'Pomme', type: 'autre', rayon: 'frais', portionType: 'quantity' },
  { id: 96, name: 'Poire', type: 'autre', rayon: 'frais', portionType: 'quantity' },
  { id: 97, name: 'Banane', type: 'autre', rayon: 'frais', portionType: 'quantity' },
  { id: 98, name: 'Orange', type: 'autre', rayon: 'frais', portionType: 'quantity' },
  { id: 99, name: 'Citron', type: 'autre', rayon: 'frais', portionType: 'quantity' },
  { id: 100, name: 'Clémentine', type: 'autre', rayon: 'frais', portionType: 'quantity' },
  { id: 101, name: 'Mandarine', type: 'autre', rayon: 'frais', portionType: 'quantity' },
  { id: 102, name: 'Pamplemousse', type: 'autre', rayon: 'frais', portionType: 'quantity' },
  { id: 103, name: 'Fraise', type: 'autre', rayon: 'frais', portionType: 'weight', portionWeight: 250 },
  { id: 104, name: 'Framboise', type: 'autre', rayon: 'frais', portionType: 'weight', portionWeight: 150 },
  { id: 105, name: 'Myrtille', type: 'autre', rayon: 'frais', portionType: 'weight', portionWeight: 150 },
  { id: 106, name: 'Pêche', type: 'autre', rayon: 'frais', portionType: 'quantity' },
  { id: 107, name: 'Abricot', type: 'autre', rayon: 'frais', portionType: 'quantity' },
  { id: 108, name: 'Raisin', type: 'autre', rayon: 'frais', portionType: 'weight', portionWeight: 200 },
  { id: 109, name: 'Kiwi', type: 'autre', rayon: 'frais', portionType: 'quantity' },
  { id: 110, name: 'Melon', type: 'autre', rayon: 'frais', portionType: 'quantity' },
  { id: 111, name: 'Pastèque', type: 'autre', rayon: 'frais', portionType: 'weight', portionWeight: 300 },

  // Produits laitiers
  { id: 112, name: 'Lait de vache', type: 'autre', rayon: 'cremerie', portionType: 'volume', portionWeight: 250 },
  { id: 113, name: 'Lait de chèvre', type: 'autre', rayon: 'cremerie', portionType: 'volume', portionWeight: 250 },
  { id: 114, name: 'Lait de brebis', type: 'autre', rayon: 'cremerie', portionType: 'volume', portionWeight: 250 },
  { id: 115, name: 'Yaourt nature', type: 'autre', rayon: 'cremerie', portionType: 'quantity' },
  { id: 116, name: 'Fromage blanc', type: 'autre', rayon: 'cremerie', portionType: 'weight', portionWeight: 100 },
  { id: 117, name: 'Crème fraîche liquide', type: 'autre', rayon: 'cremerie', portionType: 'volume', portionWeight: 100 },
  { id: 118, name: 'Crème fraîche épaisse', type: 'autre', rayon: 'cremerie', portionType: 'weight', portionWeight: 100 },
  { id: 119, name: 'Beurre', type: 'autre', rayon: 'cremerie', portionType: 'weight', portionWeight: 50 },

  // Fromages
  { id: 120, name: 'Emmental', type: 'autre', rayon: 'cremerie', portionType: 'weight', portionWeight: 50 },
  { id: 121, name: 'Comté', type: 'autre', rayon: 'cremerie', portionType: 'weight', portionWeight: 50 },
  { id: 122, name: 'Chèvre', type: 'autre', rayon: 'cremerie', portionType: 'weight', portionWeight: 50 },
  { id: 123, name: 'Parmesan', type: 'autre', rayon: 'cremerie', portionType: 'weight', portionWeight: 30 },
  { id: 124, name: 'Mozzarella', type: 'autre', rayon: 'cremerie', portionType: 'weight', portionWeight: 100 },
  { id: 125, name: 'Roquefort', type: 'autre', rayon: 'cremerie', portionType: 'weight', portionWeight: 40 },

  // Alternatives végétales
  { id: 126, name: 'Boisson soja', type: 'autre', rayon: 'epicerie', portionType: 'volume', portionWeight: 250 },
  { id: 127, name: 'Boisson amande', type: 'autre', rayon: 'epicerie', portionType: 'volume', portionWeight: 250 },
  { id: 128, name: 'Boisson avoine', type: 'autre', rayon: 'epicerie', portionType: 'volume', portionWeight: 250 },
  { id: 129, name: 'Crème soja', type: 'autre', rayon: 'epicerie', portionType: 'volume', portionWeight: 100 },
  { id: 130, name: 'Crème coco', type: 'autre', rayon: 'epicerie', portionType: 'volume', portionWeight: 100 },
  { id: 131, name: 'Margarine', type: 'autre', rayon: 'epicerie', portionType: 'weight', portionWeight: 50 },

  // Huiles et vinaigres
  { id: 132, name: 'Huile d\'olive', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 133, name: 'Huile de tournesol', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 134, name: 'Vinaigre de vin', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 135, name: 'Vinaigre de cidre', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 136, name: 'Vinaigre balsamique', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },

  // Condiments
  { id: 137, name: 'Moutarde', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 138, name: 'Mayonnaise', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 139, name: 'Ketchup', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 140, name: 'Sauce soja', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },

  // Sucres
  { id: 141, name: 'Miel', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 142, name: 'Sirop d\'érable', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 143, name: 'Sucre blanc', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 144, name: 'Sucre roux', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },

  // Farines et levures
  { id: 145, name: 'Farine de blé', type: 'autre', rayon: 'epicerie', portionType: 'weight', portionWeight: 50 },
  { id: 146, name: 'Levure chimique', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },

  // Bouillons
  { id: 147, name: 'Bouillon cube', type: 'autre', rayon: 'epicerie', portionType: 'quantity' },
  { id: 148, name: 'Bouillon poudre', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },

  // Épices et herbes
  { id: 149, name: 'Sel', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 150, name: 'Poivre', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 151, name: 'Herbes de Provence', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 152, name: 'Persil', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 153, name: 'Ciboulette', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 154, name: 'Basilic', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 155, name: 'Thym', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 156, name: 'Laurier', type: 'autre', rayon: 'epicerie', portionType: 'quantity' },
  { id: 157, name: 'Paprika', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 158, name: 'Cumin', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 159, name: 'Curry', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 160, name: 'Noix de muscade', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },

  // Fruits secs
  { id: 161, name: 'Noix de Grenoble', type: 'autre', rayon: 'epicerie', portionType: 'weight', portionWeight: 50 },
  { id: 162, name: 'Noix de cajou', type: 'autre', rayon: 'epicerie', portionType: 'weight', portionWeight: 50 },
  { id: 163, name: 'Amandes', type: 'autre', rayon: 'epicerie', portionType: 'weight', portionWeight: 50 },

  // Divers
  { id: 164, name: 'Chocolat noir', type: 'autre', rayon: 'epicerie', portionType: 'weight', portionWeight: 50 },
  { id: 165, name: 'Café', type: 'autre', rayon: 'epicerie', portionType: 'spoon' },
  { id: 166, name: 'Thé', type: 'autre', rayon: 'epicerie', portionType: 'quantity' }
];

// Tags pré-définis
export const PREDEFINED_TAGS = [
  { id: 1, name: 'Végétarien', emoji: '🌱', color: '#10b981' },
  { id: 2, name: 'Vegan', emoji: '🥬', color: '#059669' },
  { id: 3, name: 'Sans gluten', emoji: '🌾', color: '#f59e0b' },
  { id: 4, name: 'Sans lactose', emoji: '🥛', color: '#3b82f6' },
  { id: 5, name: 'Rapide', emoji: '⚡', color: '#eab308' },
  { id: 6, name: 'Élaboré', emoji: '👨‍🍳', color: '#8b5cf6' },
  { id: 7, name: 'Congélation', emoji: '❄️', color: '#06b6d4' },
  { id: 8, name: 'Épicé', emoji: '🔥', color: '#ef4444' }
];

// Données saisonnières
export const SEASONAL_DATA = {
  legumes: [
    { name: 'Artichaut', months: [5, 6, 7, 9, 10] },
    { name: 'Asperge', months: [4, 5, 6] },
    { name: 'Aubergine', months: [6, 7, 8, 9] },
    { name: 'Betterave', months: [5, 6, 7, 8, 9, 10] },
    { name: 'Blette', months: [5, 6, 7, 8, 9, 10, 11] },
    { name: 'Brocoli', months: [9, 10, 11, 12, 1, 2, 3, 4] },
    { name: 'Carotte', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    { name: 'Céleri', months: [8, 9, 10, 11, 12] },
    { name: 'Champignon', months: [9, 10, 11, 12, 1] },
    { name: 'Chou blanc', months: [1, 2, 3, 9, 10, 11, 12] },
    { name: 'Chou-fleur', months: [9, 10, 11, 12, 1, 2, 3, 4, 5] },
    { name: 'Chou de Bruxelles', months: [10, 11, 12, 1, 2] },
    { name: 'Chou rouge', months: [10, 11, 12, 1, 2, 3] },
    { name: 'Concombre', months: [5, 6, 7, 8, 9] },
    { name: 'Courge', months: [9, 10, 11, 12, 1, 2] },
    { name: 'Courgette', months: [5, 6, 7, 8, 9, 10] },
    { name: 'Endive', months: [10, 11, 12, 1, 2, 3, 4] },
    { name: 'Épinard', months: [1, 2, 3, 4, 9, 10, 11, 12] },
    { name: 'Fenouil', months: [5, 6, 7, 8, 9, 10] },
    { name: 'Haricot vert', months: [6, 7, 8, 9, 10] },
    { name: 'Laitue', months: [4, 5, 6, 7, 8, 9, 10] },
    { name: 'Navet', months: [10, 11, 12, 1, 2, 3, 4, 5] },
    { name: 'Oignon', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    { name: 'Panais', months: [10, 11, 12, 1, 2, 3] },
    { name: 'Petit pois', months: [5, 6, 7] },
    { name: 'Poireau', months: [1, 2, 3, 9, 10, 11, 12] },
    { name: 'Poivron', months: [6, 7, 8, 9, 10] },
    { name: 'Pomme de terre', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    { name: 'Potiron', months: [9, 10, 11, 12, 1] },
    { name: 'Radis', months: [3, 4, 5, 6, 7, 8, 9] },
    { name: 'Salade', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    { name: 'Tomate', months: [5, 6, 7, 8, 9, 10] }
  ],
  fruits: [
    { name: 'Abricot', months: [6, 7, 8] },
    { name: 'Ananas', months: [1, 2, 3, 11, 12] },
    { name: 'Banane', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
    { name: 'Cassis', months: [6, 7, 8] },
    { name: 'Cerise', months: [5, 6, 7, 8] },
    { name: 'Châtaigne', months: [10, 11, 12] },
    { name: 'Citron', months: [1, 2, 3, 11, 12] },
    { name: 'Clémentine', months: [11, 12, 1, 2] },
    { name: 'Coing', months: [9, 10, 11] },
    { name: 'Fraise', months: [4, 5, 6, 7] },
    { name: 'Framboise', months: [6, 7, 8, 9] },
    { name: 'Groseille', months: [6, 7, 8] },
    { name: 'Kiwi', months: [11, 12, 1, 2, 3, 4] },
    { name: 'Mandarine', months: [11, 12, 1, 2] },
    { name: 'Mangue', months: [12, 1, 2, 3, 4] },
    { name: 'Melon', months: [6, 7, 8, 9] },
    { name: 'Mirabelle', months: [8, 9] },
    { name: 'Mûre', months: [7, 8, 9] },
    { name: 'Myrtille', months: [7, 8, 9] },
    { name: 'Nectarine', months: [6, 7, 8, 9] },
    { name: 'Noix', months: [9, 10, 11, 12] },
    { name: 'Orange', months: [12, 1, 2, 3, 4] },
    { name: 'Pamplemousse', months: [11, 12, 1, 2, 3, 4] },
    { name: 'Pastèque', months: [6, 7, 8, 9] },
    { name: 'Pêche', months: [6, 7, 8, 9] },
    { name: 'Poire', months: [8, 9, 10, 11, 12, 1] },
    { name: 'Pomme', months: [8, 9, 10, 11, 12, 1, 2, 3, 4] },
    { name: 'Prune', months: [7, 8, 9, 10] },
    { name: 'Raisin', months: [8, 9, 10, 11] },
    { name: 'Rhubarbe', months: [4, 5, 6] }
  ]
};

// Labels des rayons
export const RAYON_LABELS = {
  frais: '🥬 Fruits & Légumes',
  boucherie: '🍖 Boucherie',
  poissonnerie: '🐟 Poissonnerie',
  cremerie: '🧀 Crèmerie',
  epicerie: '🛒 Épicerie',
  surgeles: '❄️ Surgelés',
  boulangerie: '🥖 Boulangerie'
};

// Labels des statuts de repas
export const STATUS_LABELS = {
  restaurant: '🍴 Restaurant',
  verseaux: '🏡 Les Verseaux',
  copains: '👥 Copains',
  joker: '🃏 Joker'
};

// Jours de la semaine
export const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// Repas
export const MEALS = ['midi', 'soir'];
