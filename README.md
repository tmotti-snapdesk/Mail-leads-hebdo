# Snapdesk — Générateur des mails portefeuille

Mini-outil pour construire **les mails hebdomadaires « portefeuille des espaces »** de Snapdesk,
avec aperçu en direct et **HTML prêt à copier** (Gmail, HubSpot, CRM…).

Deux mails dans le même outil :

| Onglet | Destinataires | Tri / organisation |
|---|---|---|
| **📈 Brokers** (mail leads) | Brokers / apporteurs d'affaires | Espaces triés **par prix croissant** (le plus grand plateau passe en carte pleine largeur) |
| **🏢 Clients** | Prospects / clients finaux | Espaces **groupés par tranches de postes** (ex. 1 à 8, 9 à 16, 17 et +) |

Charte reprise du modèle interne : rose `#E590A1`, sauge `#A9BCB7`, noir `#111`,
polices **Josefin Sans** (titres) / **DM Sans** (texte), logo blanc sur fond noir.
Les mails sont **responsive** (2 colonnes desktop, empilé sur mobile).

## Utilisation

1. Ouvre l'outil (fichier `index.html` ou l'URL déployée).
2. Choisis l'onglet **Brokers** ou **Clients**.
3. **Récupérer** les espaces depuis la page live `espaces.snapdesk.co/espaces`
   *(récupère nom, postes, prix, code postal, photo — nécessite le déploiement Vercel)*,
   ou saisis / édite les espaces à la main.
4. Ajuste les textes (titre, intro, tranches de postes, boutons, bas de page).
5. **Aperçu** en direct à droite (bascule Bureau / Mobile).
6. **📋 Copier le HTML** (rendu prêt à coller dans Gmail / HubSpot),
   ou **&lt;/&gt; Voir le code** pour copier / télécharger le code source.

Le travail est **sauvegardé automatiquement** dans le navigateur (localStorage).
« Exporter » / « Importer » permet de partager une configuration en `.json`.

### Variables de texte
Utilisables dans les champs d'intro : `{{MIN}}` / `{{MAX}}` (postes), `{{NB}}` (nombre
d'espaces), `{{PMIN}}` / `{{PMAX}}` (prix).

## Comment ça marche

| Fichier | Rôle |
|---|---|
| `index.html` | Toute l'interface + génération du HTML des mails (aucune dépendance) |
| `api/generate.js` | Fonction serverless Vercel : récupère la page live **côté serveur** (pas de CORS) et renvoie la liste des espaces en JSON |
| `api/upload.js` | Fonction serverless Vercel : reçoit une image et l'envoie sur **Supabase Storage** (clé secrète côté serveur), renvoie l'URL publique |

Le rendu HTML est fait **dans le navigateur** : l'édition est instantanée, pas besoin de
redéployer pour changer un texte.

## Photos — hébergement Supabase (pour HubSpot)

Les photos se déposent en **glisser-déposer** sur chaque carte. Elles sont redimensionnées
puis **uploadées sur Supabase Storage**, qui renvoie une **URL publique** — indispensable
pour que les images s'affichent chez les destinataires (HubSpot, Outlook, Gmail).

> Sans Supabase configuré, l'image est **intégrée directement** dans le HTML (data-URI) :
> pratique pour l'aperçu et le copier-coller Gmail, mais **non fiable via HubSpot/Outlook**.

### Configuration (une seule fois)
1. Crée un projet sur [supabase.com](https://supabase.com) (gratuit).
2. **Storage** → **New bucket** → nom `espaces` → coche **Public bucket** → *Save*.
3. Récupère les identifiants :
   - **Project URL** : menu **Data API** (ou bouton **Connect**) → `https://xxxx.supabase.co`
   - **Clé `service_role`** : **Settings → API Keys** → onglet **« Legacy anon, service_role
     API keys »** → révèle/copie la clé **`service_role`** (longue, commence par `eyJ…`).
     ⚠️ **Important** : l'API Storage exige cette clé **JWT `service_role`**. La nouvelle clé
     `sb_secret_…` est **rejetée** (`403 — JWS Protected Header is invalid`).
4. Sur Vercel (le projet déployé) → **Settings → Environment Variables**, ajoute :
   - `SUPABASE_URL` = l'URL du projet (ex. `https://xxxx.supabase.co`)
   - `SUPABASE_SECRET_KEY` = la clé **`service_role`** (`eyJ…`)
   - `SUPABASE_BUCKET` = `espaces` *(optionnel, valeur par défaut)*
5. **Redeploy** le projet. Le glisser-déposer héberge désormais les photos automatiquement.

> ⚠️ La clé secrète ne doit **jamais** être mise dans le navigateur ni committée —
> uniquement dans les variables d'environnement Vercel (l'upload passe par `api/upload.js`).

## Déployer sur Vercel

### Via GitHub (recommandé)
1. Ce dépôt est déjà sur GitHub.
2. Sur [vercel.com](https://vercel.com) → **Add New → Project** → importe le dépôt.
3. **Deploy** (zéro config : Vercel détecte `index.html` + la fonction dans `/api`).
4. Ouvre l'URL → l'outil est en ligne, bouton **Récupérer** fonctionnel.

### En local
```bash
npm i -g vercel
vercel dev      # http://localhost:3000 (nécessaire pour tester /api/generate)
```
> Ouvert en `file://`, tout fonctionne **sauf** le bouton « Récupérer » (il a besoin
> du serveur). Dans ce cas, saisis les espaces à la main.

## Notes

- **Aucune dépendance** (Node 18+ fournit `fetch` nativement).
- Rendu de la page live mis en cache CDN 5 min (`s-maxage=300`).
- **Piège prix** : dans les données source, `pricePerMonth` est parfois `"7800"`, parfois
  `"8 100"` — la fonction ne garde que les chiffres.
- Un espace **sans photo** affiche un fond sauge « Snapdesk ».
- Pour l'envoi définitif dans HubSpot, pense à **réuploader le logo et les photos dans
  HubSpot Files** plutôt que de dépendre des URL externes.
