import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore as adminFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const serviceAccount = JSON.parse(
  readFileSync(
    join(__dirname, '../../serviceAccountKey.json'),
    'utf8'
  )
);

function ensureInitialized() {
  if (!getApps().length) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  }
}

export function getFirestore() {
  ensureInitialized();
  return adminFirestore();
}