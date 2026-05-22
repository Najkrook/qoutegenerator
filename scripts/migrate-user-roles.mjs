import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// Replace this with your service account key file path when running in production
const serviceAccountPath = './serviceAccountKey.json';

// explicitly redefined to avoid TS import complications
const ADMIN_UIDS = [
    'ZPxZusAiyfY6cf2LSn1ynP5A7rG3',
    'XolYJ2aOCdZPgiTg4WKVSOcRPmO2',
    'cNXpQsFClscsPGURl0gedehYcFo2'
];

const SKETCH_ONLY_UIDS = [
    'VpHpMybaN0VbmSsDkz57Jryyx3v1'
];

async function migrateRoles() {
    if (!fs.existsSync(serviceAccountPath)) {
        console.error(\`Service account key not found at \${serviceAccountPath}\`);
        console.error('Please download your Firebase Admin service account key and place it at the root as "serviceAccountKey.json".');
        process.exit(1);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    initializeApp({
        credential: cert(serviceAccount)
    });

    const db = getFirestore();
    const batch = db.batch();

    console.log('Seeding ADMIN roles...');
    for (const uid of ADMIN_UIDS) {
        const docRef = db.collection('user_roles').doc(uid);
        batch.set(docRef, { role: 'admin' }, { merge: true });
        console.log(\`Prepared admin role for UID: \${uid}\`);
    }

    console.log('Seeding SKETCH_ONLY roles...');
    for (const uid of SKETCH_ONLY_UIDS) {
        const docRef = db.collection('user_roles').doc(uid);
        batch.set(docRef, { role: 'sketch_only' }, { merge: true });
        console.log(\`Prepared sketch_only role for UID: \${uid}\`);
    }

    try {
        console.log('Committing batch...');
        await batch.commit();
        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    }
}

migrateRoles();
