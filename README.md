# L'Adresse Dakar — Plateforme Fullstack de Gestion Restaurant

Application Next.js + Supabase couvrant les profils opérationnels: client QR, cuisine, admin, propriétaire.

## Stack
- Frontend: Next.js (App Router), TypeScript, Tailwind CSS
- Backend: Supabase (PostgreSQL, Auth, Realtime, RLS)
- Temps réel: subscriptions Supabase Realtime (orders, items, server_calls)
- QR code: `qrcode`
- Impression tickets: `react-to-print`
- Exports: CSV (API), PDF (`jspdf` + `jspdf-autotable`)
- PWA: `public/manifest.webmanifest` + `public/sw.js`
- Déploiement: Vercel + Supabase

## Fonctionnalités implémentées
- Client (`/[table_id]`, `/[table_id]/panier`, `/[table_id]/commandes`, `/[table_id]/appel`, `/commande/[id]`)
  - Menu par catégories, filtres allergènes, FR/EN
  - Panier avec note par plat
  - Accompagnement obligatoire pour viandes/volailles/poissons (avec supplément)
  - Suivi statut en direct: reçue → en préparation → prête
  - Appel cuisine en direct
  - Historique session + notation post-livraison
- Cuisine (`/cuisine`, `/cuisine/historique`)
  - Réception commandes live + son
  - Réception des appels clients live + acquittement/clôture
  - Changement statut + ETA
  - Alerte retard
  - Rupture stock instantanée
  - Impression ticket
- Admin (`/admin/*`)
  - CRUD menu, catégories/sous-catégories
  - Tailles pizza
  - Accompagnements
  - Gestion QR tables (générer/imprimer/désactiver)
  - Promotions
  - Horaires brunch/service
  - Page d'accueil admin: `/admin`
  - Personnel découpé par pages:
    - `/admin/personnel` (planning)
    - `/admin/personnel/acces-cuisine` (création/régénération accès cuisine)
    - `/admin/personnel/securite` (sécurité admin)
- Propriétaire (`/proprio/dashboard`, `/proprio/rapports`)
  - CA jour/semaine/mois, volume commandes, top ventes
  - Table la plus active, ticket moyen, moyenne notes
  - Export CSV/PDF
  - Rapport journalier (API + cron Vercel)
  - Page d'accueil proprio: `/proprio`

## Schéma de base
Migration complète + seed réel dans:
- `supabase/migrations/20260222170000_init_ladresse.sql`

Tables principales:
- `restaurants`, `users`, `tables`
- `categories`, `subcategories`, `items`, `pizza_sizes`, `accompaniments`
- `orders`, `order_items`, `server_calls`, `ratings`
- `promotions`, `staff_schedule`, `service_hours`

## Variables d'environnement
Copier `.env.example` vers `.env.local`:

```bash
cp .env.example .env.local
```

Renseigner ensuite:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_DEFAULT_RESTAURANT_ID`
- `RESEND_API_KEY`, `REPORT_EMAIL_FROM`, `REPORT_EMAIL_TO`, `WHATSAPP_WEBHOOK_URL` (rapport quotidien)

## Installation
```bash
npm install
npm run lint
npm run build
npm run dev
```

Application locale: [http://localhost:3000](http://localhost:3000)

## Auth et permissions
- Client: accès libre via QR (sans inscription)
- Staff: login via `/staff/login` (Supabase Auth)
- Bootstrap admin initial via `/staff/setup-admin` (100% depuis le site)
- Middleware de protection par rôle: `middleware.ts`
- Email admin principal configuré: `ladresse.sn@outlook.fr`

## Cron rapport quotidien
`vercel.json` configure:
- `GET /api/reports/daily` à `23:00` (UTC)

## Notes techniques
- Le script build est fixé sur Webpack (`next build --webpack`) pour fiabiliser la compilation locale avec l’environnement actuel.
