# PRD — Bottin scolaire

## Problème original
Application web de bottin (annuaire) scolaire. Chaque année, les parents s'inscrivent à un bottin organisé par classe (# de groupe + nom des enseignant(e)s). Les parents inscrivent leur enfant dans la bonne classe avec nom complet, téléphone, courriel, et l'option d'indiquer quel parent appeler en premier. L'admin gère les classes, la liste des courriels autorisés (ajout/retrait/purge), promotion/rétrogradation d'utilisateurs, et l'image de couverture (dessin d'enfants) utilisée en arrière-plan. Connexion parent : courriel + mot de passe par défaut = courriel (changement optionnel). Export Excel des données brutes.

## Architecture
- Backend FastAPI (`/app/backend/server.py`), MongoDB (motor). Auth JWT Bearer (token localStorage `bottin_token`). Object storage local pour l'image de couverture. Export via openpyxl.
- Frontend React + Tailwind + shadcn, police Nunito, thème clair « Vibrant Play ». Pages : Login, Directory (Bottin), MyEntries, Admin.

## Personas
- Admin : gère classes, courriels autorisés, utilisateurs, couverture, export.
- Parent : inscrit ses enfants, consulte le bottin, filtre/recherche.

## Implémenté (2026-06-28)
- Auth JWT : login admin fixe (admin@bottin.ca/admin123), auto-provision parent si courriel autorisé et mot de passe = courriel, changement de mot de passe optionnel.
- Classes : CRUD (admin). Entries : CRUD par le propriétaire + admin, parent1/parent2, « appeler en premier ».
- Bottin : cartes par classe, filtre par classe (dropdown), recherche par nom d'enfant, liens tel/mailto, badge appeler en premier.
- Admin : gestion courriels autorisés (ajout en lot, retrait, purge), promotion/rétrogradation (admin principal protégé), téléversement image de couverture (arrière-plan), export Excel (.xlsx).
- Tests : 25 tests backend (100% pass), flux UI vérifiés.

## Backlog / À venir
- P1 : impression directe (PDF) du bottin, tri/ordre manuel des classes.
- P2 : courriel d'invitation aux parents, photo d'élève, consentement de visibilité par parent.
- P2 : pagination/virtualisation si grand nombre d'inscriptions.

## Prochaines actions
- Recueillir le retour de l'utilisateur sur l'apparence et les champs.
