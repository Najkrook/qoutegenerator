import { beforeEach, describe, expect, it, vi } from 'vitest';

const pdfMockState = vi.hoisted(() => ({
    textCalls: [],
    autoTableCalls: []
}));

vi.mock('jspdf', () => {
    class MockJsPdf {
        constructor() {
            this.pageCount = 1;
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
            pdfMockState.textCalls.push(String(value));
        }
        setDrawColor() {}
        setLineWidth() {}
        line() {}
        setFillColor() {}
        roundedRect() {}
        rect() {}
        addPage() {
            this.pageCount += 1;
            this.lastAutoTable = { finalY: 40 };
        }
        splitTextToSize(value) {
            return [String(value)];
        }
        output(kind) {
            return kind === 'blob' ? new Blob(['pdf']) : 'pdf';
        }
        setPage() {}
    }

    return { jsPDF: MockJsPdf };
});

vi.mock('jspdf-autotable', () => ({
    default: (doc, options) => {
        pdfMockState.autoTableCalls.push(options);
        doc.lastAutoTable = { finalY: (options.startY || 0) + 24 };
    }
}));

import { computeQuoteTotals } from '../src/services/calculationEngine.js';
import { computeValidUntilDateString, generatePDF } from '../src/features/pdfExport.js';
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
            ClickitUP: {
                items: {
                    'ClickitUP Section|1000': { qty: 1, discountPct: 0 }
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
    });

    it('computes valid-until date from quote date and validity days', () => {
        const validUntil = computeValidUntilDateString('2026-03-01', 14, new Date('2026-01-01T00:00:00'));
        expect(validUntil).toBe('2026-03-15');
    });

    it('falls back to current date when quote date is missing', () => {
        const validUntil = computeValidUntilDateString('', 10, new Date('2026-03-02T00:00:00'));
        expect(validUntil).toBe('2026-03-12');
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
        expect(pdfMockState.textCalls).toContain('Totalt Rek Utpris:');
        expect(pdfMockState.textCalls).toContain('Totalt Exkl. moms:');
        expect(pdfMockState.textCalls).not.toContain('Total Rabatt:');
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
        expect(pdfMockState.textCalls).toContain('Total Rabatt:');
    });
});
