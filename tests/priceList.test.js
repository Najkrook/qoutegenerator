import { describe, expect, it } from 'vitest';
import { catalogData } from '../src/data/catalog';
import {
    applyPriceListDiscount,
    buildPriceListEntries,
    convertPriceListEntryToSek,
    filterPriceListEntries,
    getPriceListSizeCategory,
    getRetailerLineDiscount,
    getVisiblePriceListLineIds
} from '../src/services/priceList';

describe('price list catalog module', () => {
    const entries = buildPriceListEntries(catalogData);

    it('normalizes builder and grid catalog shapes into searchable price rows', () => {
        expect(entries).toContainEqual(expect.objectContaining({
            lineId: 'BaHaMa',
            kind: 'product',
            name: 'Jumbrella',
            size: '3x3 Kvadrat',
            unitPrice: 2390,
            currency: 'EUR',
            variantCategory: 'Kvadrat'
        }));
        expect(entries).toContainEqual(expect.objectContaining({
            lineId: 'BaHaMa',
            kind: 'addon',
            name: 'Gjuthylsa Jumbrella',
            unitPrice: 560,
            currency: 'EUR'
        }));
        expect(entries).toContainEqual(expect.objectContaining({
            lineId: 'ClickitUp',
            kind: 'product',
            name: 'ClickitUp Sektion',
            size: '700',
            unitPrice: 11134,
            currency: 'SEK'
        }));
        expect(entries).toContainEqual(expect.objectContaining({
            lineId: 'ClickitUp',
            kind: 'addon',
            name: 'Glasfrakt Specialpall',
            unitPrice: 2120,
            currency: 'SEK'
        }));
    });

    it('categorizes builder sizes by shape while leaving unrelated sizes ungrouped', () => {
        expect(getPriceListSizeCategory('3x3 Kvadrat')).toBe('Kvadrat');
        expect(getPriceListSizeCategory('3* Runda')).toBe('Runda');
        expect(getPriceListSizeCategory('4x3 Rektangel')).toBe('Rektangel');
        expect(getPriceListSizeCategory('Ø4')).toBe('Runda');
        expect(getPriceListSizeCategory('4x4')).toBe('Kvadrat');
        expect(getPriceListSizeCategory('4x3')).toBe('Rektangel');
        expect(getPriceListSizeCategory('Slim')).toBeNull();
    });

    it('filters across line, kind, product context, size, and Swedish characters', () => {
        expect(filterPriceListEntries(entries, {
            lineId: 'ClickitUp',
            kind: 'product',
            search: 'sektion 700'
        })).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: 'ClickitUp Sektion', size: '700' })
        ]));

        expect(filterPriceListEntries(entries, {
            kind: 'addon',
            search: 'stodben'
        })).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: 'Stödben stort (45°)' })
        ]));
    });

    it('limits retailer lines and calculates converted contract prices', () => {
        const retailer = {
            productLines: {
                BaHaMa: { enabled: true, discountPct: 20 },
                ClickitUp: { enabled: false, discountPct: 10 }
            }
        };
        const jumbrella = entries.find((entry) => (
            entry.lineId === 'BaHaMa'
            && entry.name === 'Jumbrella'
            && entry.size === '3x3 Kvadrat'
        ));

        expect(getVisiblePriceListLineIds(catalogData, true, retailer)).toEqual(['BaHaMa']);
        expect(getVisiblePriceListLineIds(catalogData, false, retailer)).toEqual(Object.keys(catalogData));
        expect(getRetailerLineDiscount('BaHaMa', true, retailer)).toBe(20);
        expect(convertPriceListEntryToSek(jumbrella, 12.2)).toBe(29158);
        expect(applyPriceListDiscount(29158, 20)).toBeCloseTo(23326.4);
    });

    it('preserves explicit price-on-request entries', () => {
        expect(entries).toContainEqual(expect.objectContaining({
            lineId: 'BaHaMa',
            name: 'LED-Lighting with 4 RGBW-LED strips',
            priceUponRequest: true
        }));
    });
});
