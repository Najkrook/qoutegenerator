import { describe, expect, it } from 'vitest';
import { catalogData } from '../src/data/catalog';
import {
    formatLocalizedValidityPeriod,
    translateGroupLabel,
    translateQuoteTotalsRowModel
} from '../src/services/exportLocalization';

const MODEL_NAMES = {
    ClickitUp: {
        'ClickitUp Sektion': 'ClickitUp section',
        'Curved Rundat Hörn': 'ClickitUpCurved',
        'ClickitUp Hane': 'ClickitUp male section',
        'ClickitUp Dörr': 'ClickitUp Door'
    },
    ClickitUpFixed: {
        'ClickitUp Sektion': 'CiUFixed section',
        'ClickitUp Hane': 'CiUFixed male section',
        'ClickitUp Dörr': 'CiUFixedDoor'
    }
};

const ADDON_NAMES = {
    frakt_glas: 'Glass freight – special pallet',
    stodben_stort: 'Large support leg (45°)',
    stodben_litet: 'Small support leg (Slimline)',
    passbit_alu: 'Aluminium post spacer (50 × 80 mm), incl. cover cap',
    svartanodiserade: 'Black-anodised profiles',
    stoppknapp: 'Stop button, 140 cm',
    montering_gangjarn: 'Stainless-steel hinge installation',
    rostfritt_vinkel: 'Stainless-steel angle bracket',
    galvad_stall: 'Galvanised adjustable foot (above-ground installation)',
    vitlackerade_profiler: 'White powder-coated profiles',
    stallavgift_lackering: 'Powder-coating setup fee',
    panikregel: 'Panic bar',
    projektering: 'Engineering (fixed hourly rate)',
    blomsterlada_1800: 'Planter box 1800 mm',
    blomsterlada_1500: 'Planter box 1500 mm',
    blomsterlada_1000: 'Planter box 1000 mm',
    tillval_hjul: 'Wheels',
    tillval_tralav: 'Wooden bench',
    startkostnad_special: 'Custom-size setup fee',
    startkostnad_ral: 'RAL powder-coating setup fee',
    ral_blomsterlador: 'RAL powder coating (quantity of planter boxes)',
    stickfot_std_singel: 'Standard ground spike, single',
    stickfot_std_dubbel: 'Standard ground spike, double',
    stickfot_std_kapad: 'Standard ground spike, cut to size',
    stickfot_plus30_singel: '+30 ground spike, single',
    stickfot_plus30_dubbel: '+30 ground spike, double',
    stickfot_plus60_singel: '+60 ground spike, single',
    stickfot_plus60_dubbel: '+60 ground spike, double'
};

describe('ClickitUp export localization', () => {
    it.each(Object.entries(MODEL_NAMES))('translates every %s model by its source key', (lineId, expectedNames) => {
        for (const [model, expectedName] of Object.entries(expectedNames)) {
            const row = {
                model,
                source: { type: 'grid', lineId, key: `${model}|1000` }
            };

            expect(translateQuoteTotalsRowModel(row, 'en')).toBe(expectedName);
            expect(translateQuoteTotalsRowModel(row, 'sv')).toBe(model);
        }
    });

    it.each(['ClickitUp', 'ClickitUpFixed'])('translates every catalogued add-on for %s by ID', (lineId) => {
        const lineData = catalogData[lineId];
        const addons = lineData.addonCategories.flatMap((category) => category.items);

        for (const addon of addons) {
            expect(addon.exportNameEn).toBe(ADDON_NAMES[addon.id]);
            expect(translateQuoteTotalsRowModel({
                model: `Tillval: ${addon.name}`,
                source: { type: 'grid-addon', lineId, addonId: addon.id }
            }, 'en')).toBe(`Add-on: ${ADDON_NAMES[addon.id]}`);
        }
    });

    it('preserves unknown and custom text while localizing only system prefixes', () => {
        expect(translateQuoteTotalsRowModel({
            model: 'Kundens helt egna sektion',
            source: { type: 'grid', lineId: 'ClickitUp', key: 'missing|999' }
        }, 'en')).toBe('Kundens helt egna sektion');

        expect(translateQuoteTotalsRowModel({
            model: 'Tillval: Kundens helt egna tillval',
            source: { type: 'grid-custom-addon', lineId: 'ClickitUp', categoryId: 'custom', rowId: '1' }
        }, 'en')).toBe('Add-on: Kundens helt egna tillval');

        expect(translateQuoteTotalsRowModel({
            model: 'Övrigt: Kundens helt egna kostnad',
            source: { type: 'custom', index: 0 }
        }, 'en')).toBe('Other: Kundens helt egna kostnad');
    });

    it('localizes the fixed PDF group without changing Swedish group names', () => {
        expect(translateGroupLabel('ClickitUpFixed', 'en')).toBe('CiUFixed');
        expect(translateGroupLabel('ClickitUpFixed', 'sv')).toBe('ClickitUpFixed');
    });

    it('localizes stored Swedish validity periods without changing quote state text', () => {
        expect(formatLocalizedValidityPeriod('60 dagar', 'en')).toBe('60 days');
        expect(formatLocalizedValidityPeriod('1 dag', 'en')).toBe('1 day');
        expect(formatLocalizedValidityPeriod('60 dagar', 'sv')).toBe('60 dagar');
        expect(formatLocalizedValidityPeriod('Enligt överenskommelse', 'en')).toBe('Enligt överenskommelse');
    });
});
