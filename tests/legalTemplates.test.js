import { describe, expect, it } from 'vitest';
import {
    LEGAL_TEMPLATES,
    DEFAULT_TEMPLATE_ID,
    getTemplateById,
    isLegalTemplateId
} from '../src/features/legalTemplates';

describe('legalTemplates', () => {
    it('contains selectable Swedish and English built-in templates', () => {
        expect(LEGAL_TEMPLATES).toHaveLength(2);
        expect(LEGAL_TEMPLATES.map((template) => template.id)).toEqual([
            'standard',
            'standard_en'
        ]);
        expect(LEGAL_TEMPLATES.map((template) => template.label)).toEqual([
            'Standardvillkor',
            'Standard terms (English)'
        ]);
    });

    it('falls back to default template for unknown id', () => {
        const fallback = getTemplateById('does-not-exist');
        expect(fallback.id).toBe(DEFAULT_TEMPLATE_ID);
        expect(typeof fallback.body).toBe('string');
        expect(fallback.body.length).toBeGreaterThan(20);
    });

    it('validates known template ids', () => {
        expect(isLegalTemplateId('standard')).toBe(true);
        expect(isLegalTemplateId('standard_en')).toBe(true);
        expect(isLegalTemplateId('missing')).toBe(false);
    });

    it('uses localized standard terms bodies for the built-in templates', () => {
        const swedish = LEGAL_TEMPLATES.find((template) => template.id === 'standard');
        const english = LEGAL_TEMPLATES.find((template) => template.id === 'standard_en');

        expect(swedish.body).toContain('Samtliga priser i offerten anges i SEK exklusive moms');
        expect(swedish.body).toContain('Betalningsvilkor lämnas efter utförd kreditprövning');
        expect(swedish.body).toContain('Kundunika eller specialbeställda produkter');
        expect(swedish.body).toContain('force majeure');
        expect(english.body).toContain('All prices in the quote are stated in SEK excluding VAT');
        expect(english.body).toContain('Payment terms are provided after completed credit approval');
        expect(english.body).toContain('Customer-specific or specially ordered products');
        expect(english.body).toContain('force majeure');
    });

    it('does not contain mojibake or stray emoji markers', () => {
        LEGAL_TEMPLATES.forEach((template) => {
            expect(template.label).not.toMatch(/[ÃƒÃ¢Ã°Å¸]/);
            expect(template.body).not.toMatch(/[ÃƒÃ¢Ã°Å¸]/);
        });
    });
});
