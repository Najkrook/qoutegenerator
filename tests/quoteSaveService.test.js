import { describe, expect, it, vi } from 'vitest';
import { createQuoteSaveModule } from '../src/services/quoteSaveService';
import { createQuoteRepository } from '../src/services/quoteRepository';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';
import { createFirestoreMock } from './fixtures/firestoreMock';
import { catalogData } from '../src/data/catalog';
import { computeQuoteTotals } from '../src/services/calculationEngine';

const ACTOR = { uid: 'actor-1', email: 'sales@example.com' };
const SUMMARY = {
    finalTotalSek: 126000,
    grossTotalSek: 140000,
    totalDiscountSek: 14000,
    totals: [{
        model: 'Jumbrella',
        size: '4x4',
        unitPrice: 140000,
        qty: 1,
        gross: 140000,
        discountPct: 10,
        discountSek: 14000,
        net: 126000,
        isAddon: false,
        source: { type: 'builder', itemId: 'item-1' },
        line: 'BaHaMa',
        sortModel: 'Jumbrella',
        sortSizeRaw: '4x4',
        sortKind: 'dimension',
        sortDimensions: [4, 4],
        originalIndex: 0
    }],
    globalDiscountAmt: 0
};

function quoteState(overrides = {}) {
    const initial = createInitialQuoteState();
    return {
        ...initial,
        selectedLines: ['BaHaMa'],
        builderItems: [{
            id: 'item-1',
            line: 'BaHaMa',
            model: 'Jumbrella',
            size: '4x4 Kvadrat',
            qty: 1,
            discountPct: 0,
            addons: []
        }],
        customerInfo: {
            ...initial.customerInfo,
            name: 'Ada Andersson',
            company: 'Testbolaget AB',
            reference: 'Uteservering',
            ...overrides.customerInfo
        },
        ...overrides
    };
}

function conflictError(message, details = {}) {
    return Object.assign(new Error(message), {
        code: 'crm-link-conflict',
        ...details
    });
}

function createHarness({
    initialDocs = {},
    deals = {},
    persistenceOverride = {},
    activityResult,
    moduleOptions = {}
} = {}) {
    const firestore = createFirestoreMock(initialDocs);
    const repository = createQuoteRepository(firestore);
    const dealStore = new Map(Object.entries(deals).map(([id, deal]) => [id, {
        id,
        stage: 'lead',
        quoteOwnerUid: null,
        quoteId: null,
        quoteNumber: null,
        quoteRevisionId: null,
        quoteVersion: null,
        valueSek: 0,
        ...deal
    }]));
    const scheduled = [];

    async function writeLink(input, allowRelink) {
        const deal = dealStore.get(input.dealId);
        if (!deal) throw new Error('CRM deal not found.');
        const quotePath = `users/${input.quoteOwnerUid}/quotes/${input.quoteId}`;
        const quote = firestore.__docs.get(quotePath);
        if (!quote) throw new Error('Quote not found.');

        if (quote.crmDealId && quote.crmDealId !== input.dealId && !allowRelink) {
            throw conflictError('Quote is already linked to another CRM deal.', {
                conflictingDealId: quote.crmDealId,
                conflictingQuoteOwnerUid: input.quoteOwnerUid,
                conflictingQuoteId: input.quoteId
            });
        }
        if (
            deal.quoteOwnerUid
            && deal.quoteId
            && (deal.quoteOwnerUid !== input.quoteOwnerUid || deal.quoteId !== input.quoteId)
            && !allowRelink
        ) {
            throw conflictError('CRM deal is already linked to another quote.', {
                conflictingQuoteOwnerUid: deal.quoteOwnerUid,
                conflictingQuoteId: deal.quoteId
            });
        }

        if (allowRelink && deal.quoteOwnerUid && deal.quoteId) {
            const oldQuotePath = `users/${deal.quoteOwnerUid}/quotes/${deal.quoteId}`;
            const oldQuote = firestore.__docs.get(oldQuotePath);
            if (oldQuote?.crmDealId === input.dealId) {
                await firestore.setDoc({ path: oldQuotePath }, { crmDealId: null }, { merge: true });
            }
        }
        if (allowRelink && quote.crmDealId && quote.crmDealId !== input.dealId) {
            const previousDeal = dealStore.get(quote.crmDealId);
            if (previousDeal?.quoteOwnerUid === input.quoteOwnerUid && previousDeal?.quoteId === input.quoteId) {
                dealStore.set(previousDeal.id, {
                    ...previousDeal,
                    stage: previousDeal.stage === 'quote' ? 'lead' : previousDeal.stage,
                    quoteOwnerUid: null,
                    quoteId: null,
                    quoteNumber: null,
                    quoteRevisionId: null,
                    quoteVersion: null
                });
            }
        }

        const firstLink = !deal.quoteOwnerUid || !deal.quoteId;
        const linked = {
            ...deal,
            stage: firstLink && deal.stage === 'lead' ? 'quote' : deal.stage,
            quoteOwnerUid: input.quoteOwnerUid,
            quoteId: input.quoteId,
            quoteNumber: input.quoteNumber || null,
            quoteRevisionId: input.quoteRevisionId || null,
            quoteVersion: input.quoteVersion || null,
            valueSek: input.valueSek || 0
        };
        dealStore.set(input.dealId, linked);
        await firestore.setDoc({ path: quotePath }, { crmDealId: input.dealId }, { merge: true });
        return linked;
    }

    const crm = {
        getDeal: vi.fn(async (dealId) => dealStore.get(dealId) || null),
        linkDealToQuote: vi.fn((input) => writeLink(input, false)),
        relinkDealToQuote: vi.fn((input) => writeLink(input, true))
    };
    const logActivity = vi.fn(async () => {
        if (activityResult instanceof Error) throw activityResult;
        return activityResult || { ok: true };
    });
    let intentSequence = 0;
    let nowMs = Date.parse('2026-08-09T10:00:00.000Z');
    const quotePersistence = { ...repository, ...persistenceOverride };
    const module = createQuoteSaveModule({
        quotePersistence,
        crm,
        logActivity,
        calculateTotals: vi.fn(() => SUMMARY),
        createSaveIntentId: () => `intent-${++intentSequence}`,
        now: () => nowMs++,
        schedule: (callback, delayMs) => {
            scheduled.push({ callback, delayMs });
            return scheduled.length;
        },
        ...moduleOptions
    });

    return { module, repository, quotePersistence, firestore, crm, dealStore, logActivity, scheduled };
}

function revisionPaths(firestore, ownerUid, quoteId) {
    const prefix = `users/${ownerUid}/quotes/${quoteId}/revisions/`;
    return [...firestore.__docs.keys()].filter((path) => path.startsWith(prefix));
}

describe('Quote Save module', () => {
    it('returns a typed validation outcome for a draft without configured content', async () => {
        const harness = createHarness();
        const state = quoteState();
        state.builderItems = [];
        state.gridSelections = {};

        const result = await harness.module.save({
            actor: ACTOR,
            state,
            target: { kind: 'new' }
        });

        expect(result).toMatchObject({
            status: 'not-saved',
            failure: { code: 'invalid-draft', retryable: false }
        });
        expect([...harness.firestore.__docs.keys()].some((path) => path.includes('/quotes/'))).toBe(false);
    });

    it('saves a quote containing only custom grid items', async () => {
        const harness = createHarness();
        const state = quoteState({
            builderItems: [],
            gridSelections: {
                BaHaMa: {
                    items: {},
                    addons: {},
                    customAddonsByCategory: {},
                    customItems: [{
                        id: 'custom-item-1',
                        name: 'Specialprodukt',
                        size: 'Special size',
                        price: 12000,
                        qty: 1,
                        discountPct: 0
                    }]
                }
            }
        });

        const result = await harness.module.save({ actor: ACTOR, state, target: { kind: 'new' } });

        expect(result.status).toBe('saved');
        const revisionPath = revisionPaths(harness.firestore, 'actor-1', result.quote.quoteId)[0];
        expect(harness.firestore.__docs.get(revisionPath).state.gridSelections.BaHaMa.customItems)
            .toHaveLength(1);
    });

    it('saves a quote containing only custom grid add-ons', async () => {
        const harness = createHarness();
        const state = quoteState({
            builderItems: [],
            gridSelections: {
                BaHaMa: {
                    items: {},
                    addons: {},
                    customItems: [],
                    customAddonsByCategory: {
                        special: [{
                            id: 'custom-addon-1',
                            name: 'Specialtillval',
                            price: 2500,
                            qty: 1,
                            discountPct: 0
                        }]
                    }
                }
            }
        });

        const result = await harness.module.save({ actor: ACTOR, state, target: { kind: 'new' } });

        expect(result.status).toBe('saved');
        const revisionPath = revisionPaths(harness.firestore, 'actor-1', result.quote.quoteId)[0];
        expect(harness.firestore.__docs.get(revisionPath).state.gridSelections.BaHaMa.customAddonsByCategory.special)
            .toHaveLength(1);
    });

    it('creates a new Quote Revision and computes canonical totals internally', async () => {
        const harness = createHarness();
        const result = await harness.module.save({
            actor: ACTOR,
            state: quoteState(),
            target: { kind: 'new' }
        });

        expect(result.status).toBe('saved');
        expect(result.isNewQuote).toBe(true);
        expect(result.statePatch).toMatchObject({
            activeQuoteVersion: 1,
            quoteStatus: 'draft'
        });
        expect(result.statePatch.quoteNumber).toMatch(/^BRIXX - /);
        const quoteDoc = harness.firestore.__docs.get(
            `users/actor-1/quotes/${result.quote.quoteId}`
        );
        expect(quoteDoc).toMatchObject({
            ownerUid: 'actor-1',
            originType: 'internal',
            totalSek: SUMMARY.finalTotalSek,
            latestSaveIntentId: 'intent-1'
        });
        expect(revisionPaths(harness.firestore, 'actor-1', result.quote.quoteId)).toHaveLength(1);
    });

    it('persists a frozen commercial snapshot through the deep Quote Save seam', async () => {
        const originalCatalog = structuredClone(catalogData);
        const harness = createHarness({
            moduleOptions: {
                catalogData: originalCatalog,
                calculateTotals: (draft) => computeQuoteTotals({
                    state: draft,
                    catalogData: originalCatalog
                }),
                today: () => '2026-08-12'
            }
        });
        const initial = createInitialQuoteState();
        const state = quoteState({
            builderItems: [],
            selectedLines: ['ClickitUp'],
            exportLanguage: 'en',
            customerInfo: {
                ...initial.customerInfo,
                company: 'Family Restaurant AB',
                date: ''
            },
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Sektion|1000': { qty: 1, discountPct: 0 }
                    },
                    addons: {},
                    customAddonsByCategory: {},
                    customItems: []
                }
            }
        });

        const result = await harness.module.save({
            actor: ACTOR,
            state,
            target: { kind: 'new' }
        });
        const saved = await harness.repository.getQuoteLatestRevision({
            userId: ACTOR.uid,
            quoteId: result.quote.quoteId
        });

        expect(saved.revision.state.customerInfo.date).toBe('2026-08-12');
        expect(saved.revision.commercialSnapshot).toMatchObject({
            schemaVersion: 1,
            effectiveQuoteDate: '2026-08-12',
            productTotals: {
                finalTotalSek: 14158
            }
        });
        expect(saved.revision.commercialSnapshot.productRows).toEqual(expect.arrayContaining([
            expect.objectContaining({
                model: 'ClickitUp section',
                unitPrice: 11134,
                qty: 1
            })
        ]));
        expect(saved.revision.state).not.toHaveProperty('commercialSnapshot');
    });

    it('preserves Quote Owner and Quote Origin across revisions saved by another actor', async () => {
        const harness = createHarness();
        const first = await harness.module.save({
            actor: { uid: 'admin-1', email: 'admin@example.com' },
            canManageAllQuotes: true,
            retailer: {
                id: 'retailer-1',
                name: 'Nordvind',
                email: 'retailer@example.com',
                productLines: { BaHaMa: { enabled: true, discountPct: 10 } }
            },
            state: quoteState(),
            target: { kind: 'new', ownerUid: 'retailer-owner' }
        });
        expect(first.status).toBe('saved');

        const revised = await harness.module.save({
            actor: { uid: 'admin-2', email: 'other-admin@example.com' },
            canManageAllQuotes: true,
            state: quoteState({ activeQuoteId: first.quote.quoteId, activeQuoteVersion: 1 }),
            target: { kind: 'existing', quote: first.quote }
        });

        expect(revised.status).toBe('saved');
        expect(revised.statePatch.activeQuoteVersion).toBe(2);
        const quoteDoc = harness.firestore.__docs.get(
            `users/retailer-owner/quotes/${first.quote.quoteId}`
        );
        expect(quoteDoc).toMatchObject({ ownerUid: 'retailer-owner', originType: 'retailer' });
        expect(harness.firestore.__docs.has(`users/admin-2/quotes/${first.quote.quoteId}`)).toBe(false);
    });

    it('rejects disabled or multiple retailer product lines before persistence', async () => {
        const harness = createHarness();
        const retailer = {
            id: 'retailer-1',
            name: 'Nordvind',
            email: 'retailer@example.com',
            productLines: {
                BaHaMa: { enabled: true, discountPct: 10 },
                Fiesta: { enabled: false, discountPct: 0 }
            }
        };

        const multiple = await harness.module.save({
            actor: ACTOR,
            retailer,
            state: quoteState({ selectedLines: ['BaHaMa', 'Fiesta'] }),
            target: { kind: 'new' }
        });
        const disabled = await harness.module.save({
            actor: ACTOR,
            retailer,
            state: quoteState({
                selectedLines: ['Fiesta'],
                builderItems: [{
                    id: 'fiesta-1',
                    line: 'Fiesta',
                    model: 'FIESTA Biogasstolpe 12 kW',
                    size: 'Standard',
                    qty: 1,
                    discountPct: 0,
                    addons: []
                }]
            }),
            target: { kind: 'new' }
        });
        const otherLineCustom = await harness.module.save({
            actor: ACTOR,
            retailer,
            state: quoteState({
                selectedLines: ['BaHaMa'],
                builderItems: [],
                gridSelections: {
                    Fiesta: {
                        items: {},
                        addons: {},
                        customAddonsByCategory: {},
                        customItems: [{
                            id: 'custom-fiesta-1',
                            name: 'Disallowed custom product',
                            size: 'Special size',
                            price: 12000,
                            qty: 1,
                            discountPct: 0
                        }]
                    }
                }
            }),
            target: { kind: 'new' }
        });

        expect(multiple).toMatchObject({ status: 'not-saved', failure: { code: 'invalid-draft' } });
        expect(disabled).toMatchObject({ status: 'not-saved', failure: { code: 'invalid-draft' } });
        expect(otherLineCustom).toMatchObject({ status: 'not-saved', failure: { code: 'invalid-draft' } });
        expect([...harness.firestore.__docs.keys()].some((path) => path.startsWith('users/actor-1/quotes/'))).toBe(false);
    });

    it('canonicalizes retailer discounts and PDF theme at the persistence seam', async () => {
        const harness = createHarness();
        const result = await harness.module.save({
            actor: ACTOR,
            retailer: {
                id: 'retailer-1',
                name: 'Nordvind',
                email: 'retailer@example.com',
                productLines: { BaHaMa: { enabled: true, discountPct: 10 } },
                pdfThemes: ['custom']
            },
            state: quoteState({
                globalDiscountPct: 80,
                prevGlobalDiscountPct: 70,
                pdfThemeId: 'roslagsmarkisen',
                builderItems: [{
                    id: 'item-1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 1,
                    discountPct: 50,
                    addons: [{ id: 'addon-1', qty: 1, discountPct: 40 }]
                }],
                customCosts: [{ description: 'Frakt', price: 1000, qty: 1, discountPct: 30 }]
            }),
            target: { kind: 'new' }
        });

        expect(result.status).toBe('saved');
        const revisionPath = revisionPaths(harness.firestore, 'actor-1', result.quote.quoteId)[0];
        const persisted = harness.firestore.__docs.get(revisionPath).state;
        expect(persisted).toMatchObject({
            selectedLines: ['BaHaMa'],
            globalDiscountPct: 10,
            prevGlobalDiscountPct: 10,
            pdfThemeId: 'brixx'
        });
        expect(persisted.builderItems[0].discountPct).toBe(10);
        expect(persisted.builderItems[0].addons[0].discountPct).toBe(10);
        expect(persisted.customCosts[0].discountPct).toBe(10);
    });

    it('returns a typed authorization outcome for an owner mismatch', async () => {
        const harness = createHarness();
        const result = await harness.module.save({
            actor: ACTOR,
            state: quoteState({ activeQuoteId: 'quote-1' }),
            target: {
                kind: 'existing',
                quote: { ownerUid: 'another-owner', quoteId: 'quote-1' }
            }
        });

        expect(result).toMatchObject({
            status: 'not-saved',
            failure: { code: 'unauthorized', retryable: false }
        });
    });

    it('reuses only an ambiguous retry Save Intent and creates at most one revision', async () => {
        const firestore = createFirestoreMock();
        const repository = createQuoteRepository(firestore);
        let firstAttempt = true;
        const createQuote = vi.fn(async (input) => {
            const saved = await repository.createQuote(input);
            if (firstAttempt) {
                firstAttempt = false;
                throw Object.assign(new Error('Transport response was lost.'), {
                    code: 'unavailable',
                    ambiguous: true
                });
            }
            return saved;
        });
        const harness = createHarness({
            persistenceOverride: {
                ...repository,
                createQuote
            }
        });
        harness.module;

        const first = await harness.module.save({
            actor: ACTOR,
            state: quoteState(),
            target: { kind: 'new' }
        });
        expect(first).toMatchObject({
            status: 'not-saved',
            failure: { code: 'persistence-ambiguous' },
            retry: { saveIntentId: 'intent-1' }
        });

        const retried = await harness.module.save({
            actor: ACTOR,
            state: quoteState(),
            target: { kind: 'new' },
            retrySaveIntentId: first.retry.saveIntentId
        });

        expect(retried.status).toBe('saved');
        expect(retried.statePatch.activeQuoteVersion).toBe(1);
        expect(createQuote).toHaveBeenCalledTimes(2);
        expect(revisionPaths(firestore, 'actor-1', retried.quote.quoteId)).toHaveLength(1);
    });

    it('links CRM on first save, advances lead once, and preserves later stages', async () => {
        const harness = createHarness({ deals: { 'deal-1': { stage: 'lead' } } });
        const first = await harness.module.save({
            actor: ACTOR,
            state: quoteState(),
            target: { kind: 'new', crmDealId: 'deal-1' }
        });

        expect(first.status).toBe('saved');
        expect(harness.dealStore.get('deal-1')).toMatchObject({
            stage: 'quote',
            quoteOwnerUid: 'actor-1',
            quoteId: first.quote.quoteId,
            valueSek: SUMMARY.finalTotalSek
        });

        harness.dealStore.set('deal-1', { ...harness.dealStore.get('deal-1'), stage: 'won' });
        const revised = await harness.module.save({
            actor: ACTOR,
            state: quoteState({
                activeQuoteId: first.quote.quoteId,
                activeQuoteVersion: 1,
                quoteStatus: 'lost'
            }),
            target: { kind: 'existing', quote: first.quote, crmDealId: 'deal-1' }
        });

        expect(revised.status).toBe('saved');
        expect(harness.dealStore.get('deal-1').stage).toBe('won');
        expect(harness.dealStore.get('deal-1').quoteVersion).toBe(2);
    });

    it('persists a durable CRM issue and schedules bounded session repair after a transient failure', async () => {
        const harness = createHarness({ deals: { 'deal-1': {} } });
        harness.crm.linkDealToQuote.mockRejectedValueOnce(
            Object.assign(new Error('CRM offline.'), { code: 'unavailable' })
        );

        const result = await harness.module.save({
            actor: ACTOR,
            state: quoteState(),
            target: { kind: 'new', crmDealId: 'deal-1' }
        });

        expect(result).toMatchObject({
            status: 'saved-needs-crm-repair',
            crm: { dealId: 'deal-1', status: 'repair-pending' }
        });
        const quoteDoc = harness.firestore.__docs.get(
            `users/actor-1/quotes/${result.quote.quoteId}`
        );
        expect(quoteDoc.crmSynchronizationIssue).toMatchObject({
            code: 'unavailable',
            dealId: 'deal-1',
            attemptCount: 1,
            requiresRelink: false
        });
        expect(harness.scheduled).toHaveLength(1);
        expect(harness.scheduled[0].delayMs).toBeGreaterThanOrEqual(1499);
        expect(harness.scheduled[0].delayMs).toBeLessThanOrEqual(1500);
    });

    it('keeps conflicting links unchanged until repair receives an explicit relink decision', async () => {
        const harness = createHarness({
            initialDocs: {
                'users/old-owner/quotes/old-quote': { crmDealId: 'deal-1', status: 'draft' }
            },
            deals: {
                'deal-1': { quoteOwnerUid: 'old-owner', quoteId: 'old-quote', stage: 'quote' }
            }
        });

        const saved = await harness.module.save({
            actor: ACTOR,
            state: quoteState(),
            target: { kind: 'new', crmDealId: 'deal-1' }
        });
        expect(saved).toMatchObject({
            status: 'saved-needs-crm-repair',
            crm: { status: 'relink-required' }
        });
        expect(harness.dealStore.get('deal-1')).toMatchObject({
            quoteOwnerUid: 'old-owner',
            quoteId: 'old-quote'
        });
        expect(harness.scheduled).toHaveLength(0);

        const revisionCount = revisionPaths(harness.firestore, 'actor-1', saved.quote.quoteId).length;
        const pending = await harness.module.repairCrm({ actor: ACTOR, quote: saved.quote });
        expect(pending.status).toBe('needs-relink');
        expect(harness.crm.relinkDealToQuote).not.toHaveBeenCalled();

        const repaired = await harness.module.repairCrm({
            actor: ACTOR,
            quote: saved.quote,
            relink: true
        });
        expect(repaired.status).toBe('repaired');
        expect(harness.dealStore.get('deal-1')).toMatchObject({
            quoteOwnerUid: 'actor-1',
            quoteId: saved.quote.quoteId,
            stage: 'quote'
        });
        expect(harness.firestore.__docs.get('users/old-owner/quotes/old-quote').crmDealId).toBeNull();
        expect(revisionPaths(harness.firestore, 'actor-1', saved.quote.quoteId)).toHaveLength(revisionCount);
        expect(
            harness.firestore.__docs.get(`users/actor-1/quotes/${saved.quote.quoteId}`).crmSynchronizationIssue
        ).toBeNull();
    });

    it('records Deal B as the repair target when a Quote linked to Deal A requests relinking', async () => {
        const harness = createHarness({ deals: { 'deal-a': {}, 'deal-b': {} } });
        const created = await harness.module.save({
            actor: ACTOR,
            state: quoteState(),
            target: { kind: 'new', crmDealId: 'deal-a' }
        });

        const revised = await harness.module.save({
            actor: ACTOR,
            state: quoteState({ activeQuoteId: created.quote.quoteId, activeQuoteVersion: 1 }),
            target: { kind: 'existing', quote: created.quote, crmDealId: 'deal-b' }
        });

        expect(revised).toMatchObject({
            status: 'saved-needs-crm-repair',
            crm: { dealId: 'deal-b', status: 'relink-required' }
        });
        const metadata = harness.firestore.__docs.get(`users/actor-1/quotes/${created.quote.quoteId}`);
        expect(metadata.crmSynchronizationIssue).toMatchObject({
            dealId: 'deal-b',
            conflictingDealId: 'deal-a'
        });

        const repaired = await harness.module.repairCrm({
            actor: ACTOR,
            quote: created.quote,
            relink: true
        });
        expect(repaired).toMatchObject({ status: 'repaired', dealId: 'deal-b' });
        expect(harness.dealStore.get('deal-a').quoteId).toBeNull();
        expect(harness.dealStore.get('deal-b').quoteId).toBe(created.quote.quoteId);
    });

    it('preserves an unresolved relink request across normal Quote saves', async () => {
        const harness = createHarness({ deals: { 'deal-a': {}, 'deal-b': {} } });
        const created = await harness.module.save({
            actor: ACTOR,
            state: quoteState(),
            target: { kind: 'new', crmDealId: 'deal-a' }
        });
        const relinkRequested = await harness.module.save({
            actor: ACTOR,
            state: quoteState({ activeQuoteId: created.quote.quoteId, activeQuoteVersion: 1 }),
            target: { kind: 'existing', quote: created.quote, crmDealId: 'deal-b' }
        });

        expect(relinkRequested).toMatchObject({
            status: 'saved-needs-crm-repair',
            crm: { dealId: 'deal-b', status: 'relink-required' }
        });

        const savedAgain = await harness.module.save({
            actor: ACTOR,
            state: quoteState({ activeQuoteId: created.quote.quoteId, activeQuoteVersion: 2 }),
            target: { kind: 'existing', quote: created.quote, crmDealId: 'deal-a' }
        });

        expect(savedAgain).toMatchObject({
            status: 'saved-needs-crm-repair',
            crm: { dealId: 'deal-b', status: 'relink-required' }
        });
        expect(harness.crm.linkDealToQuote).toHaveBeenCalledTimes(1);
        expect(harness.firestore.__docs.get(
            `users/actor-1/quotes/${created.quote.quoteId}`
        ).crmSynchronizationIssue).toMatchObject({
            dealId: 'deal-b',
            conflictingDealId: 'deal-a',
            requiresRelink: true,
            saveIntentId: 'intent-3',
            quoteVersion: 3
        });
    });

    it('retains the transactionally persisted CRM issue when the post-attempt issue update fails', async () => {
        const updateIssue = vi.fn(async () => {
            throw Object.assign(new Error('Issue update unavailable.'), { code: 'unavailable' });
        });
        const harness = createHarness({
            deals: { 'deal-1': {} },
            persistenceOverride: { updateQuoteCrmSynchronizationIssue: updateIssue }
        });
        harness.crm.linkDealToQuote.mockRejectedValueOnce(
            Object.assign(new Error('CRM offline.'), { code: 'unavailable' })
        );
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await harness.module.save({
            actor: ACTOR,
            state: quoteState(),
            target: { kind: 'new', crmDealId: 'deal-1' }
        });

        expect(result.status).toBe('saved-needs-crm-repair');
        const metadata = harness.firestore.__docs.get(`users/actor-1/quotes/${result.quote.quoteId}`);
        expect(metadata.crmSynchronizationIssue).toMatchObject({
            code: 'pending',
            dealId: 'deal-1',
            saveIntentId: 'intent-1',
            revisionId: 'intent_intent-1',
            quoteVersion: 1
        });
        consoleSpy.mockRestore();
    });

    it('does not report CRM completion when clearing the durable pending issue fails', async () => {
        const updateIssue = vi.fn(async () => {
            throw Object.assign(new Error('Issue cleanup unavailable.'), { code: 'unavailable' });
        });
        const harness = createHarness({
            deals: { 'deal-1': {} },
            persistenceOverride: { updateQuoteCrmSynchronizationIssue: updateIssue }
        });
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await harness.module.save({
            actor: ACTOR,
            state: quoteState(),
            target: { kind: 'new', crmDealId: 'deal-1' }
        });

        expect(result).toMatchObject({
            status: 'saved-needs-crm-repair',
            crm: { dealId: 'deal-1', status: 'repair-pending' }
        });
        const metadata = harness.firestore.__docs.get(`users/actor-1/quotes/${result.quote.quoteId}`);
        expect(metadata.crmSynchronizationIssue).toMatchObject({ code: 'pending', dealId: 'deal-1' });
        expect(harness.scheduled).toHaveLength(1);
        consoleSpy.mockRestore();
    });

    it('does not report a stale CRM repair as successful when a newer issue wins the update race', async () => {
        const harness = createHarness({ deals: { 'deal-1': {} } });
        harness.crm.linkDealToQuote.mockRejectedValueOnce(
            Object.assign(new Error('CRM offline.'), { code: 'unavailable' })
        );
        const saved = await harness.module.save({
            actor: ACTOR,
            state: quoteState(),
            target: { kind: 'new', crmDealId: 'deal-1' }
        });
        const latest = await harness.repository.getQuoteLatestRevision({
            userId: saved.quote.ownerUid,
            quoteId: saved.quote.quoteId
        });
        const newerIssue = {
            ...latest.metadata.crmSynchronizationIssue,
            saveIntentId: 'intent-newer',
            revisionId: 'intent_intent-newer',
            quoteVersion: 2,
            attemptCount: 2
        };
        const staleUpdate = vi.fn(async () => ({
            applied: false,
            metadata: {
                ...latest.metadata,
                latestSaveIntentId: 'intent-newer',
                crmSynchronizationIssue: newerIssue
            }
        }));
        const reopenedModule = createQuoteSaveModule({
            quotePersistence: {
                ...harness.repository,
                updateQuoteCrmSynchronizationIssue: staleUpdate
            },
            crm: harness.crm,
            logActivity: harness.logActivity,
            calculateTotals: () => SUMMARY,
            schedule: vi.fn()
        });

        const repaired = await reopenedModule.repairCrm({ actor: ACTOR, quote: saved.quote });

        expect(staleUpdate).toHaveBeenCalledWith(expect.objectContaining({
            issue: null,
            expectedSaveIntentId: latest.metadata.crmSynchronizationIssue.saveIntentId
        }));
        expect(repaired).toMatchObject({
            status: 'repair-pending',
            quote: saved.quote,
            dealId: 'deal-1'
        });
    });

    it('repairs a durable issue after Quote reopen without creating a revision', async () => {
        const harness = createHarness({ deals: { 'deal-1': {} } });
        harness.crm.linkDealToQuote.mockRejectedValueOnce(
            Object.assign(new Error('CRM offline.'), { code: 'unavailable' })
        );
        const saved = await harness.module.save({
            actor: ACTOR,
            state: quoteState(),
            target: { kind: 'new', crmDealId: 'deal-1' }
        });
        const before = revisionPaths(harness.firestore, 'actor-1', saved.quote.quoteId).length;

        const reopenedModule = createQuoteSaveModule({
            quotePersistence: harness.repository,
            crm: harness.crm,
            logActivity: harness.logActivity,
            calculateTotals: () => SUMMARY,
            schedule: vi.fn()
        });
        const repaired = await reopenedModule.repairCrm({ actor: ACTOR, quote: saved.quote });

        expect(repaired.status).toBe('repaired');
        expect(revisionPaths(harness.firestore, 'actor-1', saved.quote.quoteId)).toHaveLength(before);
    });

    it('does not invalidate Quote Save or expose a warning outcome when Activity Log Entry creation fails', async () => {
        const harness = createHarness({ activityResult: new Error('Activity unavailable.') });
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const result = await harness.module.save({
            actor: ACTOR,
            state: quoteState(),
            target: { kind: 'new' }
        });

        expect(result.status).toBe('saved');
        expect(consoleSpy).toHaveBeenCalledWith('Quote Save activity logging failed:', expect.any(Error));
        consoleSpy.mockRestore();
    });

    it('returns a successful save without waiting indefinitely for Activity Log Entry creation', async () => {
        const harness = createHarness({
            activityResult: new Promise(() => {}),
            moduleOptions: { activityTimeoutMs: 5 }
        });
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await Promise.race([
            harness.module.save({ actor: ACTOR, state: quoteState(), target: { kind: 'new' } }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Save remained blocked.')), 100))
        ]);

        expect(result.status).toBe('saved');
        expect(consoleSpy).toHaveBeenCalledWith('Quote Save activity logging failed:', expect.any(Error));
        consoleSpy.mockRestore();
    });

    it('removes CRM, ownership, Save Intent, and internal-margin data from persisted revision state', async () => {
        const harness = createHarness();
        const state = quoteState();
        state.crmDealId = 'malicious-deal';
        state.quoteOwnerUid = 'malicious-owner';
        state.ownerRoutingData = { ownerUid: 'nested-owner' };
        state.internalMargins = { BaHaMa: 55 };
        state.customerInfo.crmRoutingMetadata = { dealId: 'hidden' };

        const result = await harness.module.save({
            actor: ACTOR,
            state,
            target: { kind: 'new' }
        });
        const revisionPath = revisionPaths(harness.firestore, 'actor-1', result.quote.quoteId)[0];
        const persistedState = harness.firestore.__docs.get(revisionPath).state;

        expect(persistedState).not.toHaveProperty('crmDealId');
        expect(persistedState).not.toHaveProperty('quoteOwnerUid');
        expect(persistedState).not.toHaveProperty('ownerRoutingData');
        expect(persistedState).not.toHaveProperty('internalMargins');
        expect(persistedState.customerInfo).not.toHaveProperty('crmRoutingMetadata');
    });

});
