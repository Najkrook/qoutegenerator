import { describe, expect, it } from 'vitest';
import {
    calculateContractingWorkSummary,
    hasConfiguredContractingWork
} from '../src/services/contractingWork';

function createContractingWork(overrides = {}) {
    return {
        enabled: true,
        projectName: 'Designer Village',
        rows: [],
        margin: {
            enabled: false,
            percent: 15
        },
        ata: {
            enabled: false,
            percent: 15
        },
        ...overrides
    };
}

describe('contractingWork', () => {
    it('calculates the reference 15 percent indicative range', () => {
        const contractingWork = createContractingWork({
            rows: [
                { id: '1', workPackage: 'Groundworks', scope: '', unit: 'package', priceExVatSek: 101600 },
                { id: '2', workPackage: 'Foundations', scope: '', unit: 'package', priceExVatSek: 395500 },
                { id: '3', workPackage: 'Installation', scope: '', unit: 'package', priceExVatSek: 74100 }
            ],
            ata: {
                enabled: true,
                percent: 15
            }
        });

        expect(calculateContractingWorkSummary(contractingWork)).toEqual({
            activeRows: contractingWork.rows,
            customerRows: contractingWork.rows,
            costTotalSek: 571200,
            baseTotalSek: 571200,
            marginEnabled: false,
            marginPercent: 15,
            marginAmountSek: 0,
            allowanceSek: 85680,
            lowerIndicativeSek: 485520,
            upperIndicativeSek: 656880,
            ataEnabled: true,
            ataPercent: 15
        });
    });

    it('applies markup per row, rounds customer prices and calculates ATA from the customer total', () => {
        const contractingWork = createContractingWork({
            rows: [
                { id: '1', workPackage: 'Groundworks', scope: 'Unchanged', unit: 'package', priceExVatSek: 101600 },
                { id: '2', workPackage: 'Foundations', scope: '', unit: 'package', priceExVatSek: 395500 },
                { id: '3', workPackage: 'Installation', scope: '', unit: 'package', priceExVatSek: 74100 }
            ],
            margin: {
                enabled: true,
                percent: 15
            },
            ata: {
                enabled: true,
                percent: 15
            }
        });

        const summary = calculateContractingWorkSummary(contractingWork);

        expect(summary.activeRows).toEqual(contractingWork.rows);
        expect(summary.customerRows).toEqual([
            { id: '1', workPackage: 'Groundworks', scope: 'Unchanged', unit: 'package', priceExVatSek: 116840 },
            { id: '2', workPackage: 'Foundations', scope: '', unit: 'package', priceExVatSek: 454825 },
            { id: '3', workPackage: 'Installation', scope: '', unit: 'package', priceExVatSek: 85215 }
        ]);
        expect(summary.costTotalSek).toBe(571200);
        expect(summary.baseTotalSek).toBe(656880);
        expect(summary.marginEnabled).toBe(true);
        expect(summary.marginPercent).toBe(15);
        expect(summary.marginAmountSek).toBe(85680);
        expect(summary.allowanceSek).toBe(98532);
        expect(summary.lowerIndicativeSek).toBe(558348);
        expect(summary.upperIndicativeSek).toBe(755412);
    });

    it('rounds each marked-up customer row before summing the customer total', () => {
        const summary = calculateContractingWorkSummary(createContractingWork({
            rows: [
                { id: '1', workPackage: 'A', scope: '', unit: 'package', priceExVatSek: 100.4 },
                { id: '2', workPackage: 'B', scope: '', unit: 'package', priceExVatSek: 99.6 }
            ],
            margin: { enabled: true, percent: 15 }
        }));

        expect(summary.customerRows.map((row) => row.priceExVatSek)).toEqual([115, 115]);
        expect(summary.costTotalSek).toBe(200);
        expect(summary.baseTotalSek).toBe(230);
        expect(summary.marginAmountSek).toBe(30);
    });

    it('never exposes a negative zero margin after customer-price rounding', () => {
        const summary = calculateContractingWorkSummary(createContractingWork({
            rows: [
                { id: '1', workPackage: 'A', scope: '', unit: 'package', priceExVatSek: 100.4 }
            ],
            margin: { enabled: true, percent: 0 }
        }));

        expect(summary.customerRows[0].priceExVatSek).toBe(100);
        expect(summary.marginAmountSek).toBe(0);
        expect(Object.is(summary.marginAmountSek, -0)).toBe(false);
    });

    it('only treats enabled contracting work with a named package as configured', () => {
        const blankRow = { id: '1', workPackage: '   ', scope: 'Text', unit: 'package', priceExVatSek: 100 };
        const namedRow = { ...blankRow, workPackage: 'Installation' };

        expect(hasConfiguredContractingWork(createContractingWork({ enabled: false, rows: [namedRow] }))).toBe(false);
        expect(hasConfiguredContractingWork(createContractingWork({ rows: [blankRow] }))).toBe(false);
        expect(hasConfiguredContractingWork(createContractingWork({ rows: [namedRow] }))).toBe(true);
        expect(hasConfiguredContractingWork(null)).toBe(false);
    });

    it('ignores unnamed rows and does not apply an allowance when ATA is disabled', () => {
        const namedRow = { id: '1', workPackage: 'Installation', scope: '', unit: 'package', priceExVatSek: 250 };
        const summary = calculateContractingWorkSummary(createContractingWork({
            rows: [
                namedRow,
                { id: '2', workPackage: '', scope: 'Draft', unit: 'package', priceExVatSek: 999 },
                { id: '3', workPackage: 'Credit', scope: '', unit: 'package', priceExVatSek: -50 }
            ]
        }));

        expect(summary.activeRows).toEqual([namedRow, expect.objectContaining({ id: '3' })]);
        expect(summary.customerRows).toEqual([namedRow, expect.objectContaining({ id: '3', priceExVatSek: 0 })]);
        expect(summary.costTotalSek).toBe(250);
        expect(summary.baseTotalSek).toBe(250);
        expect(summary.marginEnabled).toBe(false);
        expect(summary.marginAmountSek).toBe(0);
        expect(summary.allowanceSek).toBe(0);
        expect(summary.lowerIndicativeSek).toBe(250);
        expect(summary.upperIndicativeSek).toBe(250);
    });

    it('returns zero commercial values while stored contracting work is disabled', () => {
        const summary = calculateContractingWorkSummary(createContractingWork({
            enabled: false,
            rows: [{ id: '1', workPackage: 'Stored draft', scope: '', unit: 'package', priceExVatSek: 1000 }],
            ata: { enabled: true, percent: 15 }
        }));

        expect(summary.activeRows).toEqual([]);
        expect(summary.customerRows).toEqual([]);
        expect(summary.costTotalSek).toBe(0);
        expect(summary.baseTotalSek).toBe(0);
        expect(summary.marginEnabled).toBe(false);
        expect(summary.marginPercent).toBe(15);
        expect(summary.marginAmountSek).toBe(0);
        expect(summary.allowanceSek).toBe(0);
        expect(summary.lowerIndicativeSek).toBe(0);
        expect(summary.upperIndicativeSek).toBe(0);
        expect(summary.ataEnabled).toBe(false);
        expect(summary.ataPercent).toBe(15);
    });
});
