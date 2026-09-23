import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const describeRules = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
let testEnv;

describeRules('inventory document Firestore rules', () => {
    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId: 'quote-generator-inventory-rules-test',
            firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') }
        });
        await testEnv.withSecurityRulesDisabled(async (context) => {
            await Promise.all([
                setDoc(doc(context.firestore(), 'user_roles', 'admin-uid'), { role: 'admin' }),
                setDoc(doc(context.firestore(), 'user_roles', 'quote-uid'), { role: 'quote_only' }),
                setDoc(doc(context.firestore(), 'user_roles', 'sketch-uid'), { role: 'sketch_only' })
            ]);
        });
    });

    afterAll(async () => { await testEnv?.cleanup(); });

    it('allows admins to save and read the expanded inventory shape', async () => {
        const db = testEnv.authenticatedContext('admin-uid').firestore();
        const inventoryRef = doc(db, 'stock', 'main_inventory');
        await assertSucceeds(setDoc(inventoryRef, {
            bahama: [], bahamaV2: [], clickitup: {}, notes: '',
            clickitupAccessories: { stickfot_std_singel: 206, stolpe: 26 },
            clickitupCounted: { 'size:700': true, 'accessory:stolpe': true }
        }));
        const snapshot = await assertSucceeds(getDoc(inventoryRef));
        expect(snapshot.data().clickitupAccessories.stolpe).toBe(26);
    });

    it('denies guests and non-admin roles read and write access', async () => {
        const payload = { clickitupAccessories: { stolpe: 1 }, clickitupCounted: {} };
        for (const context of [
            testEnv.unauthenticatedContext(),
            testEnv.authenticatedContext('quote-uid'),
            testEnv.authenticatedContext('sketch-uid')
        ]) {
            const inventoryRef = doc(context.firestore(), 'stock', 'main_inventory');
            await assertFails(getDoc(inventoryRef));
            await assertFails(setDoc(inventoryRef, payload));
        }
    });
});
