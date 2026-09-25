import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'astrovedham-79522';
  initializeApp({
    projectId,
  });
}

export const getFirebaseAuth = () => getAuth();
