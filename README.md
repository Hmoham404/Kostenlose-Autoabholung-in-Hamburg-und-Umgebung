# Car-Fit24 — fonctionnement local

Site client DE/FR/EN et administration séparée pour les enlèvements de véhicules à Hambourg, après confirmation par Sofiane.

## Lancer le site

```powershell
npm install
npm run dev
```

- Client sans connexion : http://localhost:3000/?lang=fr
- Administration par code : http://localhost:3000/admin/?lang=fr
- Aperçu avec données fictives : http://localhost:3000/admin/preview/?lang=fr

`DEMARRER-LE-SITE.cmd` lance le serveur et ouvre l’accueil ; `OUVRIR-LE-SITE.url` ouvre l’accueil si le serveur fonctionne déjà.

## Code administrateur

Le code d’accès et la clé de signature des sessions sont dans `.env.local`, exclu de Git. Ils sont vérifiés uniquement côté serveur. Aucun email, compte Supabase ni mot de passe de compte n’est nécessaire.

```dotenv
ADMIN_ACCESS_CODE=un-code-long-et-aleatoire
ADMIN_SESSION_SECRET=une-cle-aleatoire-d-au-moins-32-caracteres
```

Changer les valeurs dans `.env.local`, puis redémarrer le serveur. Changer la clé de session invalide également les sessions déjà émises. Le cookie de session est HttpOnly, SameSite Strict, valable 8 heures, et Secure lorsque la requête utilise HTTPS. L’accès au serveur doit conserver le Host public d’origine derrière un reverse proxy.

## Enregistrement réel des demandes

La version actuelle enregistre les demandes **sur le disque du serveur**, sans dépendre de Supabase :

- `.data/requests/<UUID>.json` : informations du formulaire, références des photos, statut et rendez-vous.
- `.data/photos/<UUID>/` : photos privées, servies uniquement par une route administrateur authentifiée.

Les photos sont compressées dans le navigateur, limitées à 6 fichiers de 2 Mo après compression. Le serveur vérifie aussi le nombre, la taille, les signatures de fichiers et les champs du formulaire. Le JSON contient les noms de fichiers, jamais les images en base64.

Sauvegarder `.data/` et le conserver sur un disque persistant. Les données sont propres à cette installation ; elles ne sont pas synchronisées avec Supabase ni entre plusieurs serveurs. Le code SQL `supabase/setup.sql` reste disponible pour une future intégration ; il n’est pas utilisé par le fonctionnement actuel. Ne pas réutiliser la clé secrète divulguée dans la conversation.

Les limites de débit sont en mémoire du processus : 12 essais de code/minute et 30 demandes/minute au total. Pour un déploiement public, ajouter une protection anti-abus au niveau de l’hébergeur et adapter la conservation, les sauvegardes et les informations de confidentialité aux réglages réels.

## Décisions et rendez-vous par email

Le client renseigne désormais une adresse email obligatoire. Une ancienne demande peut être complétée depuis sa fiche dans l’administration.

Le formulaire demande aussi un téléphone et propose un numéro WhatsApp distinct. Par défaut, WhatsApp reprend le téléphone. L’administration permet de modifier ces coordonnées et propose des liens directs email, appel et WhatsApp. Pour les numéros WhatsApp, utiliser le format international avec `+` ; les numéros locaux commençant par `0` sont interprétés comme allemands.

- **Accepter** : valide la demande, sans envoyer de message à cette étape.
- **Refuser** : classe la demande en refusée, efface le rendez-vous prévu et n’envoie aucun message au client.
- Pour une demande acceptée : renseigner l’email, enregistrer, puis charger l’aperçu. Le modèle d’acceptation est en **allemand**. L’objet et le message sont modifiables et enregistrables dans `email_draft` sans envoyer d’email. Une acceptation peut être préparée avant de fixer la date. Lorsqu’une date/heure de Hambourg est renseignée, une pièce jointe calendrier `.ics` accompagne le rendez-vous.

La suppression d’une demande la déplace dans `.data/trash/`, retire ses données client de la liste active et bloque l’accès à ses photos. Le bouton « Annuler la suppression » restaure la demande pendant la session courante. Ce mécanisme conserve les fichiers en corbeille : ce n’est pas une purge définitive. Définir une durée de conservation pour cette corbeille avant publication.

Le logo de profil créé pour Sofiane est disponible dans `public/images/sofiane-carfit24.png` et sa version web optimisée dans `sofiane-carfit24.webp`. Le prompt et le mode de génération sont consignés dans `public/images/sofiane-logo-prompt.md`.

## Mise à jour SQL Supabase

Pour un projet Supabase déjà initialisé avec `supabase/setup.sql`, copier **`supabase/update-2026-11-12.sql`** dans SQL Editor et exécuter le script. Pour un nouveau projet, exécuter d’abord `setup.sql`, puis cette mise à jour. Elle ajoute les statuts accepté/refusé, les brouillons allemands, les métadonnées d’envoi, les contacts et la suppression via `deleted_at`, en conservant les règles d’accès administrateur.

Ce script est fourni pour la future connexion Supabase. Il n’a pas été appliqué à votre projet distant et ne synchronise pas le stockage local `.data/`. Le code d’accès serveur reste distinct de Supabase Auth ; ne pas le copier dans les tables ou le JavaScript public.

## Configuration de l’envoi email

L’envoi automatique utilise un fournisseur SMTP de votre choix, indépendamment du domaine. Compléter les valeurs privées dans `.env.local` puis redémarrer :

```dotenv
SMTP_HOST=smtp.votre-fournisseur.tld
SMTP_PORT=587
SMTP_USER=votre-identifiant
SMTP_PASSWORD=votre-mot-de-passe-smtp
SMTP_FROM=info@votre-domaine.tld
```

Le port 587 utilise STARTTLS obligatoire ; le port 465 utilise TLS direct. Le domaine d’expédition doit être autorisé chez le fournisseur choisi. Aucune configuration SMTP réelle n’est fournie dans ce projet : tant qu’elle manque, l’interface propose d’ouvrir l’email prérempli dans votre messagerie ou de télécharger un `.eml` avec le calendrier. Il faut alors envoyer le message dans votre application. L’interface ne prétend pas qu’un brouillon est envoyé.

Lorsque le serveur SMTP accepte le message, la demande passe au statut « Rendez-vous fixé » et conserve l’adresse destinataire et l’horodatage d’envoi. Cela ne garantit pas la réception dans la boîte du client. Un même rendez-vous ne peut pas être envoyé deux fois sans modifier ses détails. Les refus ne passent jamais par le service d’envoi.

## Hébergement et domaine one.com

Cette version utilise des routes serveur pour l’accès par code et l’enregistrement : **elle nécessite Node.js et un stockage persistant**. L’ancien export statique `out/` ne contient pas cette fonctionnalité et ne doit pas être publié comme version actuelle.

```powershell
npm run build
npm run start
```

Héberger le projet sur un serveur Node.js avec HTTPS, définir les deux variables privées et conserver `.data/` sur disque. Ensuite, connecter le domaine one.com avec les enregistrements DNS fournis par l’hébergeur. Un hébergement qui ne sert que des fichiers statiques ne suffit plus pour cette version.

Les pages légales restent des brouillons à compléter avec l’identité complète de l’exploitant, le prestataire réel, les durées de conservation et les autres informations applicables. L’envoi de rendez-vous nécessite la configuration email décrite ci-dessus.

## Vérifier

```powershell
npm run typecheck
npm run build
# Avec le serveur local lancé :
node scripts/verify-local.mjs
```

Le test d’intégration vérifie l’envoi, la persistance JSON, une photo privée, le code d’accès, la session signée, les modifications de statut et rendez-vous, les validations et les restrictions d’origine. Il supprime uniquement la demande technique qu’il a lui-même créée.
