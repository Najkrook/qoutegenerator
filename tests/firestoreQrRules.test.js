import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

const projectId = 'quote-generator-qr-rules-test';
const qrId = 'd1d3ba1f-bdee-4f45-8f63-04b379e3d45b';
let testEnv;
const describeQrRules = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

function activeRecord(overrides = {}) {
    return {
        schemaVersion: 1,
        qrId,
        inventoryId: 'BA-001',
        active: true,
        type: 'Jumbrella',
        size: '4x4',
        status: 'available',
        location: 'A-12',
        properties: { stativ: 'RAL 7016', textil: 'MUSHROOM', fot: 'TIPP', belysning: 'Classic Light', varme: 'Infra' },
        comment: '',
        updatedAt: '2026-08-09T10:00:00.000Z',
        ...overrides
    };
}

describeQrRules('BaHaMa QR Firestore rules', () => {
beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId,
        firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') }
    });
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await Promise.all([
            setDoc(doc(db, 'user_roles', 'admin-uid'), { role: 'admin' }),
            setDoc(doc(db, 'user_roles', 'quote-uid'), { role: 'quote_only' }),
            setDoc(doc(db, 'user_roles', 'sketch-uid'), { role: 'sketch_only' }),
            setDoc(doc(db, 'bahama_qr_items', qrId), activeRecord())
        ]);
    });
});

afterAll(async () => {
    await testEnv?.cleanup();
});

    it('allows explicit and legacy admins to get one item', async () => {
        for (const uid of ['admin-uid', 'ZPxZusAiyfY6cf2LSn1ynP5A7rG3']) {
            const db = testEnv.authenticatedContext(uid).firestore();
            await assertSucceeds(getDoc(doc(db, 'bahama_qr_items', qrId)));
        }
    });

    it('denies unauthenticated, non-admin and unclassified reads', async () => {
        await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'bahama_qr_items', qrId)));
        for (const uid of ['quote-uid', 'sketch-uid', 'unclassified-uid']) {
            await assertFails(getDoc(doc(testEnv.authenticatedContext(uid).firestore(), 'bahama_qr_items', qrId)));
        }
    });

    it('denies collection listing even for admins', async () => {
        const db = testEnv.authenticatedContext('admin-uid').firestore();
        await assertFails(getDocs(collection(db, 'bahama_qr_items')));
    });

    it('allows valid admin projection writes but denies non-admin and malformed writes', async () => {
        const secondQrId = '05dad2e7-d379-4124-b07a-f7fcf448392f';
        const adminDb = testEnv.authenticatedContext('admin-uid').firestore();
        const sketchDb = testEnv.authenticatedContext('sketch-uid').firestore();
        await assertSucceeds(setDoc(doc(adminDb, 'bahama_qr_items', secondQrId), activeRecord({ qrId: secondQrId, inventoryId: 'BA-002' })));
        await assertFails(setDoc(doc(sketchDb, 'bahama_qr_items', '1cb9d80b-e4dc-4506-bf45-4fbc6d799dd2'), activeRecord({ qrId: '1cb9d80b-e4dc-4506-bf45-4fbc6d799dd2' })));
        await assertFails(setDoc(doc(adminDb, 'bahama_qr_items', '4dd0c043-cabb-4168-ae35-b859b36b7207'), activeRecord({ qrId: 'wrong-id' })));
        await assertFails(deleteDoc(doc(adminDb, 'bahama_qr_items', secondQrId)));
    });

    it('accepts only the minimal archived shape', async () => {
        const archivedQrId = '0a86c1f3-0419-4b5f-8cf4-2f611dfafca1';
        const db = testEnv.authenticatedContext('admin-uid').firestore();
        await assertSucceeds(setDoc(doc(db, 'bahama_qr_items', archivedQrId), {
            schemaVersion: 1,
            qrId: archivedQrId,
            inventoryId: 'BA-003',
            active: false,
            archivedAt: '2026-08-09T10:00:00.000Z',
            updatedAt: '2026-08-09T10:00:00.000Z'
        }));
        await assertFails(setDoc(doc(db, 'bahama_qr_items', archivedQrId), {
            schemaVersion: 1,
            qrId: archivedQrId,
            inventoryId: 'BA-003',
            active: false,
            archivedAt: '2026-08-09T10:00:00.000Z',
            updatedAt: '2026-08-09T10:00:00.000Z',
            comment: 'historik får inte läcka'
        }));
    });
});
