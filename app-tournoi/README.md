# Palificup Tournoi

App Next.js pour suivre le tournoi de Perudo Palificup en direct sur mobile : chaque
joueur voit sa table du moment, saisit le résultat, et progresse automatiquement au
tour suivant. Toutes les données (joueurs, tables, résultats) vivent dans un Google
Sheet — pas de base de données séparée.

## 1. Créer le Google Sheet

Crée un nouveau Google Sheet avec **exactement ces 4 onglets** (le nom compte, avec
la majuscule) :

### Onglet `Players`
| id | name | team | seed |
|----|------|------|------|
| 1  | Thomas Perigaud | skuteam | |
| 2  | Marie Barthes | La casa du bordel | |

- `id` : identifiant unique (texte ou nombre, ex: `1`, `2`, ...).
- `name` : nom affiché — c'est ce que le joueur tape pour se connecter.
- `team` : équipe (peut être vide).
- `seed` : optionnel, un nombre pour forcer l'ordre du tirage au sort initial ;
  laisse vide pour un tirage aléatoire.

Remplis cet onglet avec la liste des joueurs présents avant de lancer le tournoi.
Les 3 autres onglets peuvent rester **vides** (l'app crée les en-têtes et les lignes
elle-même) :

- `Config`
- `Rounds`
- `Seats`

## 2. Créer le compte de service Google (accès en écriture)

1. Va sur [Google Cloud Console](https://console.cloud.google.com/), crée un projet
   (ou réutilise un projet existant).
2. Active l'**API Google Sheets** (menu "API et services" → "Bibliothèque" → chercher
   "Google Sheets API" → Activer).
3. Va dans "API et services" → "Identifiants" → "Créer des identifiants" → "Compte de
   service". Donne-lui un nom (ex: `palificup-tournoi`), pas besoin de rôle particulier.
4. Une fois le compte créé, ouvre-le → onglet "Clés" → "Ajouter une clé" → "Créer une
   clé" → format **JSON**. Un fichier `.json` se télécharge : garde-le précieusement,
   il contient `client_email` et `private_key`.
5. Dans le Google Sheet créé à l'étape 1, clique sur "Partager" et donne accès en
   **Éditeur** à l'adresse `client_email` du fichier JSON (ex:
   `palificup-tournoi@xxxx.iam.gserviceaccount.com`).
6. Récupère l'ID du Sheet dans son URL :
   `https://docs.google.com/spreadsheets/d/CET_ID_LA/edit`.

## 3. Configurer les variables d'environnement

```bash
cp .env.local.example .env.local
```

Remplis `.env.local` avec :
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` = `client_email` du JSON.
- `GOOGLE_PRIVATE_KEY` = `private_key` du JSON (garde les `\n`, mets la valeur entre
  guillemets).
- `GOOGLE_SHEET_ID` = l'ID récupéré à l'étape précédente.
- `ADMIN_PASSWORD` = le mot de passe que tu utiliseras sur `/admin`.

Sur Vercel, ajoute les mêmes variables dans Project Settings → Environment Variables.

## 4. Lancer en local

```bash
npm install
npm run dev
```

- `http://localhost:3000` — connexion joueur (nom + code du tournoi).
- `http://localhost:3000/admin` — dashboard admin (mot de passe = `ADMIN_PASSWORD`).
- `http://localhost:3000/classement` — classement individuel + par équipe, public.

## 5. Déroulé d'un tournoi

1. Sur `/admin`, renseigne le **code du tournoi** (celui que les joueurs taperont) et
   la **taille de table cible** (5 par défaut), puis "Enregistrer".
2. Vérifie que tous les joueurs présents sont dans l'onglet `Players` du Sheet.
3. Clique sur "Lancer le tournoi" → génère les Poules.
4. Les joueurs se connectent sur `/` avec leur nom + le code, voient leur table sur
   `/ma-table`, et un joueur de chaque table saisit l'ordre d'élimination une fois la
   partie terminée.
5. Quand toutes les poules ont rendu leur résultat, l'admin clique "Générer Tableau A
   + Tableau B" (les 2 premiers de chaque poule montent en tableau principal, les
   autres partent en repêchage).
6. Pour chaque tableau (A et B), une fois toutes les tables d'un tour terminées,
   l'admin clique "Générer le tour suivant" — répète jusqu'à ce que les deux tableaux
   affichent "Terminé".
7. L'admin clique "Générer la Grande Finale" (les finalistes du tableau A + le
   vainqueur du tableau B repêchage).
8. Une fois la finale saisie, "Clôturer le tournoi".

Le classement (`/classement`) se met à jour en continu à partir du barème de points
fixe (Vainqueur = 150, Finaliste = 70, Demi = 50, Quart = 30, etc. — voir
`src/lib/scoring.ts`).

### Cas particuliers (absences, nombre impair de joueurs...)

L'algorithme répartit automatiquement les tables par 4-5 joueurs en essayant d'éviter
qu'un joueur retombe contre quelqu'un de sa table précédente. Il ne gère pas parfaitement
tous les cas limites (forfaits de dernière minute, nombres qui ne tombent pas juste) —
si une table générée automatiquement ne convient pas, corrige directement les lignes
concernées dans l'onglet `Seats` du Google Sheet avant que les joueurs ne commencent à
saisir leurs résultats.

## Déployer sur Vercel

```bash
npx vercel
```

(ou connecte le repo GitHub à Vercel directement). N'oublie pas d'ajouter les 4
variables d'environnement dans les settings du projet Vercel.
