import { describe, expect, it } from 'vitest';

import { catalogData } from '../src/data/catalog';
import { computeQuoteTotals } from '../src/services/calculationEngine';
import { buildPreparedExcelSheetData } from '../src/services/exportDataBuilders';
import {
    createQuoteCommercialSnapshot,
    prepareQuote,
    restorePreparedQuote
} from '../src/services/quotePreparation';
import { normalizeQuoteCommercialSnapshot } from '../src/services/quoteCommercialSnapshot';
import { createInitialQuoteState } from '../src/store/quoteStateSchema';

function createCatalogBackedState() {
    const initial = createInitialQuoteState();
    return {
        ...initial,
        selectedLines: ['ClickitUp'],
        exportLanguage: 'en',
        customerInfo: {
            ...initial.customerInfo,
            company: 'Family Restaurant AB',
            date: '2026-08-12'
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

describe('Quote commercial snapshot', () => {
    it('restores frozen catalog-backed names and prices without consulting a changed catalog', () => {
        const state = createCatalogBackedState();
        const originalCatalog = structuredClone(catalogData);
        const originalTotals = computeQuoteTotals({ state, catalogData: originalCatalog });
        const preparedAtSave = prepareQuote({
            state,
            totals: originalTotals,
            catalogData: originalCatalog,
            audience: { isRetailer: false }
        });
        const snapshot = createQuoteCommercialSnapshot(preparedAtSave);

        const changedCatalog = structuredClone(catalogData);
        const changedDefinition = changedCatalog.ClickitUp.gridItems.find(
            (item) => item.model === 'ClickitUp Sektion'
        );
        changedDefinition.exportNameEn = 'Renamed current section';
        changedDefinition.sizes.find((size) => size.size === '1000').price = 21134;
        const changedTotals = computeQuoteTotals({ state, catalogData: changedCatalog });

        expect(changedTotals.totals[0]).toMatchObject({ unitPrice: 21134 });
        expect(preparedAtSave.commercial.productRows[0]).toMatchObject({
            model: 'ClickitUp section',
            unitPrice: 11134
        });

        const restored = restorePreparedQuote({
            state: preparedAtSave.persistenceSnapshot,
            commercialSnapshot: snapshot,
            quoteIdentity: {
                quoteId: 'quote-1',
                quoteNumber: 'BRIXX - 260812-001',
                version: 2,
                status: 'draft'
            }
        });
        const excelRows = buildPreparedExcelSheetData(restored);

        expect(restored.commercial.productRows[0]).toMatchObject({
            model: 'ClickitUp section',
            unitPrice: 11134
        });
        expect(excelRows).toContainEqual([
            'ClickitUp section', '1000', 11134, 1, 11134, 11134, 0, '0%'
        ]);
        expect(JSON.stringify(snapshot)).not.toContain('source');
        expect(JSON.stringify(snapshot)).not.toContain('sortModel');
    });

    it('normalizes a saved retailer theme against the current retailer allowance', () => {
        const state = {
            ...createCatalogBackedState(),
            pdfThemeId: 'custom'
        };
        const totals = computeQuoteTotals({ state, catalogData });
        const prepared = prepareQuote({
            state,
            totals,
            catalogData,
            audience: { isRetailer: true, allowedPdfThemes: ['custom'] }
        });
        const snapshot = createQuoteCommercialSnapshot(prepared);

        const restored = restorePreparedQuote({
            state: prepared.persistenceSnapshot,
            commercialSnapshot: snapshot,
            audience: { isRetailer: true, allowedPdfThemes: [] }
        });

        expect(snapshot.presentation.allowedPdfThemeIds).toEqual(['brixx', 'custom']);
        expect(restored.presentation).toMatchObject({
            pdfThemeId: 'brixx',
            allowedPdfThemeIds: ['brixx']
        });
    });

    it('rejects snapshots whose row or aggregate arithmetic is inconsistent', () => {
        const state = createCatalogBackedState();
        const totals = computeQuoteTotals({ state, catalogData });
        const snapshot = createQuoteCommercialSnapshot(prepareQuote({
            state,
            totals,
            catalogData,
            audience: { isRetailer: false }
        }));

        const badRow = structuredClone(snapshot);
        badRow.productRows[0].net += 50;
        const badTotal = structuredClone(snapshot);
        badTotal.productTotals.finalTotalSek += 50;
        const privateRow = structuredClone(snapshot);
        privateRow.productRows[0].costPrice = 999999;
        const privateContractingRow = structuredClone(snapshot);
        privateContractingRow.contractingWork = {
            projectName: 'Terrace',
            rows: [{
                id: 'work-1',
                workPackage: 'Installation',
                scope: 'Everything',
                unit: 'project',
                priceExVatSek: 1000,
                marginAnalysis: { profit: 999999 }
            }],
            baseTotalSek: 1000,
            ataEnabled: false,
            ataPercent: 15,
            allowanceSek: 0,
            lowerIndicativeSek: 1000,
            upperIndicativeSek: 1000
        };
        privateContractingRow.visibility.contractingWork = 'visible';

        expect(normalizeQuoteCommercialSnapshot(badRow)).toBeNull();
        expect(normalizeQuoteCommercialSnapshot(badTotal)).toBeNull();
        expect(normalizeQuoteCommercialSnapshot(privateRow)).toBeNull();
        expect(normalizeQuoteCommercialSnapshot(privateContractingRow)).toBeNull();
    });
});
