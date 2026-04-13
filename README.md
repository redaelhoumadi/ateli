# Ateli POS — Concept Store

Interface POS complète avec système de fidélité, construite avec Next.js 14, TypeScript, Tailwind CSS et Supabase.

## Fonctionnalités

- **Caisse POS** : catalogue produits, filtres par marque, recherche, panier
- **Fidélité client** : création de compte, cumul de points, utilisation des points
- **Encaissement** : CB, espèces (avec calculateur de monnaie), mixte
- **Dashboard** : chiffre d'affaires, top produits, historique des ventes
- **Gestion clients** : annuaire avec solde de points

## Installation

```bash
# 1. Cloner le repo
git clone https://github.com/redaelhoumadi/ateli.git
cd ateli

# 3. Installer les dépendances
npm install

# 4. Lancer en développement
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) — vous serez redirigé vers `/pos`.


## Technologies

- [Next.js 14](https://nextjs.org/) — App Router
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) — base de données + auth
- [Zustand](https://zustand-demo.pmnd.rs/) — état global du panier
#
