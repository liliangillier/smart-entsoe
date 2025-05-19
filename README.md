# 🌍 ENTSO-E Dashboard

**🔗 Site en ligne : [https://votre-site.com](https://votre-site.com)**  
**🔗 Code source GitHub : [https://github.com/ton-utilisateur/entsoe-dashboard](https://github.com/ton-utilisateur/entsoe-dashboard)**

Une application web pour récupérer, visualiser et exporter les données énergétiques fournies par l'ENTSO-E (European Network of Transmission System Operators for Electricity).

---

## 🚀 Fonctionnalités

- 🔍 Récupération des données énergétiques via l'API ENTSO-E (format XML)
- 📊 Visualisation structurée des séries temporelles (consommation, production, etc.)
- 📥 Export des données au format Excel
- ⚙️ Interface intuitive avec une interface responsive en Tailwind CSS

## 🛠️ Technologies utilisées

- **Next.js / React**
- **Tailwind CSS** pour le style
- **fast-xml-parser** pour parser les fichiers XML
- **xlsx** pour l’export en Excel

## 📁 Structure des fichiers principaux

- `page.tsx` : page principale du dashboard
- `data-fetcher.tsx` : composant de récupération et affichage des données
- `xml-parser.ts` : fonction de parsing XML vers JSON
- `excel-export.ts` : fonction d’export des données au format Excel

## 📦 Installation

1. Clone le repo :

````bash
git clone https://github.com/ton-utilisateur/entsoe-dashboard.git
cd entsoe-dashboard

2. Installe les dépendances :

```bash
npm install
````

3. Démarre le serveur local :

```bash
npm run dev
```

## 📤 Export Excel

Les données affichées peuvent être exportées en un clic dans un fichier .xlsx avec des colonnes auto-ajustées en largeur.

## 🧪 Exemple de données supportées

Les fichiers XML de l’ENTSO-E peuvent contenir différents types de documents :

- Publication_MarketDocument
- GL_MarketDocument
- Unavailability_MarketDocument
- BalancingMarketDocument

## 👤 Auteur

Projet développé par LG
