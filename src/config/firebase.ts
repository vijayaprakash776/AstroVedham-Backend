
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let firebaseApp: App | null = null;

export const initFirebaseAdmin = (): App => {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'astrovedham-79522';
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  console.log('[FIREBASE ADMIN] Initializing Firebase Admin SDK...');
  console.log(`[FIREBASE ADMIN] Environment variables check - FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? 'set' : 'not set (using fallback: astrovedham-79522)'}`);
  console.log(`[FIREBASE ADMIN] FIREBASE_SERVICE_ACCOUNT present: ${serviceAccountJson ? 'yes' : 'no'}`);
  console.log(`[FIREBASE ADMIN] FIREBASE_PRIVATE_KEY present: ${privateKey ? 'yes' : 'no'}`);
  console.log(`[FIREBASE ADMIN] FIREBASE_CLIENT_EMAIL present: ${clientEmail ? 'yes' : 'no'}`);
  console.log(`[FIREBASE ADMIN] GOOGLE_APPLICATION_CREDENTIALS present: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'yes' : 'no'}`);

  try {
    if (serviceAccountJson) {
      try {
        const parsed = JSON.parse(serviceAccountJson);
        console.log('[FIREBASE ADMIN] Using FIREBASE_SERVICE_ACCOUNT JSON credential');
        firebaseApp = initializeApp({
          credential: cert(parsed),
          projectId: parsed.project_id || projectId,
        });
        return firebaseApp;
      } catch (parseErr: any) {
        console.error('[FIREBASE ADMIN] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', parseErr.message);
      }
    }

    if (privateKey && clientEmail) {
      console.log('[FIREBASE ADMIN] Using FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL credential');
      const formattedKey = privateKey.replace(/\\n/g, '\n');
      firebaseApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: formattedKey,
        }),
        projectId,
      });
      return firebaseApp;
    }

    console.log(`[FIREBASE ADMIN] Using default app initialization with projectId: ${projectId}`);
    firebaseApp = initializeApp({
      projectId,
    });
    return firebaseApp;
  } catch (err: any) {
    console.error('[FIREBASE ADMIN] Error during initializeApp:', err?.message, err?.stack);
    throw err;
  }
};

export const getFirebaseAuth = () => {
  initFirebaseAdmin();
  return getAuth();
};
