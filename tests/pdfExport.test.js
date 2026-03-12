import { describe, expect, it } from 'vitest';
import { computeValidUntilDateString } from '../src/features/pdfExport.js';

describe('pdfExport helpers', () => {
    it('computes valid-until date from quote date and validity days', () => {
        const validUntil = computeValidUntilDateString('2026-03-01', 14, new Date('2026-01-01T00:00:00'));
        expect(validUntil).toBe('2026-03-15');
    });

    it('falls back to current date when quote date is missing', () => {
        const validUntil = computeValidUntilDateString('', 10, new Date('2026-03-02T00:00:00'));
        expect(validUntil).toBe('2026-03-12');
    });
});
