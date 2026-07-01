import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfMockState = vi.hoisted(() => ({
    textCalls: [],
    autoTableCalls: [],
    addPageCalls: [],
    roundedRectCalls: [],
    currentAutoTableFinalY: null
}));

vi.mock('jspdf', () => {
    class MockJsPdf {
        constructor() {
            this.pageCount = 1;
            this.currentPage = 1;
            this.lastAutoTable = null;
            this.internal = {
                pageSize: {
                    width: 210,
                    height: 297
                },
                getNumberOfPages: () => this.pageCount
            };
        }

        addImage() {}
        setFont() {}
        setFontSize() {}
        setTextColor() {}
        text(value) {
            pdfMockState.textCalls.push({
                page: this.currentPage,
                value: String(value)
            });
        }
        setDrawColor() {}
        setLineWidth() {}
        line() {}
        setFillColor() {}
        roundedRect(x, y, width, height) {
            pdfMockState.roundedRectCalls.push({
                page: this.currentPage,
                x,
                y,
                width,
                height
            });
        }
        rect() {}
        addPage() {
            this.pageCount += 1;
            this.currentPage = this.pageCount;
            pdfMockState.addPageCalls.push({ page: this.currentPage });
            this.lastAutoTable = { finalY: 40 };
        }
        splitTextToSize(value) {
            return [String(value)];
        }
        output(kind) {
            return kind === 'blob' ? new Blob(['pdf']) : 'pdf';
        }
        setPage(page) {
            this.currentPage = page;
        }
    }

    return { jsPDF: MockJsPdf };
});

vi.mock('jspdf-autotable', () => ({
    default: (doc, options) => {
        pdfMockState.autoTableCalls.push(options);
        doc.lastAutoTable = {
            finalY: pdfMockState.currentAutoTableFinalY ?? ((options.startY || 0) + 24)
        };
    }
}));

import { computeQuoteTotals } from '../src/services/calculationEngine';
import {
    computeValidUntilDateString,
    createPdfTableLayout,
    generatePDF,
    groupSummaryTotalsByLine
} from '../src/features/pdfExport';
import { createCatalogFixture, createStateFixture } from './fixtures/calculationFixtures';

function createZeroDiscountState(overrides = {}) {
    return createStateFixture({
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
        globalDiscountPct: 0,
        includesVat: false,
        includeTerms: false,
        includePaymentBox: false,
        includeSignatureBlock: false,
        ...overrides
    });
}

describe('pdfExport helpers', () => {
    beforeEach(() => {
        pdfMockState.textCalls.length = 0;
        pdfMockState.autoTableCalls.length = 0;
        pdfMockState.addPageCalls.length = 0;
        pdfMockState.roundedRectCalls.length = 0;
        pdfMockState.currentAutoTableFinalY = null;
    });

    it('computes valid-until date from quote date and validity days', () => {
        const validUntil = computeValidUntilDateString('2026-03-01', 14, new Date('2026-01-01T00:00:00'));
        expect(validUntil).toBe('2026-03-15');
    });

    it('falls back to current date when quote date is missing', () => {
        const validUntil = computeValidUntilDateString('', 10, new Date('2026-03-02T00:00:00'));
        expect(validUntil).toBe('2026-03-12');
    });

    it('groups and orders product lines predictably for the PDF', () => {
        const { groupKeys, groupedTotals } = groupSummaryTotalsByLine({
            totals: [
                { line: 'Övrigt', model: 'Custom' },
                { line: 'BaHaMa', model: 'Jumbrella' },
                { line: 'ClickitUp', model: 'Section' },
                { line: 'Fiesta', model: 'Heater' }
            ]
        });

        expect(groupKeys).toEqual(['ClickitUp', 'BaHaMa', 'Fiesta', 'Övrigt']);
        expect(groupedTotals.BaHaMa).toHaveLength(1);
    });

    it('builds the centered reduced table layout when discount references are hidden', () => {
        const layout = createPdfTableLayout(true, 210);

        expect(layout.tableHead[0]).toEqual([
            'Modell',
            'Storlek',
            'Pris/enhet\nExkl. moms',
            'Antal',
            'Ert Pris\nExkl. moms'
        ]);
        expect(layout.reducedTableWidth).toBeGreaterThan(100);
        expect(layout.tableLeftMargin).toBe(layout.tableRightMargin);
    });

    it('omits discount and recommended-price columns, and centers the table, when zero-discount hide mode is enabled', () => {
        const state = createZeroDiscountState({
            hideZeroDiscountReferencesInPdf: true
        });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        const pdfBlob = generatePDF(state, summary, true);

        expect(pdfBlob).toBeInstanceOf(Blob);
        expect(pdfMockState.autoTableCalls[0].head[0]).toEqual([
            'Modell',
            'Storlek',
            'Pris/enhet\nExkl. moms',
            'Antal',
            'Ert Pris\nExkl. moms'
        ]);
        expect(pdfMockState.autoTableCalls[0].body[0]).toHaveLength(5);
        expect(pdfMockState.autoTableCalls[0].margin.left).toBeGreaterThan(10);
        expect(pdfMockState.autoTableCalls[0].margin.left).toBe(pdfMockState.autoTableCalls[0].margin.right);
        expect(pdfMockState.textCalls.map((call) => call.value)).toContain('Totalt Rek Utpris:');
        expect(pdfMockState.textCalls.map((call) => call.value)).toContain('Totalt Exkl. moms:');
        expect(pdfMockState.textCalls.map((call) => call.value)).not.toContain('Total Rabatt:');
    });

    it('writes project reference and customer reference on separate rows in the PDF header', () => {
        const state = createZeroDiscountState({
            quoteNumber: 'BRIXX - 260422-103',
            customerInfo: {
                name: '',
                company: 'Two Forks',
                reference: 'PROJ-1',
                customerReference: 'ER-900',
                date: '2026-03-19',
                validity: '30 dagar'
            }
        });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        const pdfBlob = generatePDF(state, summary, true);
        const textValues = pdfMockState.textCalls.map((call) => call.value);

        expect(pdfBlob).toBeInstanceOf(Blob);
        expect(textValues).toContain('OffertNr: BRIXX - 260422-103');
        expect(textValues).toContain('Projektreferens: PROJ-1');
        expect(textValues).toContain('Er referens: ER-900');
    });

    it('renders English labels in the generated PDF when exportLanguage is en', () => {
        const state = createZeroDiscountState({
            exportLanguage: 'en',
            quoteNumber: 'BRIXX - 260422-103',
            includeTerms: true,
            includePaymentBox: true,
            includeSignatureBlock: true,
            termsText: 'QUOTE AND PRICES\n- English standard terms.',
            paymentTermsDays: 14,
            customerInfo: {
                name: '',
                company: 'Two Forks',
                reference: 'PROJ-1',
                customerReference: 'ER-900',
                date: '2026-03-19',
                validity: '30 dagar'
            }
        });
        const summary = {
            totals: [
                {
                    model: 'Tillval: LED-Lighting with 4 RGBW-LED strips',
                    size: '-',
                    unitPrice: 0,
                    qty: 1,
                    gross: 0,
                    net: 0,
                    discountSek: 0,
                    discountPct: 0,
                    priceUponRequest: true,
                    isAddon: true,
                    line: 'BaHaMa'
                }
            ],
            finalTotalSek: 0,
            grossTotalSek: 0,
            totalDiscountSek: 0
        };

        const pdfBlob = generatePDF(state, summary, true);
        const textValues = pdfMockState.textCalls.map((call) => call.value);

        expect(pdfBlob).toBeInstanceOf(Blob);
        expect(textValues).toContain('QUOTE');
        expect(textValues).toContain('Date: 2026-03-19');
        expect(textValues).toContain('Quote No: BRIXX - 260422-103');
        expect(textValues).toContain('Project reference: PROJ-1');
        expect(textValues).toContain('Your reference: ER-900');
        expect(textValues).toContain('Total excl. VAT:');
        expect(textValues).toContain('PAYMENT & VALIDITY');
        expect(textValues).toContain('Payment terms: 14 days');
        expect(textValues).toContain('TERMS');
        expect(textValues).toContain('Approval');
        expect(textValues).toContain('* The total excludes items with price on request');
        expect(pdfMockState.autoTableCalls[0].head[0]).toEqual([
            'Model',
            'Size',
            'Unit price\nExcl. VAT',
            'Qty',
            'Your Price\nExcl. VAT',
            'Recommended Price\nExcl. VAT',
            'Discount\nin SEK\n(Excl. VAT)',
            'Discount\nin %'
        ]);
        expect(pdfMockState.autoTableCalls[0].body[0][0]).toBe('Add-on: LED-Lighting with 4 RGBW-LED strips');
        expect(pdfMockState.autoTableCalls[0].body[0][2]).toBe('Price on request');
    });

    it('ignores the hide flag when discounts are present in the quote', () => {
        const state = createStateFixture({
            includeTerms: false,
            includePaymentBox: false,
            includeSignatureBlock: false,
            hideZeroDiscountReferencesInPdf: true
        });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        const pdfBlob = generatePDF(state, summary, true);

        expect(pdfBlob).toBeInstanceOf(Blob);
        expect(pdfMockState.autoTableCalls[0].head[0].some((h) => h.includes('Rabatt\ni SEK'))).toBe(true);
        expect(pdfMockState.autoTableCalls[0].head[0]).toContain('Rabatt\ni %');
        expect(pdfMockState.textCalls.map((call) => call.value).some((t) => t.includes('Total Rabatt'))).toBe(true);
    });

    it('includes custom builder add-ons in the generated PDF table body', () => {
        const state = createZeroDiscountState({
            builderItems: [
                {
                    id: 'builder_1',
                    line: 'BaHaMa',
                    model: 'Jumbrella',
                    size: '4x4 Kvadrat',
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
            gridSelections: {}
        });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        const pdfBlob = generatePDF(state, summary, true);
        const firstTableBody = pdfMockState.autoTableCalls[0].body;

        expect(pdfBlob).toBeInstanceOf(Blob);
        expect(firstTableBody.some((row) => row[0] === 'Tillval: Speciallack')).toBe(true);
    });

    it('preserves negative custom cost amounts in the generated PDF table body', () => {
        const state = createZeroDiscountState({
            builderItems: [],
            gridSelections: {},
            customCosts: [
                {
                    description: 'Extra goodwill-rabatt',
                    price: -4117,
                    qty: 1,
                    discountPct: 0
                }
            ]
        });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        const pdfBlob = generatePDF(state, summary, true);
        const firstTableBody = pdfMockState.autoTableCalls[0].body;

        expect(pdfBlob).toBeInstanceOf(Blob);
        expect(firstTableBody).toEqual([
            [
                'Övrigt: Extra goodwill-rabatt',
                '-',
                '-4 117 SEK',
                '1',
                '-4 117 SEK',
                '-4 117 SEK',
                '0 SEK',
                '0%'
            ]
        ]);
    });

    it('paginates long terms text instead of truncating the last lines', () => {
        const termsText = Array.from({ length: 120 }, (_, index) => `Villkor rad ${index + 1}`).join('\n');
        const state = createZeroDiscountState({
            includeTerms: true,
            includeSignatureBlock: true,
            termsText
        });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        const pdfBlob = generatePDF(state, summary, true);
        const textValues = pdfMockState.textCalls.map((call) => call.value);

        expect(pdfBlob).toBeInstanceOf(Blob);
        expect(pdfMockState.addPageCalls.length).toBeGreaterThanOrEqual(2);
        expect(textValues).toContain('VILLKOR');
        expect(textValues).toContain('Villkor rad 120');
        expect(textValues).toContain('Godkännande');
    });

    it('moves totals-side boxes to a fresh page when the table ends too close to the footer', () => {
        pdfMockState.currentAutoTableFinalY = 260;

        const state = createZeroDiscountState({
            includePaymentBox: true,
            includeSignatureBlock: true,
            customerInfo: {
                name: 'Ada',
                company: 'Brixx',
                reference: 'REF-7',
                customerReference: 'ER-7',
                date: '2026-03-01',
                validity: '14 dagar'
            }
        });
        const summary = computeQuoteTotals({
            state,
            catalogData: createCatalogFixture()
        });

        const pdfBlob = generatePDF(state, summary, true);
        const textValues = pdfMockState.textCalls.map((call) => call.value);
        const paymentBoxRect = pdfMockState.roundedRectCalls.find((call) => call.width < 190 && call.height > 20);
        const signatureRect = pdfMockState.roundedRectCalls.find((call) => call.width >= 190 && call.height === 31);

        expect(pdfBlob).toBeInstanceOf(Blob);
        expect(pdfMockState.addPageCalls.length).toBeGreaterThanOrEqual(1);
        expect(textValues).toContain('BETALNING & GILTIGHET');
        expect(textValues).toContain('Godkännande');
        expect(textValues).toContain('Projektreferens: REF-7');
        expect(textValues).toContain('Er referens: ER-7');
        expect(paymentBoxRect).toBeTruthy();
        expect(signatureRect).toBeTruthy();

        if (paymentBoxRect.page === signatureRect.page) {
            expect(paymentBoxRect.y + paymentBoxRect.height).toBeLessThanOrEqual(signatureRect.y);
        }
    });

    it('renders "Pris på förfrågan" on request-based table rows and prints totals-exclusion footnote on PDF', () => {
        const state = createZeroDiscountState({
            builderItems: [
                {
                    line: 'BaHaMa',
                    model: 'Jumbrella outSide',
                    size: '3x3 Kvadrat',
                    qty: 1,
                    discountPct: 0,
                    addons: [{ id: 'outside_classic_light_4', qty: 1, discountPct: 0 }]
                }
            ]
        });
        const summary = {
            totals: [
                {
                    model: 'BaHaMa Jumbrella outSide',
                    size: '3x3',
                    unitPrice: 75900,
                    qty: 1,
                    gross: 75900,
                    net: 75900,
                    discountSek: 0,
                    discountPct: 0,
                    line: 'BaHaMa'
                },
                {
                    model: 'Tillval: LED-Lighting with 4 RGBW-LED strips',
                    size: '-',
                    unitPrice: 0,
                    qty: 1,
                    gross: 0,
                    net: 0,
                    discountSek: 0,
                    discountPct: 0,
                    priceUponRequest: true,
                    isAddon: true,
                    line: 'BaHaMa'
                }
            ],
            finalTotalSek: 75900,
            grossTotalSek: 75900,
            totalDiscountSek: 0
        };

        const pdfBlob = generatePDF(state, summary, true);
        const textValues = pdfMockState.textCalls.map((call) => call.value);

        expect(pdfBlob).toBeInstanceOf(Blob);
        
        // Assert footnote is printed
        expect(textValues).toContain('* Totalsumman exkluderar artiklar med pris på förfrågan');

        // Assert that the table row is formatted with 'Pris på förfrågan'
        expect(pdfMockState.autoTableCalls[0].body[1][2]).toBe('Pris på förfrågan');
        expect(pdfMockState.autoTableCalls[0].body[1][4]).toBe('Pris på förfrågan');
        expect(pdfMockState.autoTableCalls[0].body[1][5]).toBe('Pris på förfrågan'); // gross column
        expect(pdfMockState.autoTableCalls[0].body[1][6]).toBe('-'); // discount SEK column
        expect(pdfMockState.autoTableCalls[0].body[1][7]).toBe('-'); // discount pct column
    });
});
