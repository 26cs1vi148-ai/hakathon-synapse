import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyC7nCs8diyEv4Ti9o1sd8JtZ2Tz1wFJ-60',
  authDomain: 'campus-sos-3e052.firebaseapp.com',
  projectId: 'campus-sos-3e052',
  storageBucket: 'campus-sos-3e052.firebasestorage.app',
  messagingSenderId: '85124562696',
  appId: '1:85124562696:web:b1742162bedc8af3c0b6bd',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);