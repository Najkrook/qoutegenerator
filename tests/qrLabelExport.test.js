import { describe, expect, it } from 'vitest';
import {
    DEFAULT_QR_LABEL_LAYOUT,
    getA4LabelGrid,
    validateQrLabelLayout
} from '../src/services/qrLabelExport';

describe('QR label layout', () => {
    it('fits the approved 70 × 50 mm layout on A4', () => {
        expect(getA4LabelGrid(DEFAULT_QR_LABEL_LAYOUT)).toEqual({
            columns: 2,
            rows: 5,
            labelsPerPage: 10
        });
        expect(validateQrLabelLayout(DEFAULT_QR_LABEL_LAYOUT)).toBeNull();
    });

    it('rejects labels below the readable minimum and layouts that do not fit', () => {
        expect(validateQrLabelLayout({ ...DEFAULT_QR_LABEL_LAYOUT, widthMm: 59 })).toMatch(/minst/);
        expect(validateQrLabelLayout({ ...DEFAULT_QR_LABEL_LAYOUT, marginMm: 106 })).toMatch(/får inte plats/);
    });
});
