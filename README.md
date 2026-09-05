# Campus SOS Emergency System

A complete React/Vite + Express + Firestore-ready campus emergency system with:

- Student SOS interface
- Browser GPS permission and high-accuracy location
- Google Maps URL generation
- `wa.me` pre-filled-message deep link only
- Manual WhatsApp Send step (never automatic)
- SOS persistence
- Realtime dashboard updates through Server-Sent Events
- Leaflet + OpenStreetMap maps
- Live location tracking while an SOS is active
- ACTIVE / RESPONDED / RESOLVED lifecycle
- Demo mode with fake SOS and simulated movement
- Firebase Firestore adapter for production
- Local JSON persistence fallback for development/demo
- Input validation, rate limiting, helmet, CORS, and server-side validation

## Important WhatsApp constraint

This project intentionally contains **no WhatsApp/Meta API integration**. The student browser only navigates to a normal `wa.me/<phone>?text=<encoded message>` URL. WhatsApp then displays the pre-filled message and the user manually presses Send.

## Requirements

- Node.js 20+
- npm
- A Firebase project only if you want Firestore production mode
- HTTPS in production for browser geolocation

## Install

From the project root:

```bash
npm install
npm run install:all
```

Copy environment files:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

The project runs without Firebase credentials in `local` mode, which is useful for demos. For production, configure `STORAGE_MODE=firestore` and Firebase service-account credentials on the server.

## Run

```bash
npm run dev
```

- Student: http://localhost:5173/
- Security: http://localhost:5173/security
- Demo: http://localhost:5173/demo
- API health: http://localhost:5000/api/health

## Firebase production mode

Create a Firebase project and Firestore database. Register a server service account and set:

```env
STORAGE_MODE=firestore
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
```

Do not put the Firebase Admin credentials in the client `.env`.

Collections created automatically:

- `students`
- `sos_alerts`
- `location_updates`

## Student test

1. Open `/` on a device/browser that supports location.
2. Edit the demo student profile if desired.
3. Press SOS.
4. Confirm the emergency action.
5. Allow location permission.
6. The SOS is created first.
7. WhatsApp opens using the normal `wa.me` deep link with a pre-filled message.
8. Manually press Send in WhatsApp.
9. Keep the student page open to continue GPS tracking.
10. Open `/security` to watch the marker update.

For localhost, browser GPS may work depending on browser security policy. For mobile production, use HTTPS.

## Demo mode

Open `/demo`. It can create fake alerts, simulate movement, mark alerts responded, and resolve them. Demo data is stored locally when `STORAGE_MODE=local`.

## Deployment

Build the frontend:

```bash
npm run build
```

Deploy `client/dist` to a static host and deploy `server` to a Node host. Set the frontend API URL to the deployed backend. Use HTTPS for the frontend so geolocation works.

For Firebase Hosting, Vite's production build outputs a static bundle suitable for static hosting.

## Security before real campus use

This package is a strong functional foundation, not a certified emergency-response platform. Before a real deployment, add institutional SSO/Firebase Authentication, role-based authorization, audit logging, strict Firestore rules, privacy/retention policy, monitoring, offline retry, push notifications, incident escalation, abuse controls, and formal emergency-process testing.

## Windows quick start

If PowerShell blocks `npm.ps1`, use `npm.cmd` instead:

```powershell
cd server
npm.cmd install
npm.cmd run dev
```

Open a second VS Code terminal:

```powershell
cd client
npm.cmd install --legacy-peer-deps
npm.cmd run dev
```

Then open `http://localhost:5173/`.

The client includes a Vite React config and an error boundary. If the browser cannot render the app, it will show the JavaScript error on-screen instead of a blank page.
