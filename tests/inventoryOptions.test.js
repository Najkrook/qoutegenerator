import { describe, expect, it } from 'vitest';
import {
    BAHAMA_LOCATION_OPTION_GROUPS,
    BAHAMA_LOCATION_OPTIONS,
    BAHAMA_TEXTILE_OPTION_GROUPS,
    BAHAMA_TEXTILE_OPTIONS,
    formatBahamaLocationOptionLabel,
    getBahamaGroupedSizeOptions,
    getBahamaSizeOptions
} from '../src/components/features/inventoryOptions';

describe('inventoryOptions', () => {
    it('reads BaHaMa size options from the catalog models', () => {
        expect(getBahamaSizeOptions('Pure')).toContain('2x2');
        expect(getBahamaSizeOptions('Jumbrella')).toContain('4x4 Kvadrat');
        expect(getBahamaSizeOptions('XL')).toContain('7x7 Kvadrat');
        expect(getBahamaSizeOptions('Specialmodell')).toEqual([]);
    });

    it('groups BaHaMa size options like the configurator', () => {
        expect(getBahamaGroupedSizeOptions('Jumbrella')).toEqual([
            expect.objectContaining({ label: 'Kvadrat', options: expect.arrayContaining(['3x3 Kvadrat', '4x4 Kvadrat']) }),
            expect.objectContaining({ label: 'Runda', options: expect.arrayContaining(['3* Runda', '7* Runda']) }),
            expect.objectContaining({ label: 'Rektangel', options: expect.arrayContaining(['3x1,5 Rektangel', '6x4,5 Rektangel']) })
        ]);
    });

    it('offers BaHaMa storage locations as rack and floor combinations', () => {
        expect(BAHAMA_LOCATION_OPTIONS).toHaveLength(42);
        expect(BAHAMA_LOCATION_OPTIONS).toContain('Grenställ 1 våning 1');
        expect(BAHAMA_LOCATION_OPTIONS).toContain('Grenställ 3 våning 5');
        expect(BAHAMA_LOCATION_OPTIONS).toContain('Grenställ 6 våning 7');
        expect(BAHAMA_LOCATION_OPTIONS).not.toContain('Grenställ 7 våning 1');
        expect(BAHAMA_LOCATION_OPTIONS).not.toContain('Grenställ 1 våning 8');
    });

    it('groups BaHaMa storage locations by rack', () => {
        expect(BAHAMA_LOCATION_OPTION_GROUPS).toHaveLength(6);
        expect(BAHAMA_LOCATION_OPTION_GROUPS[2]).toEqual({
            label: 'Grenställ 3',
            options: [
                'Grenställ 3 våning 1',
                'Grenställ 3 våning 2',
                'Grenställ 3 våning 3',
                'Grenställ 3 våning 4',
                'Grenställ 3 våning 5',
                'Grenställ 3 våning 6',
                'Grenställ 3 våning 7'
            ]
        });
        expect(formatBahamaLocationOptionLabel('Grenställ 3 våning 5')).toBe('Våning 5');
    });

    it('includes textile options extracted from Betex 05 and Akryl color charts', () => {
        expect(BAHAMA_TEXTILE_OPTIONS).toContain('9947 - mushroom');
        expect(BAHAMA_TEXTILE_OPTIONS).toContain('2821 - Silver');
    });

    it('groups textile options by color chart', () => {
        expect(BAHAMA_TEXTILE_OPTION_GROUPS).toEqual([
            expect.objectContaining({
                label: 'Betex 05',
                options: expect.arrayContaining(['9947 - mushroom', '9956 - birch'])
            }),
            expect.objectContaining({
                label: 'Akryl',
                options: expect.arrayContaining(['2821 - Silver', '2170 - Black'])
            })
        ]);
    });
});
