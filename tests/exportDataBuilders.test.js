import { describe, expect, it } from 'vitest';
import { computeQuoteTotals } from '../src/services/calculationEngine';
import {
    buildExcelSheetData,
    buildExportSummary,
    buildPdfTableData,
    hasZeroDiscountSummary,
    shouldHideDiscountReferencesInPdf
} from '../src/services/exportDataBuilders';
import { createCatalogFixture, createStateFixture } from './fixtures/calculationFixtures';
import { catalogData } from '../src/data/catalog';

function formatSek(value) {
    return Math.round(value).toString();
}

describe('export data builders', () => {
    it('buildExportSummary is VAT-aware and consistent with totals', () => {
        const state = createStateFixture({ includesVat: true });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });
        const exportSummary = buildExportSummary(state, summary);

        expect(exportSummary.finalTotalSek).toBe(summary.finalTotalSek);
        expect(exportSummary.grossTotalSek).toBe(summary.grossTotalSek);
        expect(exportSummary.totalDiscountSek).toBe(summary.totalDiscountSek);
        expect(exportSummary.vatAmount).toBe(summary.finalTotalSek * 0.25);
        expect(exportSummary.totalWithVat).toBe(summary.finalTotalSek * 1.25);
    });

    it('buildPdfTableData reflects line totals from summary computation', () => {
        const state = createStateFixture();
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });
        const rows = buildPdfTableData(summary.totals, formatSek);

        expect(rows).toHaveLength(summary.totals.length);
        expect(rows[0]).toHaveLength(8);
        expect(rows[0][0]).toContain('BaHaMa');
        expect(rows[0][4]).toContain(formatSek(summary.totals[0].net));
        expect(rows.some((row) => String(row[0]).includes('Overgripande Rabatt'))).toBe(false);
    });

    it('buildPdfTableData can omit discount and recommended-price columns for zero-discount PDF exports', () => {
        const state = createStateFixture({
            builderItems: [
                {
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '3x3 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: []
                }
            ],
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Section|1000': { qty: 1, discountPct: 0 }
                    },
                    addons: {
                        'door-right': { qty: 1, discountPct: 0 }
                    }
                }
            },
            globalDiscountPct: 0
        });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        const rows = buildPdfTableData(summary.totals, formatSek, {
            hideDiscountColumns: true,
            hideRecommendedPriceColumn: true
        });

        expect(rows).toHaveLength(summary.totals.length);
        expect(rows[0]).toHaveLength(5);
        expect(rows[0][4]).toContain(formatSek(summary.totals[0].net));
    });

    it('buildExcelSheetData totals row is aligned with computed summary', () => {
        const state = createStateFixture({ includesVat: false });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        const wsData = buildExcelSheetData(state, summary);
        const totalsRow = wsData.find((row) => row[0] === 'Totalt Exkl. Moms');
        const customerLabels = wsData.slice(0, 6).map((row) => row[0]);
        const serializedSheet = JSON.stringify(wsData);

        expect(totalsRow).toBeTruthy();
        expect(customerLabels).toContain('Foretag');
        expect(customerLabels).toContain('Projektreferens');
        expect(customerLabels).toContain('Er referens');
        expect(customerLabels).not.toContain('Kund');
        expect(serializedSheet).not.toMatch(/Marginal|Bruttovinst|Kostnad/i);
        expect(totalsRow[4]).toBe(Math.round(summary.finalTotalSek));
        expect(totalsRow[5]).toBe(Math.round(summary.grossTotalSek));
        expect(totalsRow[6]).toBe(Math.round(-summary.totalDiscountSek));
    });

    it('includes custom builder add-ons in export rows', () => {
        const state = createStateFixture({
            builderItems: [
                {
                    id: 'builder_1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '3x3 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: [
                        {
                            id: 'custom_1',
                            qty: 2,
                            discountPct: 10,
                            isCustom: true,
                            name: 'Speciallack',
                            price: 500,
                            categoryId: 'installation'
                        }
                    ]
                }
            ],
            gridSelections: {},
            customCosts: []
        });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        const wsData = buildExcelSheetData(state, summary);
        const pdfRows = buildPdfTableData(summary.totals, formatSek);
        const serializedPdfRows = JSON.stringify(pdfRows);

        expect(wsData.some((row) => row[0] === 'Tillval: Speciallack')).toBe(true);
        expect(pdfRows.some((row) => row[0] === 'Tillval: Speciallack')).toBe(true);
        expect(serializedPdfRows).not.toMatch(/Marginal|Bruttovinst|Kostnad/i);
    });

    it('uses renamed builder rows and preserved block order in export rows', () => {
        const state = createStateFixture({
            gridSelections: {},
            customCosts: [],
            builderItems: [
                {
                    id: 'builder_1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    displayName: 'Produkt B',
                    addons: [{ id: 'heater', qty: 1, discountPct: 0, displayName: 'Tillval B1' }]
                },
                {
                    id: 'builder_2',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '3x3 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    displayName: 'Produkt A',
                    addons: [{ id: 'gutter-kit', qty: 1, discountPct: 0, displayName: 'Tillval A1' }]
                }
            ]
        });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        const wsData = buildExcelSheetData(state, summary);
        const pdfRows = buildPdfTableData(summary.totals, formatSek);
        const exportLabels = wsData.filter((row) => typeof row[0] === 'string').map((row) => row[0]);

        expect(pdfRows.map((row) => row[0])).toEqual([
            'Produkt B',
            'Tillval B1',
            'Produkt A',
            'Tillval A1'
        ]);
        expect(exportLabels).toEqual(expect.arrayContaining(['Produkt B', 'Tillval B1', 'Produkt A', 'Tillval A1']));
    });

    it('keeps backward compatibility when global discount amount is present', () => {
        const state = createStateFixture({
            includesVat: false,
            globalDiscountPct: 10
        });
        const summary = {
            ...computeQuoteTotals({
                state,
                catalogData: createCatalogFixture()
            }),
            globalDiscountAmt: 2500
        };

        const wsData = buildExcelSheetData(state, summary);
        const pdfRows = buildPdfTableData(summary.totals, formatSek);


        expect(wsData.some((row) => String(row[0]).includes('Overgripande Rabatt'))).toBe(true);
        expect(pdfRows.some((row) => String(row[0]).includes('Overgripande Rabatt'))).toBe(false);
        expect(pdfRows).toHaveLength(summary.totals.length);
    });

    it('detects when a quote is eligible to hide discount references in the PDF', () => {
        const zeroDiscountState = createStateFixture({
            builderItems: [
                {
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: [{ id: 'heater', qty: 1, discountPct: 0 }]
                }
            ],
            gridSelections: {
                ClickitUp: {
                    items: {
                        'ClickitUp Section|1000': { qty: 1, discountPct: 0 }
                    },
                    addons: {
                        'door-right': { qty: 1, discountPct: 0 }
                    }
                }
            },
            globalDiscountPct: 0
        });
        const zeroDiscountSummary = computeQuoteTotals({
            state: zeroDiscountState,
            catalogData: createCatalogFixture()
        });
        const discountedSummary = computeQuoteTotals({
            state: createStateFixture(),
            catalogData: createCatalogFixture()
        });

        expect(hasZeroDiscountSummary(zeroDiscountSummary)).toBe(true);
        expect(shouldHideDiscountReferencesInPdf({
            hideZeroDiscountReferencesInPdf: true
        }, zeroDiscountSummary)).toBe(true);
        expect(hasZeroDiscountSummary(discountedSummary)).toBe(false);
        expect(shouldHideDiscountReferencesInPdf({
            hideZeroDiscountReferencesInPdf: true
        }, discountedSummary)).toBe(false);
    });

    it('formats priceUponRequest rows and appends footnote at the bottom of the Excel sheet', () => {
        const state = createStateFixture();
        const summary = {
            totals: [
                {
                    model: 'Jumbrella outSide Heater',
                    size: '4 Spokes',
                    unitPrice: 0,
                    qty: 1,
                    gross: 0,
                    net: 0,
                    discountSek: 0,
                    discountPct: 0,
                    priceUponRequest: true
                }
            ],
            finalTotalSek: 0,
            grossTotalSek: 0,
            totalDiscountSek: 0
        };

        const pdfRows = buildPdfTableData(summary.totals, formatSek);
        expect(pdfRows).toHaveLength(1);
        expect(pdfRows[0][2]).toBe('Pris på förfrågan');
        expect(pdfRows[0][4]).toBe('Pris på förfrågan');
        expect(pdfRows[0][5]).toBe('Pris på förfrågan'); // gross column
        expect(pdfRows[0][6]).toBe('-'); // discount SEK column
        expect(pdfRows[0][7]).toBe('-'); // discount pct column

        const wsData = buildExcelSheetData(state, summary);
        expect(wsData.length).toBeGreaterThan(10);
        
        // Assert product row formats correctly
        const productRow = wsData.find((row) => row[0] === 'Jumbrella outSide Heater');
        expect(productRow).toBeTruthy();
        expect(productRow[2]).toBe('Pris på förfrågan');
        expect(productRow[4]).toBe('Pris på förfrågan');
        expect(productRow[5]).toBe('Pris på förfrågan');
        expect(productRow[6]).toBe('-');
        expect(productRow[7]).toBe('-');

        // Assert footnote is at the absolute bottom
        const lastRow = wsData[wsData.length - 1];
        expect(lastRow[0]).toBe('* Totalsumman exkluderar artiklar med pris på förfrågan');
    });

    it('localizes Excel and PDF export labels for English output', () => {
        const state = createStateFixture({
            exportLanguage: 'en',
            includesVat: false,
            globalDiscountPct: 10
        });
        const summary = {
            totals: [
                {
                    model: 'Tillval: Speciallack',
                    size: '-',
                    unitPrice: 0,
                    qty: 1,
                    gross: 0,
                    net: 0,
                    discountSek: 0,
                    discountPct: 0,
                    priceUponRequest: true
                },
                {
                    model: 'Övrigt: Extra goodwill-rabatt',
                    size: '-',
                    unitPrice: -100,
                    qty: 1,
                    gross: -100,
                    net: -100,
                    discountSek: 0,
                    discountPct: 0
                }
            ],
            finalTotalSek: -100,
            grossTotalSek: -100,
            totalDiscountSek: 0,
            globalDiscountAmt: 25
        };

        const wsData = buildExcelSheetData(state, summary);
        expect(wsData[0][0]).toBe('Quote');
        expect(wsData[1][0]).toBe('Company');
        expect(wsData[5]).toEqual(['Validity period', '30 days']);
        expect(wsData[7]).toEqual([
            'Model',
            'Size',
            'Unit price (Excl. VAT)',
            'Qty',
            'Your Price',
            'Recommended Price',
            'Discount in SEK',
            'Discount in %'
        ]);
        expect(wsData.find((row) => row[0] === 'Add-on: Speciallack')[2]).toBe('Price on request');
        expect(wsData.find((row) => row[0] === 'Other: Extra goodwill-rabatt')).toBeTruthy();
        expect(wsData.some((row) => row[0] === 'Overall Discount (10%)')).toBe(true);
        expect(wsData[wsData.length - 1][0]).toBe('* The total excludes items with price on request');

        const pdfRows = buildPdfTableData(summary.totals, formatSek, { exportLanguage: 'en' });
        expect(pdfRows[0][0]).toBe('Add-on: Speciallack');
        expect(pdfRows[0][2]).toBe('Price on request');
        expect(pdfRows[1][0]).toBe('Other: Extra goodwill-rabatt');
    });

    it('uses source-based ClickitUp Fixed names in both Excel and PDF rows', () => {
        const state = createStateFixture({
            exportLanguage: 'en',
            builderItems: [],
            customCosts: [],
            selectedLines: ['ClickitUpFixed'],
            gridSelections: {
                ClickitUpFixed: {
                    items: {
                        'ClickitUp Sektion|1000': { qty: 1, discountPct: 0 }
                    },
                    addons: {
                        frakt_glas: { qty: 1, discountPct: 0 }
                    },
                    customAddonsByCategory: {}
                }
            }
        });
        const summary = computeQuoteTotals({ state, catalogData });

        const excelRows = buildExcelSheetData(state, summary);
        const pdfRows = buildPdfTableData(summary.totals, formatSek, { exportLanguage: 'en' });

        expect(excelRows.some((row) => row[0] === 'CiUFixed section')).toBe(true);
        expect(excelRows.some((row) => row[0] === 'Add-on: Glass freight – special pallet')).toBe(true);
        expect(pdfRows.map((row) => row[0])).toEqual(expect.arrayContaining([
            'CiUFixed section',
            'Add-on: Glass freight – special pallet'
        ]));
    });

    it('builds an English contracting-only Excel block without product headers or VAT', () => {
        const state = createStateFixture({
            exportLanguage: 'en',
            includesVat: true,
            builderItems: [],
            gridSelections: {},
            customCosts: [],
            contractingWork: {
                enabled: true,
                projectName: 'Designer Village, Löddeköpinge',
                rows: [
                    {
                        id: 'groundworks',
                        workPackage: 'Groundworks and foundations',
                        scope: 'Excavation and casting according to the supplied documentation.',
                        unit: 'consolidated work package',
                        priceExVatSek: 101600
                    },
                    {
                        id: 'installation',
                        workPackage: 'Installation',
                        scope: 'Delivery and installation.',
                        unit: 'consolidated work package',
                        priceExVatSek: 469600
                    }
                ],
                margin: { enabled: true, percent: 15 },
                ata: { enabled: true, percent: 15 }
            }
        });
        const summary = computeQuoteTotals({ state, catalogData: createCatalogFixture() });

        const rows = buildExcelSheetData(state, summary);

        expect(rows.some((row) => row[0] === 'Model')).toBe(false);
        expect(rows.some((row) => row[0] === 'Total Incl. VAT')).toBe(false);
        expect(rows).toContainEqual([
            'Contracting works - consolidated overview for Designer Village, Löddeköpinge'
        ]);
        expect(rows).toContainEqual([
            'Work package',
            'Consolidated scope for the entire area',
            'Unit',
            'Your price excl. VAT'
        ]);
        expect(rows).toContainEqual([
            'Groundworks and foundations',
            'Excavation and casting according to the supplied documentation.',
            'consolidated work package',
            116840
        ]);
        expect(rows).toContainEqual([
            'Installation',
            'Delivery and installation.',
            'consolidated work package',
            540040
        ]);
        expect(rows).toContainEqual(['Base contract value for the entire area (excl. VAT)', '', '', 656880]);
        expect(rows).toContainEqual(['Variation work allowance (±15%)', '', '', 98532]);
        expect(rows).toContainEqual(['Lower indicative amount excl. VAT (-15%)', '', '', 558348]);
        expect(rows).toContainEqual(['Upper indicative amount excl. VAT (+15%)', '', '', 755412]);
        expect(rows.flat()).not.toEqual(expect.arrayContaining([101600, 469600]));
        expect(rows.flat().map(String).join(' ')).not.toMatch(/marginal|margin|markup/i);
    });

    it('keeps product and contracting totals commercially separate in mixed Excel output', () => {
        const state = createStateFixture({
            includesVat: false,
            contractingWork: {
                enabled: true,
                projectName: '',
                rows: [{
                    id: 'work-1',
                    workPackage: 'Markarbete',
                    scope: 'Schakt och gjutning',
                    unit: 'arbete',
                    priceExVatSek: 586180
                }],
                margin: { enabled: true, percent: 15 },
                ata: { enabled: true, percent: 15 }
            }
        });
        const summary = computeQuoteTotals({ state, catalogData: createCatalogFixture() });

        const rows = buildExcelSheetData(state, summary);

        expect(rows.some((row) => row[0] === 'Produkttotal exkl. moms' && row[4] === Math.round(summary.finalTotalSek))).toBe(true);
        expect(rows).toContainEqual(['Entreprenadarbeten - sammanställd översikt']);
        expect(rows).toContainEqual(['Grundkontraktsvärde för hela området (exkl. moms)', '', '', 674107]);
        expect(rows).toContainEqual(['ÄTA-reserv (±15%)', '', '', 101116]);
        expect(rows).toContainEqual(['Lägre indikativt belopp exkl. moms (-15%)', '', '', 572991]);
        expect(rows).toContainEqual(['Övre indikativt belopp exkl. moms (+15%)', '', '', 775223]);
        expect(rows.flat()).not.toContain(586180);
        expect(rows.flat().map(String).join(' ')).not.toMatch(/marginal|margin|markup/i);
        expect(summary.finalTotalSek).not.toBe(674107);
    });
});
