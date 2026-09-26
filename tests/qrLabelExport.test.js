import { describe, expect, it } from 'vitest';
import {
    DEFAULT_QR_LABEL_LAYOUT,
    QR_LABEL_PRESETS,
    getA4LabelGrid,
    validateQrLabelLayout
} from '../src/services/qrLabelExport';

describe('QR label layout', () => {
    it('defaults to one portrait label with 10 mm margins on A4', () => {
        expect(DEFAULT_QR_LABEL_LAYOUT).toEqual({ widthMm: 190, heightMm: 277, marginMm: 10, gapMm: 0 });
        expect(getA4LabelGrid(DEFAULT_QR_LABEL_LAYOUT)).toEqual({
            columns: 1,
            rows: 1,
            labelsPerPage: 1
        });
        expect(validateQrLabelLayout(DEFAULT_QR_LABEL_LAYOUT)).toBeNull();
    });

    it('keeps the smaller label presets available as ten labels per A4 sheet', () => {
        for (const preset of ['70x50', '90x50']) {
            expect(getA4LabelGrid(QR_LABEL_PRESETS[preset])).toEqual({
                columns: 2,
                rows: 5,
                labelsPerPage: 10
            });
            expect(validateQrLabelLayout(QR_LABEL_PRESETS[preset])).toBeNull();
        }
    });

    it('rejects labels below the readable minimum and layouts that do not fit', () => {
        expect(validateQrLabelLayout({ ...DEFAULT_QR_LABEL_LAYOUT, widthMm: 59 })).toMatch(/minst/);
        expect(validateQrLabelLayout({ ...DEFAULT_QR_LABEL_LAYOUT, marginMm: 106 })).toMatch(/får inte plats/);
    });
});
