# ACS Backend

## Description

Ce projet est le backend de l'application ACS (Alors ça scrim). Il permet de gérer les tournois, les joueurs, les équipes, les scores et l'authentification des utilisateurs.

## Technologies

- Node.js
- Express.js
- MongoDB
- OAuth (avec Discord si possible)

## Fonctionnalités

- Création de tournois
- Ajout de joueurs aux tournois
- Génération d'équipes via drag and drop ou bouton de génération d'équipe équitable
- Gestion des points et attribution de l'équipe gagnante
- Création de comptes et authentification (via Discord ou OAuth)
- Gestion des rôles (admin, user)
- Classements et statistiques

## Modèle de Données

### Utilisateur

```json
{
  "id": "string",
  "username": "string",
  "email": "string",
  "password": "string",
  "role": "string", // "admin" ou "user"
  "discordId": "string", // ID Discord si l'utilisateur s'authentifie via Discord
  "stats": {
    "bestGame": "string",
    "bestScore": "number",
    "pointsRatio": "number"
  }
}
```

Joueur

```json
{
  "id": "string",
  "name": "string",
  "tier": "number",
  "game": "string",
  "totalPoints": "number"
}
```

Tournoi

```json
{
  "id": "string",
  "name": "string",
  "game": "string",
  "date": "date",
  "players": ["string"], // Liste des IDs des joueurs
  "teams": [
    {
      "id": "string",
      "name": "string",
      "players": ["string"], // Liste des IDs des joueurs
      "score": "number"
    }
  ]
}
```

# API Endpoints (temporaire)

## Utilisateurs

- **POST** `/api/users/register` : Créer un nouvel utilisateur
- **POST** `/api/users/login` : Authentifier un utilisateur
- **GET** `/api/users/profile` : Récupérer le profil de l'utilisateur connecté

## Joueurs

- **GET** `/api/players` : Récupérer la liste des joueurs
- **POST** `/api/players` : Ajouter un nouveau joueur
- **PUT** `/api/players/:id` : Mettre à jour un joueur
- **DELETE** `/api/players/:id` : Supprimer un joueur

## Tournois

- **GET** `/api/tournaments` : Récupérer la liste des tournois
- **POST** `/api/tournaments` : Créer un nouveau tournoi
- **GET** `/api/tournaments/:id` : Récupérer les détails d'un tournoi
- **PUT** `/api/tournaments/:id` : Mettre à jour un tournoi
- **DELETE** `/api/tournaments/:id` : Supprimer un tournoi

## Gestion des Rôles

### Admin

- Accès à la création de tournois
- Modification des équipes
- Attribution des points

### User

- Accès au classement
- Visualisation des tournois et des équipes sans modification
- Accès au profil de joueur avec statistiques

## Authentification

L'authentification sera gérée via **OAuth**, avec une préférence pour l'authentification via **Discord**. Les utilisateurs pourront associer leur compte avec un utilisateur en base de données grâce à leur nom.

## Installation

- Clonez le dépôt : git clone https://github.com/tekninon/acs-backend.git
  cd acs-backend

* Installez les dépendances
  npm install

## Fichier d'env (temporaire)

PORT=3000
MONGODB_URI=mongodb://localhost:27017/acs
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback
JWT_SECRET=your_jwt_secret

- Démarrez le serveur
  npm run dev

En suivant ces étapes et en configurant correctement votre fichier `.gitignore`, vous pouvez vous assurer que vos informations sensibles ne seront pas poussées sur GitHub.
