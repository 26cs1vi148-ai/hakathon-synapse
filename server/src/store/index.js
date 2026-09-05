import { localStore } from './localStore.js';
import { firestoreStore } from './firestoreStore.js';

export const store = process.env.STORAGE_MODE === 'firestore' ? firestoreStore : localStore;
