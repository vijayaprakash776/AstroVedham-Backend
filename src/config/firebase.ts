import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let firebaseApp: App;

if (getApps().length === 0) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      let serviceAccount: any;
      if (serviceAccountStr.startsWith('{')) {
        serviceAccount = JSON.parse(serviceAccountStr);
      } else {
        serviceAccount = require(serviceAccountStr);
      }
      firebaseApp = initializeApp({
        credential: cert(serviceAccount)
      });
      console.log('[FIREBASE ADMIN] Initialized successfully with FIREBASE_SERVICE_ACCOUNT');
    } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      firebaseApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID || 'astrovedham-79522',
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      console.log('[FIREBASE ADMIN] Initialized successfully with environment credentials');
    } else {
      firebaseApp = initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'astrovedham-79522'
      });
      console.log('[FIREBASE ADMIN] Initialized with default project ID');
    }
  } catch (error) {
    console.error('[FIREBASE ADMIN] Initialization warning:', error);
    try {
      firebaseApp = initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || 'astrovedham-79522'
      });
    } catch (e) {
      console.error('[FIREBASE ADMIN] Fallback initialization error:', e);
      firebaseApp = getApps()[0];
    }
  }
} else {
  firebaseApp = getApps()[0];
}

export const firebaseAuth = getAuth(firebaseApp);
export default firebaseApp;
