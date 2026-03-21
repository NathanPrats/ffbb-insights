# ADR-005 : Stratégie de déploiement (Vercel + Fly.io)

- **Date** : 2026-03-20
- **Statut** : Accepté

## Contexte

L'application est composée de deux processus distincts :
- **API Go** (`cmd/api`) : serveur REST qui scrape le site FFBB, maintient un cache mémoire TTL et expose les projections Monte Carlo.
- **Frontend Next.js** (`web/`) : App Router avec Server Components (fetches côté serveur) et composants client (projections, simulateur).

L'objectif est d'exposer l'outil publiquement avec un minimum de friction opérationnelle et un coût maîtrisé.

## Décision

### Frontend — Vercel (tier gratuit)

Vercel est l'hébergeur de référence pour Next.js (même équipe). La détection du projet est automatique depuis le dépôt GitHub.

- Déploiement continu : chaque push sur `main` déclenche un build.
- Variable d'environnement à configurer dans Vercel : `NEXT_PUBLIC_API_BASE=https://<app>.fly.dev`
- Sous-domaine gratuit `*.vercel.app` suffisant pour commencer ; domaine custom ajouté ultérieurement.
- Les Server Components appellent l'API au moment du rendu serveur (pas de CORS). Seuls les fetches client (projections, simulateur) nécessitent des headers CORS côté API.

**Alternative écartée — GitHub Pages** : ne supporte que les sites purement statiques. Incompatible avec les Server Components Next.js et le routing dynamique `[id]`.

### API Go — Fly.io (tier gratuit / ~5 €/mois)

Fly.io exécute des conteneurs Docker sur des micro-VMs. Contrairement à Render (tier gratuit), les VMs Fly.io ne se mettent pas en veille après inactivité.

- Déploiement via `flyctl deploy` depuis la CI ou manuellement.
- Nécessite un `Dockerfile` multi-stage (build Go → image Alpine).
- L'URL publique de la forme `https://<app>.fly.dev` est passée à Vercel via l'env var ci-dessus.

**Alternative écartée — Railway** : tarification au-delà du free tier moins prévisible ; Fly.io offre un meilleur contrôle sur les ressources allouées.

**Alternative écartée — Cloud Run (GCP)** : plus de configuration (projet GCP, registry, IAM) pour un gain limité à ce stade.

### Cache mémoire

Le cache est in-memory, non persistant. Un redémarrage de la VM Fly.io efface les compétitions scrapées dynamiquement (via le formulaire URL). Les compétitions statiques hardcodées dans `main.go` restent toujours disponibles car elles sont chargées au démarrage. Ce comportement est acceptable pour un outil à usage modéré.

Si la persistance devient nécessaire, une base SQLite embarquée ou un fichier JSON sur un volume Fly.io suffira sans changer l'architecture globale.

### Nom de domaine

Optionnel au lancement. Quand souhaité :
- Registrar recommandé : **Cloudflare Registrar** (prix coûtant, ~9 €/an pour un `.com`) ou **OVH/Gandi** (registrars français).
- Le DNS est délégué à Vercel qui provisionne le TLS automatiquement (Let's Encrypt).
- L'API Go peut rester sur `*.fly.dev` ou recevoir un sous-domaine (`api.mondomaine.com`) via un CNAME vers Fly.io.

## Plan d'implémentation

Les étapes sont à réaliser dans cet ordre :

1. **`Dockerfile`** multi-stage pour le binaire Go (`cmd/api`).
2. **CORS** dans `cmd/api/main.go` : autoriser les origines Vercel (et `localhost` en dev).
3. **Déploiement API** sur Fly.io (`flyctl launch` + `flyctl deploy`) → récupérer l'URL publique.
4. **Déploiement Frontend** sur Vercel : connecter le repo GitHub, renseigner `NEXT_PUBLIC_API_BASE`.
5. **Domaine custom** (optionnel, quand souhaité).

## Conséquences

- L'API et le frontend sont découplés et déployables indépendamment.
- Aucune base de données ni stockage externe n'est requis au lancement.
- Le coût est nul (tiers gratuits) ou très faible (~5 €/mois si la VM Fly.io passe en paid).
- La CI/CD côté frontend est automatique dès la connexion GitHub ↔ Vercel.
