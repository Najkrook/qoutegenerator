import { describe, expect, it, vi } from 'vitest';

const pdfAdapter = vi.hoisted(() => ({
    generatePDF: vi.fn(() => new Blob(['pdf']))
}));

vi.mock('../src/features/pdfExport', () => ({
    generatePDF: pdfAdapter.generatePDF
}));

vi.mock('../src/services/activityLogService', () => ({
    safeLogActivity: vi.fn(async () => ({ ok: true }))
}));

import { catalogData } from '../src/data/catalog';
import { computeQuoteTotals } from '../src/services/calculationEngine';
import { buildPreparedExcelSheetData } from '../src/services/exportDataBuilders';
import { createOrderRequestService } from '../src/services/orderRequestService';
import { createQuotePdfBlob } from '../src/services/quotePdfService';
import { restorePreparedQuote } from '../src/services/quotePreparation';
import { createQuoteRepository } from '../src/services/quoteRepository';
import { createQuoteSaveModule } from '../src/services/quoteSaveService';
import { createInitialQuoteState, hydrateQuoteState } from '../src/store/quoteStateSchema';
import { buildHistoryOpenQuotePayload } from '../src/views/historyPayload';
import { createFirestoreMock } from './fixtures/firestoreMock';

const USER = { uid: 'retailer-user', email: 'retailer@example.com' };
const RETAILER = {
    id: 'retailer-1',
    name: 'Nordvind',
    email: 'retailer@example.com',
    pdfThemes: [],
    productLines: { ClickitUp: { enabled: true, discountPct: 20 } }
};

function createCatalogBackedState() {
    const initial = createInitialQuoteState();
    return {
        ...initial,
        selectedLines: ['ClickitUp'],
        exportLanguage: 'en',
        customerInfo: {
            ...initial.customerInfo,
            company: 'Family Restaurant AB',
            reference: 'PATIO-1',
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
    };
}

function createSaveHarness(sourceCatalog) {
    const firestore = createFirestoreMock();
    const repository = createQuoteRepository(firestore);
    const quoteSave = createQuoteSaveModule({
        quotePersistence: repository,
        catalogData: sourceCatalog,
        crm: {
            getDeal: vi.fn(async () => null),
            linkDealToQuote: vi.fn(),
            relinkDealToQuote: vi.fn()
        },
        logActivity: vi.fn(async () => ({ ok: true })),
        today: () => '2026-08-12',
        createSaveIntentId: () => 'round-trip-save'
    });

    return { firestore, repository, quoteSave };
}

describe('saved Quote commercial round trip', () => {
    it('keeps a catalog-backed revision unchanged after the current catalog price and name change', async () => {
        const originalCatalog = structuredClone(catalogData);
        const draft = createCatalogBackedState();
        const harness = createSaveHarness(originalCatalog);

        const outcome = await harness.quoteSave.save({
            actor: USER,
            retailer: RETAILER,
            state: draft,
            target: { kind: 'new' }
        });
        expect(outcome.status).toBe('saved');

        const loaded = await harness.repository.getQuoteLatestRevision({
            userId: USER.uid,
            quoteId: outcome.quote.quoteId
        });
        expect(loaded?.revision?.commercialSnapshot).toBeTruthy();
        expect(loaded.revision.state.customerInfo.date).toBe('2026-08-12');

        const changedCatalog = structuredClone(catalogData);
        const changedDefinition = changedCatalog.ClickitUp.gridItems.find(
            (item) => item.model === 'ClickitUp Sektion'
        );
        changedDefinition.exportNameEn = 'Renamed current section';
        changedDefinition.sizes.find((size) => size.size === '1000').price = 21134;
        const changedTotals = computeQuoteTotals({ state: draft, catalogData: changedCatalog });
        expect(changedTotals.totals[0]).toMatchObject({ unitPrice: 21134 });

        const reopened = hydrateQuoteState(buildHistoryOpenQuotePayload(
            loaded.revision.state,
            outcome.quote.quoteId,
            loaded.metadata.quoteNumber,
            loaded.revision.version,
            loaded.metadata.status
        ));
        const restored = restorePreparedQuote({
            state: reopened,
            commercialSnapshot: loaded.revision.commercialSnapshot,
            quoteIdentity: {
                quoteId: outcome.quote.quoteId,
                quoteNumber: loaded.metadata.quoteNumber,
                version: loaded.revision.version,
                status: loaded.metadata.status
            }
        });
        const frozenRow = restored.commercial.productRows.find((row) => row.size === '1000');
        expect(frozenRow).toMatchObject({ model: 'ClickitUp section', unitPrice: 11134 });

        const orderService = createOrderRequestService({
            ...harness.firestore,
            quoteRepository: harness.repository
        });
        const orderRequest = await orderService.createOrderRequest({
            user: USER,
            retailer: RETAILER,
            quoteId: outcome.quote.quoteId,
            quoteVersion: loaded.revision.version
        });
        expect(orderRequest.totalSek).toBe(restored.commercial.productTotals.finalTotalSek);
        expect(orderRequest.totalSek).not.toBe(changedTotals.finalTotalSek);

        const excelRows = buildPreparedExcelSheetData(restored);
        expect(excelRows).toContainEqual([
            'ClickitUp section', '1000', 11134, 1, 11134, 11134, 0, '0%'
        ]);

        await createQuotePdfBlob(restored);
        const [pdfState, pdfSummary] = pdfAdapter.generatePDF.mock.calls.at(-1);
        expect(pdfState.customerInfo.date).toBe('2026-08-12');
        expect(pdfSummary.totals).toEqual(expect.arrayContaining([
            expect.objectContaining({ model: 'ClickitUp section', unitPrice: 11134 })
        ]));
    });

    it('keeps legacy revisions reopenable but requires one new save before retailer submission', async () => {
        const legacyState = createCatalogBackedState();
        const firestore = createFirestoreMock({
            'users/retailer-user/quotes/legacy-quote': {
                quoteNumber: 'BRIXX - 250101-101',
                latestVersion: 1,
                latestRevisionId: 'legacy-revision',
                status: 'draft'
            },
            'users/retailer-user/quotes/legacy-quote/revisions/legacy-revision': {
                quoteId: 'legacy-quote',
                version: 1,
                savedAtMs: 1,
                savedBy: USER.email,
                savedByUid: USER.uid,
                state: legacyState,
                summary: { finalTotalSek: 11134, grossTotalSek: 11134, totalDiscountSek: 0 },
                changeNote: ''
            }
        });
        const repository = createQuoteRepository(firestore);
        const loaded = await repository.getQuoteLatestRevision({
            userId: USER.uid,
            quoteId: 'legacy-quote'
        });
        const reopened = hydrateQuoteState(buildHistoryOpenQuotePayload(
            loaded.revision.state,
            'legacy-quote',
            loaded.metadata.quoteNumber,
            1,
            'draft'
        ));
        expect(reopened.activeQuoteId).toBe('legacy-quote');

        const orderService = createOrderRequestService({ ...firestore, quoteRepository: repository });
        await expect(orderService.createOrderRequest({
            user: USER,
            retailer: RETAILER,
            quoteId: 'legacy-quote',
            quoteVersion: 1
        })).rejects.toMatchObject({
            name: 'QuotePreparationError',
            field: 'commercialSnapshot'
        });
    });
});
