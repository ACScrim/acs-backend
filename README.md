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
- Création de comptes et authentification (via Discord)
- Gestion des rôles (admin, user)
- Classements et statistiques

## Guide d'installation

### Prérequis

- [Node.js](https://nodejs.org/) (v14.x ou supérieur)
- [MongoDB](https://www.mongodb.com/try/download/community) (v4.4 ou supérieur)
- [npm](https://www.npmjs.com/) (v6.x ou supérieur) ou [yarn](https://yarnpkg.com/)
- [Git](https://git-scm.com/downloads)

### Étapes d'installation

1. **Cloner le dépôt**

   ```bash
   git clone https://github.com/votre-utilisateur/acs-backend.git
   cd acs-backend
   ```

2. **Installer les dépendances**

```bash
 npm install
  # ou avec yarn
  yarn install
```

3. **Configuration des variables d'environnement**
   Créez un fichier .env à la racine du projet avec les variables suivantes :

NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/acs
JWT_SECRET=votre_secret_jwt
JWT_EXPIRE=30d
DISCORD_CLIENT_ID=votre_client_id_discord
DISCORD_CLIENT_SECRET=votre_client_secret_discord
DISCORD_REDIRECT_URI=http://localhost:5000/api/auth/discord/callback
DISCORD_BOT_TOKEN=votre_token_bot_discord
DISCORD_GUILD_ID=votre_id_serveur_discord
RAWG_API_KEY=votre_clé_api_rawg
FRONTEND_URL=http://localhost:5173

4. **Démarrer MongoDB**

# Sur Linux/MacOS

sudo service mongod start

# ou

sudo systemctl start mongod

# Sur Windows, MongoDB s'exécute généralement comme un service

5. **Lancer le serveur en mode développement**
   npm run dev

# ou avec yarn

yarn dev

Configuration Discord Bot (Optionnel)
Pour utiliser les fonctionnalités Discord (création de canaux vocaux, synchronisation des joueurs) :

Créez une application Discord sur le Portail Développeur Discord
Créez un bot pour votre application
Ajoutez les permissions nécessaires au bot (gérer les canaux, gérer les rôles, etc.)
Invitez le bot sur votre serveur Discord
Récupérez le token du bot et ajoutez-le à votre fichier .env
Configuration de l'API RAWG (Optionnel)
Pour utiliser la fonctionnalité de propositions de jeux avec recherche RAWG :

Créez un compte sur RAWG
Récupérez votre clé API
Ajoutez la clé à votre fichier .env (RAWG_API_KEY)

Structure
acs-backend/
├── dist/ # Code compilé pour la production
├── node*modules/ # Dépendances npm
├── src/ # Code source
│ ├── config/ # Configuration
│ ├── controllers/ # Contrôleurs
│ ├── discord-bot/ # Intégration du bot Discord
│ ├── middleware/ # Middleware Express
│ ├── models/ # Modèles Mongoose
│ ├── routes/ # Routes API
│ └── server.js # Point d'entrée de l'application
├── .env # Variables d'environnement
├── .gitignore # Fichiers ignorés par Git
├── package.json # Dépendances et scripts
└── [README.md](http://\_vscodecontentref*/1) # Documentation

## Documentation API

### Tournois

#### Récupération des tournois

- **GET** `/api/tournaments`

  - **Description** : Récupère la liste de tous les tournois
  - **Authentification** : Non requise
  - **Réponse** : 200 OK
    ```json
    [
      {
        "_id": "string",
        "name": "string",
        "game": { "Object" },
        "date": "Date",
        "players": [{ "Object" }],
        "teams": [{ "Object" }],
        "finished": "boolean",
        "discordChannelName": "string",
        "description": "string"
      }
    ]
    ```

- **GET** `/api/tournaments/:id`

  - **Description** : Récupère les détails d'un tournoi spécifique
  - **Paramètres** :
    - `id` : ID du tournoi à récupérer
  - **Authentification** : Non requise
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "name": "string",
      "game": { "Object" },
      "date": "Date",
      "players": [{ "Object" }],
      "teams": [{ "Object" }],
      "finished": "boolean",
      "discordChannelName": "string",
      "description": "string"
    }
    ```

- **GET** `/api/tournaments/game/:gameId`
  - **Description** : Récupère tous les tournois pour un jeu spécifique
  - **Paramètres** :
    - `gameId` : ID du jeu
  - **Authentification** : Requise
  - **Réponse** : 200 OK
    ```json
    [
      {
        "_id": "string",
        "name": "string",
        "game": { "Object" },
        "date": "Date",
        "players": [{ "Object" }],
        "teams": [{ "Object" }],
        "finished": "boolean",
        "discordChannelName": "string",
        "description": "string"
      }
    ]
    ```

#### Création et gestion des tournois

- **POST** `/api/tournaments`

  - **Description** : Crée un nouveau tournoi
  - **Authentification** : Admin requise
  - **Corps de la requête** :
    ```json
    {
      "name": "string",
      "game": "string (ID du jeu)",
      "date": "Date",
      "discordChannelName": "string",
      "players": ["string (ID des joueurs)"],
      "description": "string"
    }
    ```
  - **Réponse** : 201 Created
    ```json
    {
      "_id": "string",
      "name": "string",
      "game": "string",
      "date": "Date",
      "players": ["string"],
      "teams": [],
      "finished": false,
      "discordChannelName": "string",
      "description": "string"
    }
    ```

- **PUT** `/api/tournaments/:id`

  - **Description** : Met à jour un tournoi existant
  - **Paramètres** :
    - `id` : ID du tournoi à mettre à jour
  - **Authentification** : Admin requise
  - **Corps de la requête** :
    ```json
    {
      "name": "string",
      "date": "Date",
      "discordChannelName": "string",
      "players": ["string (ID des joueurs)"],
      "teams": [{ "Object" }],
      "description": "string"
    }
    ```
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "name": "string",
      "game": { "Object" },
      "date": "Date",
      "players": [{ "Object" }],
      "teams": [{ "Object" }],
      "finished": "boolean",
      "discordChannelName": "string",
      "description": "string"
    }
    ```

- **DELETE** `/api/tournaments/:id`
  - **Description** : Supprime un tournoi
  - **Paramètres** :
    - `id` : ID du tournoi à supprimer
  - **Authentification** : Admin requise
  - **Réponse** : 200 OK
    ```json
    {
      "message": "Tournoi supprimé avec succès"
    }
    ```

#### Gestion de la finalisation des tournois

- **PUT** `/api/tournaments/:id/finish`

  - **Description** : Marque un tournoi comme terminé
  - **Paramètres** :
    - `id` : ID du tournoi
  - **Authentification** : Admin requise
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "name": "string",
      "finished": true
      // autres propriétés du tournoi
    }
    ```

- **PUT** `/api/tournaments/:id/mark-finished`

  - **Description** : Marque un tournoi comme terminé en vérifiant que les classements sont définis
  - **Paramètres** :
    - `id` : ID du tournoi
  - **Authentification** : Admin requise
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "name": "string",
      "finished": true
      // autres propriétés du tournoi
    }
    ```

- **PUT** `/api/tournaments/:id/unmark-finished`
  - **Description** : Annule la finalisation d'un tournoi
  - **Paramètres** :
    - `id` : ID du tournoi
  - **Authentification** : Admin requise
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "name": "string",
      "finished": false
      // autres propriétés du tournoi
    }
    ```

#### Gestion des équipes

- **POST** `/api/tournaments/:id/generate-teams`

  - **Description** : Génère automatiquement des équipes pour un tournoi
  - **Paramètres** :
    - `id` : ID du tournoi
  - **Authentification** : Admin requise
  - **Corps de la requête** :
    ```json
    {
      "numTeams": "number"
    }
    ```
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "name": "string",
      "teams": [
        {
          "name": "string",
          "players": [{ "Object" }]
        }
      ],
      // autres propriétés du tournoi
    }
    ```

- **PUT** `/api/tournaments/:id/teams`

  - **Description** : Met à jour les équipes d'un tournoi
  - **Paramètres** :
    - `id` : ID du tournoi
  - **Authentification** : Admin requise
  - **Corps de la requête** :
    ```json
    {
      "teams": [
        {
          "_id": "string (optionnel)",
          "name": "string",
          "players": ["string (ID des joueurs)"]
        }
      ]
    }
    ```
  - **Réponse** : 200 OK
    ```json
    {
      "message": "Équipes mises à jour avec succès",
      "tournament": { "Object" }
    }
    ```

- **DELETE** `/api/tournaments/:id/delete-teams`

  - **Description** : Supprime toutes les équipes d'un tournoi
  - **Paramètres** :
    - `id` : ID du tournoi
  - **Authentification** : Admin requise
  - **Réponse** : 200 OK
    ```json
    {
      "message": "Toutes les équipes ont été supprimées avec succès",
      "tournament": { "Object" }
    }
    ```

- **PUT** `/api/tournaments/:id/teams/:teamId/ranking`

  - **Description** : Met à jour le classement d'une équipe
  - **Paramètres** :
    - `id` : ID du tournoi
    - `teamId` : ID de l'équipe
  - **Authentification** : Requise
  - **Corps de la requête** :
    ```json
    {
      "ranking": "number"
    }
    ```
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "name": "string",
      "teams": [
        {
          "_id": "string",
          "name": "string",
          "ranking": "number",
          "players": [{ "Object" }]
        }
      ],
      // autres propriétés du tournoi
    }
    ```

- **PUT** `/api/tournaments/:id/teams/:teamId/score`
  - **Description** : Met à jour le score d'une équipe
  - **Paramètres** :
    - `id` : ID du tournoi
    - `teamId` : ID de l'équipe
  - **Authentification** : Admin requise
  - **Corps de la requête** :
    ```json
    {
      "score": "number"
    }
    ```
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "name": "string",
      "teams": [
        {
          "_id": "string",
          "name": "string (avec score inclus)",
          "score": "number",
          "players": [{ "Object" }]
        }
      ],
      // autres propriétés du tournoi
    }
    ```

#### Gestion des joueurs dans les tournois

- **POST** `/api/tournaments/:id/register`

  - **Description** : Inscrit un joueur à un tournoi
  - **Paramètres** :
    - `id` : ID du tournoi
  - **Authentification** : Requise
  - **Corps de la requête** :
    ```json
    {
      "userId": "string"
    }
    ```
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "name": "string",
      "players": [{ "Object" }],
      // autres propriétés du tournoi
    }
    ```

- **POST** `/api/tournaments/:id/unregister`

  - **Description** : Désinscrit un joueur d'un tournoi
  - **Paramètres** :
    - `id` : ID du tournoi
  - **Authentification** : Requise
  - **Corps de la requête** :
    ```json
    {
      "userId": "string"
    }
    ```
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "name": "string",
      "players": [{ "Object" }],
      // autres propriétés du tournoi
    }
    ```

- **POST** `/api/tournaments/:id/check-in`
  - **Description** : Effectue le check-in d'un joueur pour un tournoi
  - **Paramètres** :
    - `id` : ID du tournoi
  - **Authentification** : Requise
  - **Corps de la requête** :
    ```json
    {
      "userId": "string",
      "checkedIn": "boolean"
    }
    ```
  - **Réponse** : 200 OK
    ```json
    {
      "message": "Check-in mis à jour",
      "tournament": { "Object" }
    }
    ```

#### Intégration Discord

- **POST** `/api/tournaments/create-discord-channels`
  - **Description** : Crée des canaux Discord pour les équipes d'un tournoi
  - **Authentification** : Requise
  - **Corps de la requête** :
    ```json
    {
      "teams": [
        {
          "name": "string"
        }
      ]
    }
    ```
  - **Réponse** : 200 OK
    ```json
    {
      "message": "Salons vocaux créés"
    }
    ```

### Joueurs

#### Récupération des joueurs

- **GET** `/api/players`

  - **Description** : Récupère la liste de tous les joueurs
  - **Authentification** : Requise
  - **Réponse** : 200 OK
    ```json
    [
      {
        "_id": "string",
        "username": "string",
        "discordId": "string",
        "userId": "string",
        "badges": ["string"]
      }
    ]
    ```

- **GET** `/api/players/:id`

  - **Description** : Récupère un joueur par son ID
  - **Paramètres** :
    - `id` : ID du joueur
  - **Authentification** : Requise
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "username": "string",
      "discordId": "string",
      "userId": "string",
      "badges": [{ "Object" }]
    }
    ```

- **GET** `/api/players/user/:userId`

  - **Description** : Récupère un joueur par l'ID de son utilisateur associé
  - **Paramètres** :
    - `userId` : ID de l'utilisateur
  - **Authentification** : Requise
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "username": "string",
      "discordId": "string",
      "userId": "string",
      "badges": ["string"]
    }
    ```

- **GET** `/api/players/profile/:id`

  - **Description** : Récupère le profil complet d'un joueur (incluant les badges)
  - **Paramètres** :
    - `id` : ID du joueur
  - **Authentification** : Non requise
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "username": "string",
      "discordId": "string",
      "userId": "string",
      "badges": [{ "Object" }]
    }
    ```

- **GET** `/api/players/search`
  - **Description** : Recherche des joueurs par nom d'utilisateur
  - **Paramètres de requête** :
    - `search` : Terme de recherche
  - **Authentification** : Non requise
  - **Réponse** : 200 OK
    ```json
    [
      {
        "_id": "string",
        "username": "string",
        "discordId": "string",
        "userId": "string"
      }
    ]
    ```

#### Création et gestion des joueurs

- **POST** `/api/players`

  - **Description** : Ajoute un nouveau joueur
  - **Authentification** : Admin requise
  - **Corps de la requête** :
    ```json
    {
      "username": "string"
    }
    ```
  - **Réponse** : 201 Created
    ```json
    {
      "_id": "string",
      "username": "string",
      "discordId": null,
      "userId": null
    }
    ```

- **DELETE** `/api/players/:id`

  - **Description** : Supprime un joueur
  - **Paramètres** :
    - `id` : ID du joueur à supprimer
  - **Authentification** : Admin requise
  - **Réponse** : 200 OK
    ```json
    {
      "message": "Joueur supprimé"
    }
    ```

- **POST** `/api/players/update-username`

  - **Description** : Met à jour le nom d'utilisateur d'un joueur
  - **Authentification** : Admin requise
  - **Corps de la requête** :
    ```json
    {
      "playerId": "string",
      "username": "string"
    }
    ```
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "username": "string",
      "discordId": "string",
      "userId": "string"
    }
    ```

- **POST** `/api/players/synchronize`
  - **Description** : Synchronise les joueurs avec les utilisateurs (associe les IDs Discord et utilisateur)
  - **Authentification** : Admin requise
  - **Réponse** : 200 OK
    ```json
    {
      "message": "Synchronisation réussie"
    }
    ```

#### Classements des joueurs

- **GET** `/api/players/rankings`

  - **Description** : Récupère le classement général de tous les joueurs
  - **Authentification** : Non requise
  - **Réponse** : 200 OK
    ```json
    [
      {
        "playerId": "string",
        "username": "string",
        "totalPoints": "number",
        "totalTournaments": "number",
        "totalVictories": "number",
        "tournamentsParticipated": [
          {
            "_id": "string",
            "name": "string",
            "date": "Date",
            "game": { "Object" },
            "rank": "number",
            "teamName": "string",
            "numberOfTeams": "number",
            "isWinner": "boolean"
          }
        ]
      }
    ]
    ```

- **GET** `/api/players/rankings/game/:gameId`
  - **Description** : Récupère le classement des joueurs pour un jeu spécifique
  - **Paramètres** :
    - `gameId` : ID du jeu
  - **Authentification** : Non requise
  - **Réponse** : 200 OK
    ```json
    [
      {
        "playerId": "string",
        "username": "string",
        "totalPoints": "number",
        "totalTournaments": "number",
        "totalVictories": "number",
        "tournamentsParticipated": [
          {
            "_id": "string",
            "name": "string",
            "date": "Date",
            "rank": "number",
            "teamName": "string",
            "numberOfTeams": "number",
            "isWinner": "boolean"
          }
        ]
      }
    ]
    ```

### Jeux

#### Récupération des jeux

- **GET** `/api/games`
  - **Description** : Récupère la liste de tous les jeux disponibles
  - **Authentification** : Non requise
  - **Réponse** : 200 OK
    ```json
    [
      {
        "_id": "string",
        "name": "string",
        "description": "string"
      }
    ]
    ```

#### Gestion des jeux

- **POST** `/api/games`

  - **Description** : Ajoute un nouveau jeu
  - **Authentification** : Admin requise
  - **Corps de la requête** :
    ```json
    {
      "name": "string",
      "description": "string"
    }
    ```
  - **Réponse** : 201 Created
    ```json
    {
      "_id": "string",
      "name": "string",
      "description": "string"
    }
    ```
  - **Erreur** : 400 Bad Request
    ```json
    {
      "message": "Ce jeu a déjà été créé"
    }
    ```

- **PUT** `/api/games/:id`

  - **Description** : Met à jour les informations d'un jeu
  - **Paramètres** :
    - `id` : ID du jeu à mettre à jour
  - **Authentification** : Admin requise
  - **Corps de la requête** :
    ```json
    {
      "name": "string",
      "description": "string"
    }
    ```
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "name": "string",
      "description": "string"
    }
    ```
  - **Erreur** : 404 Not Found
    ```json
    {
      "message": "Game not found"
    }
    ```

- **DELETE** `/api/games/:id`
  - **Description** : Supprime un jeu
  - **Paramètres** :
    - `id` : ID du jeu à supprimer
  - **Authentification** : Admin requise
  - **Réponse** : 200 OK
    ```json
    {
      "message": "Game removed"
    }
    ```
  - **Erreur** : 404 Not Found
    ```json
    {
      "message": "Game not found"
    }
    ```
  - **Erreur** : 500 Internal Server Error
    ```json
    {
      "message": "Une erreur est survenue lors de la suppression"
    }
    ```

### Propositions de Jeux

#### Récupération des propositions

- **GET** `/api/game-proposals`
  - **Description** : Récupère la liste des propositions de jeux avec possibilité de filtrage
  - **Paramètres de requête** :
    - `status` : Filtre par statut (pending, approved, rejected, all)
    - `search` : Recherche dans le nom ou la description
  - **Authentification** : Requise
  - **Réponse** : 200 OK
    ```json
    [
      {
        "_id": "string",
        "name": "string",
        "description": "string",
        "rawgId": "number",
        "imageUrl": "string",
        "proposedBy": {
          "_id": "string",
          "username": "string"
        },
        "status": "string", // "pending", "approved" ou "rejected"
        "votes": [
          {
            "player": {
              "_id": "string",
              "username": "string"
            },
            "value": "number" // 1 ou -1
          }
        ],
        "voteCount": "number",
        "rejectionReason": "string",
        "createdAt": "Date",
        "updatedAt": "Date",
        "userVote": "number" // 1, -1 ou 0
      }
    ]
    ```

#### Gestion des propositions

- **POST** `/api/game-proposals`

  - **Description** : Crée une nouvelle proposition de jeu
  - **Authentification** : Requise
  - **Corps de la requête** :
    ```json
    {
      "name": "string",
      "description": "string",
      "rawgId": "number",
      "imageUrl": "string"
    }
    ```
  - **Réponse** : 201 Created
    ```json
    {
      "_id": "string",
      "name": "string",
      "description": "string",
      "rawgId": "number",
      "imageUrl": "string",
      "proposedBy": "string",
      "status": "pending",
      "votes": [],
      "voteCount": 0,
      "createdAt": "Date",
      "updatedAt": "Date"
    }
    ```
  - **Erreur** : 409 Conflict
    ```json
    {
      "message": "Ce jeu a déjà été proposé",
      "proposal": { "Object" }
    }
    ```

- **DELETE** `/api/game-proposals/:proposalId`
  - **Description** : Supprime une proposition de jeu
  - **Paramètres** :
    - `proposalId` : ID de la proposition à supprimer
  - **Authentification** : Admin requise
  - **Réponse** : 200 OK
    ```json
    {
      "message": "Proposition supprimée avec succès"
    }
    ```
  - **Erreur** : 404 Not Found
    ```json
    {
      "message": "Proposition non trouvée"
    }
    ```

#### Votes et modération

- **POST** `/api/game-proposals/:proposalId/vote`

  - **Description** : Vote pour ou contre une proposition de jeu
  - **Paramètres** :
    - `proposalId` : ID de la proposition
  - **Authentification** : Requise
  - **Corps de la requête** :
    ```json
    {
      "value": "number" // 1 pour upvote, -1 pour downvote, 0 pour annuler
    }
    ```
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "name": "string",
      "votes": [{ "Object" }],
      "voteCount": "number",
      // autres propriétés de la proposition
    }
    ```
  - **Erreur** : 400 Bad Request
    ```json
    {
      "message": "La valeur du vote doit être 1, -1 ou 0"
    }
    ```

- **PATCH** `/api/game-proposals/:proposalId/moderate`
  - **Description** : Modère une proposition (approuver ou rejeter)
  - **Paramètres** :
    - `proposalId` : ID de la proposition
  - **Authentification** : Admin requise
  - **Corps de la requête** :
    ```json
    {
      "status": "string", // "approved" ou "rejected"
      "rejectionReason": "string" // Optionnel, obligatoire si "rejected"
    }
    ```
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "name": "string",
      "status": "string",
      "rejectionReason": "string"
      // autres propriétés de la proposition
    }
    ```
  - **Erreur** : 400 Bad Request
    ```json
    {
      "message": "Statut invalide"
    }
    ```

#### Recherche de jeux externes

- **GET** `/api/game-proposals/search`
  - **Description** : Recherche des jeux via l'API RAWG pour les proposer
  - **Paramètres de requête** :
    - `query` : Terme de recherche
  - **Authentification** : Requise
  - **Réponse** : 200 OK
    ```json
    [
      {
        "id": "number",
        "name": "string",
        "slug": "string",
        "background_image": "string",
        "released": "string"
        // autres propriétés retournées par l'API RAWG
      }
    ]
    ```
  - **Erreur** : 500 Internal Server Error
    ```json
    {
      "message": "Erreur lors de la recherche de jeux",
      "error": "string"
    }
    ```

### Badges

#### Récupération des badges

- **GET** `/api/badges`

  - **Description** : Récupère la liste de tous les badges disponibles
  - **Authentification** : Non requise
  - **Réponse** : 200 OK
    ```json
    [
      {
        "_id": "string",
        "title": "string",
        "imageUrl": "string",
        "description": "string"
      }
    ]
    ```

- **GET** `/api/badges/:id`
  - **Description** : Récupère les détails d'un badge spécifique
  - **Paramètres** :
    - `id` : ID du badge
  - **Authentification** : Non requise
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "title": "string",
      "imageUrl": "string",
      "description": "string"
    }
    ```
  - **Erreur** : 404 Not Found
    ```json
    {
      "message": "Badge non trouvé"
    }
    ```

#### Gestion des badges

- **POST** `/api/badges`

  - **Description** : Crée un nouveau badge
  - **Authentification** : Admin requise
  - **Corps de la requête** :
    ```json
    {
      "title": "string",
      "imageUrl": "string",
      "description": "string"
    }
    ```
  - **Réponse** : 201 Created
    ```json
    {
      "_id": "string",
      "title": "string",
      "imageUrl": "string",
      "description": "string"
    }
    ```

- **PUT** `/api/badges/:id`

  - **Description** : Met à jour un badge existant
  - **Paramètres** :
    - `id` : ID du badge à mettre à jour
  - **Authentification** : Admin requise
  - **Corps de la requête** :
    ```json
    {
      "title": "string",
      "imageUrl": "string",
      "description": "string"
    }
    ```
  - **Réponse** : 200 OK
    ```json
    {
      "_id": "string",
      "title": "string",
      "imageUrl": "string",
      "description": "string"
    }
    ```
  - **Erreur** : 404 Not Found
    ```json
    {
      "message": "Badge non trouvé"
    }
    ```

- **DELETE** `/api/badges/:id`
  - **Description** : Supprime un badge et le retire de tous les joueurs qui le possèdent
  - **Paramètres** :
    - `id` : ID du badge à supprimer
  - **Authentification** : Admin requise
  - **Réponse** : 200 OK
    ```json
    {
      "message": "Badge supprimé avec succès"
    }
    ```
  - **Erreur** : 404 Not Found
    ```json
    {
      "message": "Badge non trouvé"
    }
    ```

#### Attribution des badges aux joueurs

- **POST** `/api/badges/assign`

  - **Description** : Attribue un badge à un joueur
  - **Authentification** : Admin requise
  - **Corps de la requête** :
    ```json
    {
      "playerId": "string",
      "badgeId": "string"
    }
    ```
  - **Réponse** : 200 OK
    ```json
    {
      "message": "Badge associé au joueur avec succès"
    }
    ```
  - **Erreur** : 404 Not Found
    ```json
    {
      "message": "Joueur non trouvé"
    }
    ```
    ou
    ```json
    {
      "message": "Badge non trouvé"
    }
    ```

- **POST** `/api/badges/remove`
  - **Description** : Retire un badge d'un joueur
  - **Authentification** : Admin requise
  - **Corps de la requête** :
    ```json
    {
      "playerId": "string",
      "badgeId": "string"
    }
    ```
  - **Réponse** : 200 OK
    ```json
    {
      "message": "Badge supprimé du joueur avec succès"
    }
    ```
  - **Erreur** : 404 Not Found
    ```json
    {
      "message": "Joueur non trouvé"
    }
    ```
    ou
    ```json
    {
      "message": "Badge non trouvé"
    }
    ```
