/**
 * Adds immutable qrId values to stock/main_inventory.bahamaV2 and builds the
 * bahama_qr_items read projection. The default mode is a read-only dry run.
 *
 *   npm run inventory:qr-backfill
 *   npm run inventory:qr-backfill -- --apply
 *
 * Authentication uses GOOGLE_APPLICATION_CREDENTIALS or
 * FIREBASE_SERVICE_ACCOUNT_JSON=<path-to-service-account.json>.
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const VALID_STATUSES = new Set(['available', 'reserved', 'needs-review', 'used', 'sold']);
const QR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BATCH_WRITES = 400;

function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function record(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function activeRecord(item) {
    const properties = record(item.properties);
    return {
        schemaVersion: 1,
        qrId: item.qrId,
        inventoryId: text(item.id),
        active: true,
        type: text(item.type),
        size: text(item.size),
        status: VALID_STATUSES.has(text(item.status)) ? text(item.status) : 'available',
        location: text(item.location),
        properties: {
            stativ: text(properties.stativ),
            textil: text(properties.textil),
            fot: text(properties.fot),
            belysning: text(properties.belysning),
            varme: text(properties.varme)
        },
        comment: text(item.comment),
        updatedAt: text(item.updatedAt) || text(item.createdAt) || new Date().toISOString()
    };
}

export function planBahamaQrBackfill(data) {
    const source = record(data);
    const items = Array.isArray(source.bahamaV2) ? source.bahamaV2.map((item) => ({ ...record(item) })) : [];
    const seenInventoryIds = new Set();
    const seenQrIds = new Set();
    let assignedQrIds = 0;

    for (const item of items) {
        const inventoryId = text(item.id);
        if (!inventoryId) throw new Error('En BaHaMa-post saknar lager-ID.');
        if (seenInventoryIds.has(inventoryId)) throw new Error(`Dubblett av lager-ID: ${inventoryId}`);
        seenInventoryIds.add(inventoryId);

        let qrId = text(item.qrId).toLowerCase();
        if (qrId && !QR_ID_PATTERN.test(qrId)) throw new Error(`Ogiltigt QR-ID på ${inventoryId}: ${qrId}`);
        if (!qrId) {
            do { qrId = randomUUID(); } while (seenQrIds.has(qrId));
            item.qrId = qrId;
            assignedQrIds += 1;
        }
        if (seenQrIds.has(qrId)) throw new Error(`Dubblett av QR-ID: ${qrId}`);
        seenQrIds.add(qrId);
    }

    return {
        inventory: { ...source, bahamaV2: items },
        projections: items.map(activeRecord),
        assignedQrIds
    };
}

async function initializeFirestore() {
    const [{ applicationDefault, cert, getApps, initializeApp }, { getFirestore }] = await Promise.all([
        import('firebase-admin/app'),
        import('firebase-admin/firestore')
    ]);
    const existing = getApps()[0];
    if (existing) return getFirestore(existing);

    const credentialPath = text(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    const credential = credentialPath
        ? cert(JSON.parse(fs.readFileSync(path.resolve(credentialPath), 'utf8')))
        : applicationDefault();
    return getFirestore(initializeApp({ credential }));
}

async function applyPlan(db, plan) {
    for (let start = 0; start < plan.projections.length; start += MAX_BATCH_WRITES) {
        const batch = db.batch();
        for (const projection of plan.projections.slice(start, start + MAX_BATCH_WRITES)) {
            batch.set(db.collection('bahama_qr_items').doc(projection.qrId), projection);
        }
        await batch.commit();
    }
    await db.collection('stock').doc('main_inventory').set(plan.inventory);
}

export async function runCli(args = process.argv.slice(2)) {
    const apply = args.includes('--apply');
    const db = await initializeFirestore();
    const snapshot = await db.collection('stock').doc('main_inventory').get();
    if (!snapshot.exists) throw new Error('stock/main_inventory finns inte.');
    const plan = planBahamaQrBackfill(snapshot.data());

    console.log(`BaHaMa-poster: ${plan.projections.length}`);
    console.log(`Nya QR-ID:n: ${plan.assignedQrIds}`);
    console.log(`Läsprojektioner: ${plan.projections.length}`);
    if (!apply) {
        console.log('Dry run: inga skrivningar utfördes. Kör igen med --apply efter granskning.');
        return { applied: false, plan };
    }
    await applyPlan(db, plan);
    console.log('QR-backfill slutförd.');
    return { applied: true, plan };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    runCli().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
