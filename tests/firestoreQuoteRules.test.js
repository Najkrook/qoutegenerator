import fs from 'node:fs';
import { afterAll, beforeAll, describe, it } from 'vitest';
import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

const projectId = 'quote-generator-quote-rules-test';
const describeQuoteRules = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
let testEnv;

function quoteMetadata(overrides = {}) {
    return {
        ownerUid: 'owner-uid',
        originType: 'internal',
        crmDealId: null,
        latestSaveIntentId: 'intent-1',
        crmSynchronizationIssue: null,
        ...overrides
    };
}

function revision(overrides = {}) {
    return {
        quoteId: 'quote-1',
        version: 1,
        savedAtMs: 1,
        savedBy: 'owner@example.com',
        savedByUid: 'owner-uid',
        state: { customerInfo: { name: 'Testkund' } },
        summary: { finalTotalSek: 1000, grossTotalSek: 1000, totalDiscountSek: 0 },
        changeNote: '',
        saveIntentId: 'intent-1',
        ...overrides
    };
}

function commercialSnapshot(overrides = {}) {
    return {
        schemaVersion: 1,
        presentation: { exportLanguage: 'sv', pdfThemeId: 'brixx' },
        effectiveQuoteDate: '2026-05-21',
        productRows: [{
            model: 'BaHaMa Jumbrella',
            size: '3x3',
            unitPrice: 1000,
            qty: 1,
            gross: 1000,
            discountPct: 0,
            discountSek: 0,
            net: 1000,
            isAddon: false,
            isCustom: false,
            priceUponRequest: false,
            line: 'BaHaMa'
        }],
        productTotals: {
            includesVat: false,
            grossTotalSek: 1000,
            totalDiscountSek: 0,
            finalTotalSek: 1000,
            globalDiscountAmt: 0,
            globalDiscountPct: 0,
            vatBasisSek: 1000,
            vatAmountSek: 250,
            totalWithVatSek: 1250
        },
        contractingWork: null,
        visibility: { contractingWork: 'absent', discountReferences: 'visible' },
        ...overrides
    };
}

function crmIssue(overrides = {}) {
    return {
        code: 'unavailable',
        dealId: 'deal-1',
        saveIntentId: 'intent-1',
        revisionId: 'intent_intent-1',
        quoteVersion: 1,
        firstFailedAtMs: 1,
        lastAttemptAtMs: 1,
        attemptCount: 1,
        nextRetryAtMs: 1501,
        requiresRelink: false,
        conflictingDealId: null,
        conflictingQuoteOwnerUid: null,
        conflictingQuoteId: null,
        diagnosticCode: 'unavailable',
        ...overrides
    };
}

describeQuoteRules('Quote Save Firestore rules', () => {
    beforeAll(async () => {
        testEnv = await initializeTestEnvironment({
            projectId,
            firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') }
        });
        await testEnv.withSecurityRulesDisabled(async (context) => {
            const db = context.firestore();
            await Promise.all([
                setDoc(doc(db, 'user_roles', 'admin-uid'), { role: 'admin' }),
                setDoc(doc(db, 'user_roles', 'owner-uid'), { role: 'quote_only' })
            ]);
        });
    });

    afterAll(async () => {
        await testEnv?.cleanup();
    });

    it('allows owner creation only when path owner and additive metadata agree', async () => {
        const db = testEnv.authenticatedContext('owner-uid').firestore();
        await assertSucceeds(setDoc(
            doc(db, 'users', 'owner-uid', 'quotes', 'quote-1'),
            quoteMetadata()
        ));
        await assertFails(setDoc(
            doc(db, 'users', 'owner-uid', 'quotes', 'quote-bad-owner'),
            quoteMetadata({ ownerUid: 'someone-else' })
        ));
        await assertFails(setDoc(
            doc(db, 'users', 'owner-uid', 'quotes', 'quote-bad-origin'),
            quoteMetadata({ originType: 'unknown-origin' })
        ));
    });

    it('keeps Quote Owner and Quote Origin stable', async () => {
        const db = testEnv.authenticatedContext('admin-uid').firestore();
        const quoteRef = doc(db, 'users', 'owner-uid', 'quotes', 'quote-1');
        await assertFails(updateDoc(quoteRef, { ownerUid: 'admin-uid' }));
        await assertFails(updateDoc(quoteRef, { originType: 'retailer' }));
    });

    it('accepts a valid durable CRM issue and rejects malformed issue metadata', async () => {
        const db = testEnv.authenticatedContext('admin-uid').firestore();
        const quoteRef = doc(db, 'users', 'owner-uid', 'quotes', 'quote-1');
        await assertSucceeds(updateDoc(quoteRef, {
            crmSynchronizationIssue: crmIssue({
                code: 'pending',
                firstFailedAtMs: 0,
                lastAttemptAtMs: 0,
                attemptCount: 0,
                nextRetryAtMs: null,
                diagnosticCode: 'pending'
            })
        }));
        await assertSucceeds(updateDoc(quoteRef, { crmSynchronizationIssue: crmIssue() }));
        await assertFails(updateDoc(quoteRef, {
            crmSynchronizationIssue: crmIssue({ attemptCount: 'one' })
        }));
    });

    it('allows one immutable Save Intent revision and rejects revision state routing data', async () => {
        const db = testEnv.authenticatedContext('owner-uid').firestore();
        const revisionRef = doc(
            db,
            'users',
            'owner-uid',
            'quotes',
            'quote-1',
            'revisions',
            'intent_intent-1'
        );
        await assertSucceeds(setDoc(revisionRef, revision()));
        await assertFails(updateDoc(revisionRef, { changeNote: 'mutated' }));
        await assertFails(setDoc(
            doc(db, 'users', 'owner-uid', 'quotes', 'quote-1', 'revisions', 'intent_bad'),
            revision({ state: { crmDealId: 'deal-1' }, saveIntentId: 'bad' })
        ));
        await assertFails(setDoc(
            doc(db, 'users', 'owner-uid', 'quotes', 'quote-1', 'revisions', 'intent_private'),
            revision({ state: { internalMargins: { BaHaMa: 55 } }, saveIntentId: 'private' })
        ));
        await assertFails(setDoc(
            doc(db, 'users', 'owner-uid', 'quotes', 'quote-1', 'revisions', 'intent_nested'),
            revision({
                state: { customerInfo: { name: 'Testkund', internalMargins: { BaHaMa: 55 } } },
                saveIntentId: 'nested'
            })
        ));
        await assertFails(setDoc(
            doc(db, 'users', 'owner-uid', 'quotes', 'quote-1', 'revisions', 'intent_envelope'),
            revision({ crmRouting: { dealId: 'deal-1' }, saveIntentId: 'envelope' })
        ));
        await assertFails(setDoc(
            doc(db, 'users', 'owner-uid', 'quotes', 'quote-1', 'revisions', 'intent_contracting'),
            revision({
                state: { contractingWork: { internalMargins: { BaHaMa: 55 } } },
                saveIntentId: 'contracting'
            })
        ));
        await assertFails(setDoc(
            doc(db, 'users', 'owner-uid', 'quotes', 'quote-1', 'revisions', 'intent_other'),
            revision({ saveIntentId: 'same-intent' })
        ));
    });

    it('accepts the versioned commercial snapshot envelope and rejects unknown top-level fields', async () => {
        const db = testEnv.authenticatedContext('owner-uid').firestore();
        await assertSucceeds(setDoc(
            doc(db, 'users', 'owner-uid', 'quotes', 'quote-1', 'revisions', 'intent_snapshot'),
            revision({ commercialSnapshot: commercialSnapshot(), saveIntentId: 'snapshot' })
        ));
        await assertFails(setDoc(
            doc(db, 'users', 'owner-uid', 'quotes', 'quote-1', 'revisions', 'intent_bad-snapshot'),
            revision({
                commercialSnapshot: commercialSnapshot({ marginAnalysis: { profit: 999999 } }),
                saveIntentId: 'bad-snapshot'
            })
        ));
    });
});
