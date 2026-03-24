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

import { computeQuoteTotals } from '../src/services/calculationEngine.js';
import {
    computeValidUntilDateString,
    createPdfTableLayout,
    generatePDF,
    groupSummaryTotalsByLine
} from '../src/features/pdfExport.js';
import { createCatalogFixture, createStateFixture } from './fixtures/calculationFixtures.js';

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
        expect(textValues).toContain('Projektreferens: PROJ-1');
        expect(textValues).toContain('Er referens: ER-900');
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
        expect(pdfMockState.autoTableCalls[0].head[0]).toContain('Rabatt\ni SEK');
        expect(pdfMockState.autoTableCalls[0].head[0]).toContain('Rabatt\ni %');
        expect(pdfMockState.textCalls.map((call) => call.value)).toContain('Total Rabatt:');
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
        expect(firstTableBody.some((row) => row[0] === '  + Tillval: Speciallack')).toBe(true);
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
        expect(textValues).toContain('Projektreferens: REF-7');
        expect(paymentBoxRect).toBeTruthy();
        expect(signatureRect).toBeTruthy();

        if (paymentBoxRect.page === signatureRect.page) {
            expect(paymentBoxRect.y + paymentBoxRect.height).toBeLessThanOrEqual(signatureRect.y);
        }
    });
});
