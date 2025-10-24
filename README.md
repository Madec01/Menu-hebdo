# 🍽️ Menu Hebdo - Planificateur de Menus

> Application web moderne de planification de menus hebdomadaires avec génération automatique de liste de courses

[![Version](https://img.shields.io/badge/version-2.0-blue.svg)](https://github.com/Madec01/Menu-hebdo)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## ✨ Fonctionnalités

### 📅 Gestion des Menus
- **Planification hebdomadaire** : Organisez vos repas du lundi au dimanche, midi et soir
- **Gestion multi-semaines** : Créez et gérez plusieurs semaines de menus
- **Portions personnalisables** : Ajustez le nombre de portions par défaut et par repas
- **Statuts de repas** : Restaurant, chez des amis, joker, etc.
- **Copier/coller** : Dupliquez rapidement un repas
- **Génération aléatoire** : Créez automatiquement des repas équilibrés

### 🥕 Base d'Ingrédients
- **166 ingrédients pré-configurés** avec types de portions intelligents
- **Types** : Protéines, féculents, légumes, autres
- **Rayons** : Boucherie, poissonnerie, fruits & légumes, etc.
- **Portions intelligentes** : Poids, volume, quantité ou cuillères
- **Favoris** : Marquez vos ingrédients préférés
- **Création rapide** : Ajoutez de nouveaux ingrédients à la volée

### 📖 Recettes
- **Bibliothèque de recettes** personnalisée
- **Tags pré-définis** : Végétarien, vegan, rapide, sans gluten, etc.
- **Tags personnalisés** : Créez vos propres catégories avec émojis et couleurs
- **Association au menu** : Ajoutez directement une recette à un repas

### 🛒 Liste de Courses
- **Génération automatique** : Calcule automatiquement les quantités nécessaires
- **Regroupement par rayon** : Organisée selon votre parcours en magasin
- **Calcul intelligent** : Adapte les quantités selon le type de portion
- **Articles personnalisés** : Ajoutez des éléments hors-menu
- **Export PDF** : Téléchargez votre liste pour l'imprimer
- **Cocher les articles** : Suivez votre avancement en magasin

### 📅 Calendrier Saisonnier
- **Fruits et légumes de saison** : Consultez les produits de saison mois par mois
- **Distinction pleine saison** : Identifiez les périodes optimales
- **Recherche** : Trouvez rapidement un produit

### 🎨 Personnalisation
- **3 thèmes** : Sombre, clair, forêt
- **Interface moderne** : Design glassmorphism avec animations fluides
- **Responsive** : Adapté aux mobiles, tablettes et ordinateurs
- **Accessibilité** : Navigation au clavier et lecteurs d'écran

### 💾 Sauvegarde Locale
- **localStorage** : Toutes vos données restent sur votre appareil
- **Aucun compte requis** : Utilisez l'application immédiatement
- **Confidentialité totale** : Vos données ne quittent jamais votre navigateur

## 🚀 Installation

### Utilisation directe
1. Clonez le repository :
```bash
git clone https://github.com/Madec01/Menu-hebdo.git
cd Menu-hebdo
```

2. Ouvrez `index.html` dans votre navigateur ou utilisez un serveur local :
```bash
# Avec Python
python -m http.server 8000

# Avec Node.js
npx serve

# Ou directement
open index.html
```

## 📁 Structure du Projet

```
Menu-hebdo/
├── index.html              # Page principale
├── README.md              # Documentation
├── src/
│   ├── css/
│   │   └── style.css      # Styles optimisés
│   ├── js/
│   │   ├── app.js         # Application principale (classe MenuApp)
│   │   ├── data.js        # Données par défaut (ingrédients, saisonnalité)
│   │   ├── storage.js     # Gestion du localStorage
│   │   └── utils.js       # Fonctions utilitaires
│   └── assets/            # Ressources (images, etc.)
└── .git/                  # Repository Git
```

## 🛠️ Technologies Utilisées

- **HTML5** : Structure sémantique et accessible
- **CSS3** : Variables CSS, Grid, Flexbox, animations
- **JavaScript ES6+** : Modules, classes, async/await
- **jsPDF** : Génération de PDF pour les listes de courses
- **localStorage API** : Sauvegarde locale des données

## 💡 Utilisation

### Créer une Semaine
1. Cliquez sur "Gestion semaines"
2. Cliquez sur le bouton "➕ Créer une semaine"
3. Donnez un nom et choisissez la date de début (lundi)

### Planifier un Repas
1. Ouvrez une semaine
2. Cliquez sur une cellule de repas
3. Tapez le nom d'un ingrédient ou d'une recette
4. Sélectionnez dans l'autocomplete

### Générer la Liste de Courses
1. Cliquez sur "🛒 Générer liste de courses"
2. Cochez les articles achetés
3. Exportez en PDF si nécessaire

## 🎯 Améliorations v2.0

### Architecture
- ✅ Code modulaire séparé en fichiers distincts
- ✅ Classes ES6 et modules JavaScript
- ✅ Gestion d'erreurs robuste

### Performance
- ✅ Debouncing des recherches
- ✅ Manipulation DOM optimisée
- ✅ Code splitting

### Accessibilité
- ✅ Rôles ARIA complets
- ✅ Navigation au clavier
- ✅ Labels et descriptions

### UX
- ✅ Animations fluides
- ✅ Design moderne glassmorphism
- ✅ Responsive sur tous les écrans

## 🐛 Dépannage

### L'application ne se charge pas
- Vérifiez que JavaScript est activé
- Utilisez un navigateur moderne (Chrome, Firefox, Safari, Edge)
- Consultez la console développeur (F12)

### Les données ne se sauvent pas
- Ne pas être en navigation privée
- Vérifier l'espace localStorage disponible
- Vider le cache du navigateur

## 📄 Licence

MIT License - Voir le fichier LICENSE pour plus de détails.

## 👨‍💻 Auteur

**Menu Hebdo Team**
- Optimisé avec ❤️ par Claude Code

## 🙏 Remerciements

- [jsPDF](https://github.com/parallax/jsPDF) pour la génération de PDF
- [Google Fonts](https://fonts.google.com/) pour la police Inter
- La communauté open source

---

**⭐ N'oubliez pas de mettre une étoile au projet si vous l'aimez !**