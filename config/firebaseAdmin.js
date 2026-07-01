/**
 * Initialize Firebase Admin SDK from service account JSON or env.
 */
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import { join } from 'path';

export function findFirebaseServiceAccountFile(rootDir) {
    const explicit = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
    if (explicit) {
        const path = join(rootDir, explicit);
        if (fs.existsSync(path)) return path;
    }

    if (!fs.existsSync(rootDir)) return null;

    return fs.readdirSync(rootDir).find((name) => (
        (name.includes('firebase-adminsdk') || name.startsWith('firebase-service-account'))
        && name.endsWith('.json')
    )) || null;
}

export function initFirebaseAdmin(rootDir) {
    if (getApps().length) {
        return { app: getApps()[0], sourceFile: null };
    }

    const fileName = findFirebaseServiceAccountFile(rootDir);
    if (fileName) {
        const filePath = join(rootDir, fileName);
        const serviceAccount = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const app = initializeApp({
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id,
        });
        return { app, sourceFile: filePath };
    }

    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    if (!projectId) return null;

    console.warn('Firebase Admin: no service account JSON found. Add firebase-adminsdk-*.json to project root.');
    return null;
}

export async function verifyFirebaseIdToken(app, idToken) {
    return getAuth(app).verifyIdToken(idToken);
}
