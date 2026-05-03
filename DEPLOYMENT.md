# Guide de Déploiement — Paris Cuban Salsa (pariscubansalsa.com)

Ce guide détaille la migration de votre app Expo Web (PWA) + FastAPI + MongoDB depuis Emergent vers un hébergement auto-géré **Vercel (frontend) + Railway (backend) + MongoDB Atlas (base)** avec le domaine custom `pariscubansalsa.com` géré chez IONOS.

**Coût total estimé** : 0-25 $/mois selon le trafic.

---

## ⚙️ Architecture cible

```
pariscubansalsa.com          →  Vercel       (Expo Web static build)
api.pariscubansalsa.com      →  Railway      (FastAPI)
                              →  MongoDB Atlas (M0 gratuit)
```

---

## 📦 Étape 1 — Export du code vers GitHub

Dans l'interface Emergent (chat), cliquez sur **"Save to GitHub"** en haut à droite :

1. Sélectionnez une branche cible (`main` par défaut) ou créez-en une nouvelle
2. Cliquez **"PUSH TO GITHUB"**
3. Vérifiez que le repo contient :
   - `/frontend` (app Expo Web)
   - `/backend` (FastAPI)
   - Les fichiers de config (`package.json`, `requirements.txt`, `app.json`)

**À noter** : les fichiers `.env` ne sont PAS exportés pour des raisons de sécurité. Vous devrez recréer les variables d'environnement chez Vercel et Railway (voir étape 4).

Clonez ensuite votre repo localement :
```bash
git clone git@github.com:VOTRE_USER/VOTRE_REPO.git pcs
cd pcs
```

---

## 🗄️ Étape 2 — Migrer MongoDB vers MongoDB Atlas

### 2.1 Créer un cluster gratuit M0

1. Allez sur https://cloud.mongodb.com → inscription (Google OAuth possible)
2. Créez une organisation + un projet `paris-cuban-salsa`
3. **Build a Database** → choisissez **M0 (FREE)** → région **Paris (eu-west-3)** ou **Frankfurt (eu-central-1)**
4. Nommez le cluster `pcs-prod`
5. Cliquez **Create Deployment**

### 2.2 Créer un utilisateur DB

1. Dans **Security → Database Access** → **Add New Database User**
2. Username : `pcs_app`
3. Password : générez-en un solide (sauvegardez-le dans 1Password/Bitwarden)
4. Built-in role : `Read and write to any database`
5. **Add User**

### 2.3 Autoriser les connexions

1. **Security → Network Access** → **Add IP Address**
2. Cliquez **Allow Access from Anywhere** (`0.0.0.0/0`) — nécessaire car Railway utilise des IPs dynamiques
3. **Confirm**

### 2.4 Récupérer la connection string

1. Cluster `pcs-prod` → **Connect** → **Drivers** → Python
2. Copiez l'URL : `mongodb+srv://pcs_app:<PASSWORD>@pcs-prod.xxxx.mongodb.net/?retryWrites=true&w=majority&appName=pcs-prod`
3. Remplacez `<PASSWORD>` par votre mot de passe
4. Gardez cette URL pour la variable `MONGO_URL` de Railway (étape 4)

### 2.5 Dump depuis Emergent puis restore vers Atlas

**Depuis votre machine locale** (vous devez avoir `mongodump` et `mongorestore` — sous macOS : `brew install mongodb-database-tools`) :

```bash
# 1. Dump depuis Emergent (remplacez par l'URL MONGO_URL actuelle que vous avez dans /app/backend/.env)
mongodump --uri="mongodb://localhost:27017/paris_cuban_salsa_db" --out=./pcs-backup

# 2. Restore vers Atlas
mongorestore \
  --uri="mongodb+srv://pcs_app:VOTRE_PASSWORD@pcs-prod.xxxx.mongodb.net/paris_cuban_salsa_db?retryWrites=true&w=majority" \
  ./pcs-backup/paris_cuban_salsa_db
```

> **Alternative** : si vous n'avez pas accès direct au MongoDB Emergent, ne migrez pas les données — l'app re-ingèrera automatiquement le Google Calendar (sync toutes les 15 min). Vous perdrez juste les analytics historiques et les comptes utilisateurs (que vous recréerez via Google OAuth).

### 2.6 Vérification

Dans Atlas → **Browse Collections** → vous devez voir les collections `entries`, `teachers`, `users`, `user_sessions`, `analytics_events`, `photos`, `tags`, `events`.

---

## 🚂 Étape 3 — Déployer le backend FastAPI sur Railway

### 3.1 Créer le projet Railway

1. https://railway.app → sign in avec GitHub
2. **New Project** → **Deploy from GitHub repo** → sélectionnez votre repo `pcs`
3. Railway détecte automatiquement Python. Sinon, ajoutez un fichier `railway.json` à la racine :

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd backend && pip install -r requirements.txt"
  },
  "deploy": {
    "startCommand": "cd backend && uvicorn server:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/api/",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### 3.2 Variables d'environnement Railway

Dans le service → **Variables** → cliquez **Raw Editor** et collez :

```env
MONGO_URL=mongodb+srv://pcs_app:VOTRE_PASSWORD@pcs-prod.xxxx.mongodb.net/paris_cuban_salsa_db?retryWrites=true&w=majority
DB_NAME=paris_cuban_salsa_db
CORS_ORIGINS=https://pariscubansalsa.com,https://www.pariscubansalsa.com
SESSION_SECRET=CHANGEZ_MOI_64_CARACTERES_ALEATOIRES
ADMIN_EMAILS=pariscubansalsa@gmail.com
GCAL_ICS_URL=VOTRE_URL_ICS_GOOGLE_CALENDAR
GCAL_SYNC_INTERVAL=900
```

> **SESSION_SECRET** : générez avec `openssl rand -hex 32` (64 hex chars).

### 3.3 Générer un domaine Railway public

1. Service → **Settings → Networking** → **Generate Domain**
2. Railway vous donne `xxx.up.railway.app` → testez : `https://xxx.up.railway.app/api/` → doit renvoyer `{"service":"paris-cuban-salsa-gallery","status":"ok"}`

### 3.4 Custom domain Railway

1. **Settings → Networking → Custom Domain** → `api.pariscubansalsa.com`
2. Railway vous donne un CNAME → notez-le (ex: `xxx.up.railway.app`)

---

## 🌐 Étape 4 — Déployer le frontend sur Vercel

### 4.1 Créer le projet Vercel

1. https://vercel.com → sign in avec GitHub
2. **Add New → Project** → importez votre repo `pcs`
3. **Framework Preset** : Other
4. **Root Directory** : `frontend`
5. **Build Command** : `npx expo export --platform web`
6. **Output Directory** : `dist`
7. **Install Command** : `yarn install --frozen-lockfile` (ou `npm ci`)

### 4.2 Variables d'environnement Vercel

Dans **Settings → Environment Variables**, ajoutez pour les 3 environments (Production, Preview, Development) :

```env
EXPO_PUBLIC_BACKEND_URL=https://api.pariscubansalsa.com
```

> **Ne mettez PAS** `EXPO_PACKAGER_PROXY_URL` ni `EXPO_PACKAGER_HOSTNAME` — ces variables sont spécifiques à Emergent.

### 4.3 Redéployer

**Deployments** → dernière build → **Redeploy** (pour prendre en compte les nouvelles env vars).

Vérifiez : `https://VOTRE-PROJET.vercel.app` doit afficher l'app PCS.

### 4.4 Custom domain Vercel

1. **Settings → Domains** → **Add** → `pariscubansalsa.com`
2. Vercel vous affiche 2 choix :
   - **A Record** : `76.76.21.21` (IP fixe Vercel)
   - **ou** CNAME `cname.vercel-dns.com`
3. Ajoutez aussi `www.pariscubansalsa.com` (CNAME vers `pariscubansalsa.com`)

---

## 🌐 Étape 5 — Configurer les DNS chez IONOS

Allez sur **IONOS → Domaines & SSL → pariscubansalsa.com → DNS** et configurez **exactement** :

| Type  | Nom / Host | Valeur                         | TTL  | Usage                          |
|-------|------------|--------------------------------|------|--------------------------------|
| A     | `@`        | `76.76.21.21`                  | 3600 | Racine → Vercel (frontend)     |
| CNAME | `www`      | `cname.vercel-dns.com.`        | 3600 | www → Vercel                   |
| CNAME | `api`      | `xxx.up.railway.app.`          | 3600 | Sous-domaine API → Railway     |

**⚠️ IMPORTANT** : 
- **Supprimez d'abord tous les A records existants** (IONOS ajoute des records vers leur parking par défaut). Sinon le domaine pointera aléatoirement vers la mauvaise IP.
- Les valeurs CNAME doivent **TOUJOURS** finir par un point final (`cname.vercel-dns.com.`).
- La propagation DNS prend 5 min à 24h. Généralement 15-30 min.

### Vérifier la propagation

```bash
# Racine doit pointer vers Vercel
dig pariscubansalsa.com +short
# → doit retourner 76.76.21.21

# www doit pointer vers Vercel
dig www.pariscubansalsa.com +short
# → doit retourner cname.vercel-dns.com. puis une IP

# api doit pointer vers Railway
dig api.pariscubansalsa.com +short
# → doit retourner xxx.up.railway.app. puis une IP Railway
```

Ou utilisez https://dnschecker.org/ pour vérifier la propagation mondiale.

---

## 🔐 Étape 6 — SSL automatique

**Vercel** et **Railway** génèrent automatiquement des certificats Let's Encrypt une fois que les DNS sont propagés. Pas d'action requise de votre part.

Attendez 5-15 min après propagation DNS puis testez dans un navigateur :
- `https://pariscubansalsa.com` → cadenas vert, l'app se charge
- `https://api.pariscubansalsa.com/api/` → `{"service":"paris-cuban-salsa-gallery","status":"ok"}`

Si le cadenas n'apparaît pas après 1h, allez dans Vercel → Settings → Domains → cliquez **"Refresh"** à côté du domaine. Idem sur Railway.

---

## 🔑 Étape 7 — Variables d'environnement : liste complète

### Backend (Railway)

| Variable              | Obligatoire | Description                                                  |
|-----------------------|-------------|--------------------------------------------------------------|
| `MONGO_URL`           | ✅          | URL MongoDB Atlas avec auth                                  |
| `DB_NAME`             | ✅          | `paris_cuban_salsa_db`                                       |
| `CORS_ORIGINS`        | ✅          | Liste CSV des domaines autorisés (frontend prod + www)       |
| `SESSION_SECRET`      | ✅          | Clé 64 hex aléatoire (openssl rand -hex 32)                  |
| `ADMIN_EMAILS`        | Recommandé  | Emails Google autorisés à être admin (CSV)                   |
| `GCAL_ICS_URL`        | Optionnel   | URL du calendrier Google public au format .ics               |
| `GCAL_SYNC_INTERVAL`  | Optionnel   | Intervalle sync en secondes (défaut 900 = 15 min)            |

### Frontend (Vercel)

| Variable                   | Obligatoire | Description                          |
|----------------------------|-------------|--------------------------------------|
| `EXPO_PUBLIC_BACKEND_URL`  | ✅          | `https://api.pariscubansalsa.com`    |

---

## ✅ Étape 8 — Checklist de vérification post-déploiement

Faites ces tests dans l'ordre :

- [ ] `https://pariscubansalsa.com` → page d'accueil PCS charge
- [ ] L'onglet **Soirées** charge des événements
- [ ] L'onglet **Festivals** charge des événements
- [ ] L'onglet **Artistes** charge la liste des profs
- [ ] Clic sur **"Connexion"** → flow Google OAuth → retour sur l'app connecté
- [ ] Après login admin (avec email dans `ADMIN_EMAILS`), le menu **"Studio Admin"** apparaît
- [ ] **Admin → Calendrier** → "Synchroniser maintenant" → réussi
- [ ] **Admin → Analytics** → dashboard charge sans erreur
- [ ] Ouvrir les **DevTools → Application → Service Workers** → le SW `sw.js` est registered (PWA OK)
- [ ] Depuis mobile iOS/Android, l'option "Ajouter à l'écran d'accueil" fonctionne
- [ ] Tester GA4 : **DevTools → Network → filter gtag** → voir les hits `collect?v=2&tid=G-R13W4BZG92`
- [ ] Vérifier que l'URL preview Emergent ne fonctionne PLUS (sinon risque de SEO dupliqué)

---

## 🔄 Étape 9 — Workflow de mise à jour continue

Après ce setup initial, vos futures mises à jour suivent ce cycle :

```bash
# 1. Modifiez le code localement
git pull origin main
# ... faites vos changements ...

# 2. Push vers GitHub
git add . && git commit -m "feat: nouvelle feature" && git push origin main

# 3. Vercel + Railway redéploient automatiquement (2-3 min)
```

Vous n'avez **plus besoin d'Emergent** pour les futurs déploiements. Vous pouvez continuer à utiliser Emergent pour le dev assisté par IA puis `Save to GitHub` à chaque étape.

---

## 🆘 Dépannage

**Erreur CORS** (frontend n'arrive pas à appeler le backend) :
- Vérifiez que `CORS_ORIGINS` dans Railway contient bien `https://pariscubansalsa.com` (et `https://www.pariscubansalsa.com` si vous avez www)
- Redéployez le backend après changement de variable

**Session Google Auth perdue après refresh** :
- Les cookies `session_token` sont `SameSite=None; Secure`. Ils ne fonctionnent qu'en HTTPS. Vérifiez que vous êtes bien sur `https://` et que le certificat SSL est actif.

**Google Calendar sync ne fonctionne pas** :
- Vérifiez `GCAL_ICS_URL` dans Railway
- Testez manuellement : `curl https://api.pariscubansalsa.com/api/calendar/sync -X POST -H "Authorization: Bearer VOTRE_SESSION_TOKEN_ADMIN"`

**Images/covers ne s'affichent pas** :
- Les photos sont en base64 dans MongoDB → vérifiez que la migration mongorestore a bien tout copié (champ `cover_photo` non vide sur les entries)

**Le backend plante après 15 min d'inactivité** (plan gratuit Railway) :
- Upgrade vers Railway Starter (5$/mois) qui garde le service always-on
- OU ajoutez un uptime monitor gratuit (https://uptimerobot.com) qui ping `/api/` toutes les 5 min

---

## 💰 Coût mensuel estimé

| Service           | Plan           | Coût      |
|-------------------|----------------|-----------|
| Vercel            | Hobby (gratuit)| 0 €       |
| Railway           | Starter        | ~5 $/mois |
| MongoDB Atlas     | M0 (gratuit)   | 0 €       |
| IONOS (domaine)   | —              | ~1 €/mois |
| **Total**         |                | **~6 €/mois** |

Montée en charge (si trafic augmente) :
- Vercel Pro : 20 $/mois (équipe, analytics avancées)
- Railway Pro : 20 $/mois (plus de RAM/CPU)
- MongoDB Atlas M10 : 57 $/mois (seulement si gros volume de données)

---

## 📞 Support

- Vercel : https://vercel.com/support
- Railway : https://railway.app/help
- MongoDB Atlas : https://www.mongodb.com/docs/atlas/
- IONOS : https://www.ionos.fr/aide/

Ce guide a été créé le **2 mai 2026** pour la migration depuis Emergent.
