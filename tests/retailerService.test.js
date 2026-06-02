import { beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseMocks = vi.hoisted(() => ({
    db: {},
    collection: vi.fn(() => 'retailers-ref'),
    doc: vi.fn(() => 'retailer-doc-ref'),
    getDocs: vi.fn(),
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    query: vi.fn((ref) => ref),
    orderBy: vi.fn(() => ({ field: 'name', direction: 'asc' }))
}));

vi.mock('../src/services/firebase', () => firebaseMocks);
vi.mock('../src/services/activityLogService', () => ({
    safeLogActivity: vi.fn()
}));

import { fetchRetailers, normalizeRetailerData } from '../src/services/retailerService';

const mockCatalog = {
    BaHaMa: { name: 'BaHaMa', type: 'builder' },
    ClickitUp: { name: 'ClickitUp', type: 'grid' },
    Fiesta: { name: 'Fiesta', type: 'builder' }
};

describe('normalizeRetailerData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('trims whitespace from name', () => {
        const result = normalizeRetailerData({
            name: '  Markishuset  ',
            email: 'sales@example.com',
            productLines: {}
        }, mockCatalog);
        expect(result.name).toBe('Markishuset');
    });

    it('rejects empty name', () => {
        expect(() => normalizeRetailerData({ name: '' }, mockCatalog)).toThrow('Retailer name is required.');
        expect(() => normalizeRetailerData({ name: '   ' }, mockCatalog)).toThrow('Retailer name is required.');
        expect(() => normalizeRetailerData({}, mockCatalog)).toThrow('Retailer name is required.');
    });

    it('clamps discount to 0..100', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            email: 'sales@example.com',
            productLines: {
                BaHaMa: { enabled: true, discountPct: 150 },
                ClickitUp: { enabled: true, discountPct: -10 }
            }
        }, mockCatalog);
        expect(result.productLines.BaHaMa.discountPct).toBe(100);
        expect(result.productLines.ClickitUp.discountPct).toBe(0);
    });

    it('zeros discount on disabled lines', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            email: 'sales@example.com',
            productLines: {
                BaHaMa: { enabled: false, discountPct: 30 }
            }
        }, mockCatalog);
        expect(result.productLines.BaHaMa.enabled).toBe(false);
        expect(result.productLines.BaHaMa.discountPct).toBe(0);
    });

    it('strips unknown product line keys', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            email: 'sales@example.com',
            productLines: {
                BaHaMa: { enabled: true, discountPct: 20 },
                UnknownLine: { enabled: true, discountPct: 50 }
            }
        }, mockCatalog);
        expect(result.productLines).not.toHaveProperty('UnknownLine');
        expect(Object.keys(result.productLines)).toEqual(['BaHaMa', 'ClickitUp', 'Fiesta']);
    });

    it('fills missing product lines with disabled defaults', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            email: 'sales@example.com',
            productLines: {
                BaHaMa: { enabled: true, discountPct: 30 }
            }
        }, mockCatalog);
        expect(result.productLines.ClickitUp).toEqual({ enabled: false, discountPct: 0 });
        expect(result.productLines.Fiesta).toEqual({ enabled: false, discountPct: 0 });
    });

    it('preserves valid data unchanged', () => {
        const result = normalizeRetailerData({
            name: 'Solklar',
            email: 'test@example.com',
            notes: 'VIP retailer',
            productLines: {
                BaHaMa: { enabled: true, discountPct: 22 },
                ClickitUp: { enabled: true, discountPct: 20 },
                Fiesta: { enabled: false, discountPct: 0 }
            }
        }, mockCatalog);
        expect(result).toEqual({
            name: 'Solklar',
            email: 'test@example.com',
            notes: 'VIP retailer',
            pdfThemes: [],
            productLines: {
                BaHaMa: { enabled: true, discountPct: 22 },
                ClickitUp: { enabled: true, discountPct: 20 },
                Fiesta: { enabled: false, discountPct: 0 }
            }
        });
    });

    it('handles non-finite discount values', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            email: 'sales@example.com',
            productLines: {
                BaHaMa: { enabled: true, discountPct: NaN },
                ClickitUp: { enabled: true, discountPct: undefined }
            }
        }, mockCatalog);
        expect(result.productLines.BaHaMa.discountPct).toBe(0);
        expect(result.productLines.ClickitUp.discountPct).toBe(0);
    });

    it('trims notes', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            email: 'sales@example.com',
            notes: '  some notes  '
        }, mockCatalog);
        expect(result.notes).toBe('some notes');
    });

    it('preserves valid pdfThemes array', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            email: 'sales@example.com',
            pdfThemes: ['custom', 'roslagsmarkisen']
        }, mockCatalog);
        expect(result.pdfThemes).toEqual(['custom', 'roslagsmarkisen']);
    });

    it('filters out non-string items from pdfThemes', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            email: 'sales@example.com',
            pdfThemes: ['custom', 123, null, 'roslagsmarkisen']
        }, mockCatalog);
        expect(result.pdfThemes).toEqual(['custom', 'roslagsmarkisen']);
    });

    it('defaults pdfThemes to empty array if invalid type', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            email: 'sales@example.com',
            pdfThemes: 'not an array'
        }, mockCatalog);
        expect(result.pdfThemes).toEqual([]);
    });

    it('only includes name, email, productLines, notes, and pdfThemes in output', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            email: 'test@example.com',
            extraField: 'should be stripped',
            productLines: {},
            pdfThemes: ['custom']
        }, mockCatalog);
        expect(Object.keys(result).sort()).toEqual(['name', 'email', 'productLines', 'notes', 'pdfThemes'].sort());
    });

    it('parses and lowercases email', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            email: ' USER1@Test.com '
        }, mockCatalog);
        expect(result.email).toBe('user1@test.com');
    });

    it('rejects empty or missing email', () => {
        expect(() => normalizeRetailerData({ name: 'Test' }, mockCatalog)).toThrow('Användare (E-post) är obligatoriskt.');
        expect(() => normalizeRetailerData({ name: 'Test', email: '   ' }, mockCatalog)).toThrow('Användare (E-post) är obligatoriskt.');
    });

    it('ignores malformed product line payloads safely', () => {
        const result = normalizeRetailerData({
            name: 'Test',
            email: 'test@example.com',
            productLines: 'broken'
        }, mockCatalog);

        expect(result.productLines).toEqual({
            BaHaMa: { enabled: false, discountPct: 0 },
            ClickitUp: { enabled: false, discountPct: 0 },
            Fiesta: { enabled: false, discountPct: 0 }
        });
    });
});

describe('fetchRetailers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('normalizes malformed stored product lines safely', async () => {
        firebaseMocks.getDocs.mockResolvedValue({
            docs: [
                {
                    id: 'ret-1',
                    data: () => ({
                        name: 'Nordvind',
                        email: 'sales@nordvind.se',
                        notes: 'VIP',
                        productLines: {
                            BaHaMa: { enabled: true, discountPct: 15 },
                            ClickitUp: 'broken',
                            Fiesta: { enabled: false, discountPct: 25 }
                        }
                    })
                }
            ]
        });

        const rows = await fetchRetailers();

        expect(rows).toEqual([
            {
                id: 'ret-1',
                name: 'Nordvind',
                email: 'sales@nordvind.se',
                notes: 'VIP',
                pdfThemes: [],
                productLines: {
                    BaHaMa: { enabled: true, discountPct: 15 },
                    ClickitUp: { enabled: false, discountPct: 0 },
                    Fiesta: { enabled: false, discountPct: 0 }
                }
            }
        ]);
    });
});
