import { describe, expect, it, vi } from 'vitest';
import {
    createMarginSettingsService,
    DEFAULT_QUOTE_MARGINS_BY_LINE,
    normalizeQuoteMarginSettings,
    normalizeQuoteMarginsByLine
} from '../src/services/marginSettingsService';

describe('marginSettingsService normalization', () => {
    it('merges partial settings with defaults and clamps invalid margins', () => {
        expect(normalizeQuoteMarginsByLine({
            BaHaMa: 150,
            ClickitUp: -12,
            Fiesta: 25
        })).toEqual({
            BaHaMa: 100,
            ClickitUp: 0,
            Fiesta: 25
        });

        expect(normalizeQuoteMarginsByLine({
            BaHaMa: 41
        })).toEqual({
            ...DEFAULT_QUOTE_MARGINS_BY_LINE,
            BaHaMa: 41
        });
    });

    it('normalizes Firestore document metadata safely', () => {
        const settings = normalizeQuoteMarginSettings({
            data: () => ({
                marginsByLine: { ClickitUp: 34 },
                updatedAt: '42',
                updatedBy: 'admin@example.com',
                updatedByUid: 'admin-1'
            })
        });

        expect(settings.marginsByLine).toEqual({
            BaHaMa: 40,
            ClickitUp: 34,
            Fiesta: 30
        });
        expect(settings.updatedAt).toBe(42);
        expect(settings.updatedBy).toBe('admin@example.com');
        expect(settings.updatedByUid).toBe('admin-1');
    });
});

describe('marginSettingsService Firestore behavior', () => {
    it('returns defaults when the shared settings document does not exist', async () => {
        const service = createMarginSettingsService({
            db: {},
            doc: vi.fn(() => ({ path: 'app_settings/quote_margins' })),
            getDoc: vi.fn(async () => ({
                exists: () => false,
                data: () => undefined
            })),
            setDoc: vi.fn()
        });

        await expect(service.getQuoteMarginSettings()).resolves.toEqual({
            marginsByLine: DEFAULT_QUOTE_MARGINS_BY_LINE,
            updatedAt: 0,
            updatedBy: '',
            updatedByUid: ''
        });
    });

    it('writes normalized shared settings with admin metadata', async () => {
        const setDoc = vi.fn(async () => {});
        const service = createMarginSettingsService({
            db: {},
            doc: vi.fn(() => ({ path: 'app_settings/quote_margins' })),
            getDoc: vi.fn(),
            setDoc
        });

        const saved = await service.saveQuoteMarginSettings({
            marginsByLine: {
                BaHaMa: 39.5,
                ClickitUp: 110,
                Fiesta: -4
            },
            user: { uid: 'admin-1', email: 'admin@example.com' }
        });

        expect(saved.marginsByLine).toEqual({
            BaHaMa: 39.5,
            ClickitUp: 100,
            Fiesta: 0
        });
        expect(saved.updatedBy).toBe('admin@example.com');
        expect(saved.updatedByUid).toBe('admin-1');
        expect(setDoc).toHaveBeenCalledWith(
            { path: 'app_settings/quote_margins' },
            expect.objectContaining({
                marginsByLine: saved.marginsByLine,
                updatedBy: 'admin@example.com',
                updatedByUid: 'admin-1'
            }),
            { merge: true }
        );
    });
});
