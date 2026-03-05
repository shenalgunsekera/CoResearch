# CoResearch

Production-ready Next.js + Firebase collaborative research platform.

## Setup

1. Install dependencies:
`npm install`

2. Create `.env.local` with:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

3. Enable Firebase services:
- Authentication -> Email/Password
- Firestore Database

4. Required Firestore collections:
- `universities` (at least one document with a `name` field)
- `users`
- `pendingUsers`
- `documents`
- `chatMessages`

## Seed Admin + University

1. Fill `seed.json` with your real admin UID/email/university values.

2. Download a Firebase service account key JSON from:
Firebase Console -> Project Settings -> Service accounts -> Generate new private key

3. Run seeding (PowerShell):
`$env:FIREBASE_SERVICE_ACCOUNT_JSON = Get-Content .\service-account.json -Raw`
`npm run seed:firestore`

## Run

- Dev: `npm run dev`
- Type-check: `npm run type-check`
- Lint: `npm run lint`
- Build: `npm run build`
- Seed Firestore: `npm run seed:firestore`

## Firestore Security Rules (Production)

Deploy included rules/indexes from project root:

1. Install Firebase CLI:
`npm i -g firebase-tools`

2. Login:
`firebase login`

3. Select project:
`firebase use coresearch-d5239`

4. Deploy rules and indexes:
`firebase deploy --only firestore:rules,firestore:indexes,storage`
