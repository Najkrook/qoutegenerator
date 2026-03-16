import { describe, expect, it } from 'vitest';
import { catalogData } from '../src/data/catalog.js';
import {
    DEFAULT_PARASOL_PRESET_ID,
    FIESTA_DIAMETER_MM,
    FIESTA_EXPORT_LINE,
    FIESTA_EXPORT_MODEL,
    FIESTA_EXPORT_SIZE,
    PARASOL_PRESETS,
    buildJumbrellaParasolPresets,
    computeParasolOverlapWarnings,
    getFiestaRadiusMm,
    getEffectiveParasolDimensions,
    getParasolPresetById,
    groupParasolPresetsByCategory,
    isParasolRotatable,
    normalizeFiestaItem,
    parseJumbrellaSize
} from '../src/utils/parasolGeometry.js';

describe('parasolGeometry', () => {
    it('parses Jumbrella kvadrat and rektangel sizes to millimeters', () => {
        expect(parseJumbrellaSize('3x3 Kvadrat')).toEqual({
            widthMm: 3000,
            depthMm: 3000,
            shapeCategory: 'Kvadrat'
        });

        expect(parseJumbrellaSize('3,5x3,5 Kvadrat')).toEqual({
            widthMm: 3500,
            depthMm: 3500,
            shapeCategory: 'Kvadrat'
        });

        expect(parseJumbrellaSize('6x4,5 Rektangel')).toEqual({
            widthMm: 6000,
            depthMm: 4500,
            shapeCategory: 'Rektangel'
        });
    });

    it('classifies round sizes but excludes them from sketch presets', () => {
        expect(parseJumbrellaSize('3* Runda')).toEqual({
            widthMm: 3000,
            depthMm: 3000,
            shapeCategory: 'Runda'
        });

        expect(PARASOL_PRESETS.some((preset) => preset.shapeCategory === 'Runda')).toBe(false);
        expect(PARASOL_PRESETS.some((preset) => preset.label.includes('Runda'))).toBe(false);
    });

    it('builds presets from the Jumbrella catalog with legacy ids intact', () => {
        const expectedLabels = Object.keys(catalogData.BaHaMa.models.Jumbrella.sizes).filter((sizeLabel) => {
            const parsed = parseJumbrellaSize(sizeLabel);
            return parsed && parsed.shapeCategory !== 'Runda';
        });

        const builtPresets = buildJumbrellaParasolPresets();

        expect(builtPresets.map((preset) => preset.label)).toEqual(expectedLabels);
        expect(getParasolPresetById(DEFAULT_PARASOL_PRESET_ID)?.label).toBe('3x3 Kvadrat');
        expect(getParasolPresetById('parasol_4x4')?.label).toBe('4x4 Kvadrat');
        expect(getParasolPresetById('parasol_5x5')?.label).toBe('5x5 Kvadrat');
        expect(getParasolPresetById('parasol_4x3')?.label).toBe('4x3 Rektangel');
        expect(getParasolPresetById('jumbrella_35x35_kvadrat')?.label).toBe('3,5x3,5 Kvadrat');
        expect(getParasolPresetById('jumbrella_6x45_rektangel')?.label).toBe('6x4,5 Rektangel');
    });

    it('assigns export metadata for BaHaMa Jumbrella rows', () => {
        const preset = getParasolPresetById('jumbrella_45x45_kvadrat');

        expect(preset).toMatchObject({
            exportLine: 'BaHaMa',
            exportModel: 'Jumbrella',
            exportSize: '4,5x4,5 Kvadrat',
            shapeCategory: 'Kvadrat'
        });
    });

    it('groups presets by category in stable sketch order', () => {
        const groups = groupParasolPresetsByCategory(PARASOL_PRESETS);

        expect(groups.map((group) => group.category)).toEqual(['Kvadrat', 'Rektangel']);
        expect(groups[0].presets[0].label).toBe('3x3 Kvadrat');
        expect(groups[1].presets[0].label).toBe('3x1,5 Rektangel');
    });

    it('treats only non-square rectangular parasols as rotatable and swaps effective dimensions at 90 degrees', () => {
        expect(isParasolRotatable({ widthMm: 5000, depthMm: 2500 })).toBe(true);
        expect(isParasolRotatable({ widthMm: 3000, depthMm: 3000 })).toBe(false);

        expect(getEffectiveParasolDimensions({ widthMm: 5000, depthMm: 2500, rotationDeg: 0 })).toEqual({
            widthMm: 5000,
            depthMm: 2500
        });
        expect(getEffectiveParasolDimensions({ widthMm: 5000, depthMm: 2500, rotationDeg: 90 })).toEqual({
            widthMm: 2500,
            depthMm: 5000
        });
    });

    it('uses rotated effective dimensions for overlap warnings', () => {
        const warnings = computeParasolOverlapWarnings([
            { id: 'a', xMm: 2000, yMm: 2000, widthMm: 5000, depthMm: 2500, rotationDeg: 90 },
            { id: 'b', xMm: 2000, yMm: 5600, widthMm: 2500, depthMm: 2500, rotationDeg: 0 }
        ]);

        expect(warnings).toEqual([{ id: 'parasol-overlap', text: 'Flera parasoller overlappar varandra.' }]);
    });

    it('normalizes Fiesta sketch items with fixed diameter and export metadata', () => {
        expect(normalizeFiestaItem({
            id: 'fiesta-1',
            xMm: 1200,
            yMm: 1400,
            zLayer: 'above'
        })).toEqual({
            id: 'fiesta-1',
            xMm: 1200,
            yMm: 1400,
            diameterMm: FIESTA_DIAMETER_MM,
            zLayer: 'above',
            exportLine: FIESTA_EXPORT_LINE,
            exportModel: FIESTA_EXPORT_MODEL,
            exportSize: FIESTA_EXPORT_SIZE
        });

        expect(getFiestaRadiusMm({ diameterMm: FIESTA_DIAMETER_MM })).toBe(350);
    });
});
