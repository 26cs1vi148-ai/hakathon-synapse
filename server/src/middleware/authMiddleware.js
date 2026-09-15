import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from '../config/firebase.js';

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Authentication required.'
      });
    }

    const token = header.slice(7);

    // Initializes Firebase Admin if it has not already been initialized.
    getFirestore();

    const decodedToken = await getAuth().verifyIdToken(token);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || ''
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error.message);

    return res.status(401).json({
      message: 'Invalid or expired authentication token.'
    });
  }
}