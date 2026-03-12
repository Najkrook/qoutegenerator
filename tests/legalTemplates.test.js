import { describe, expect, it } from 'vitest';
import {
    LEGAL_TEMPLATES,
    DEFAULT_TEMPLATE_ID,
    getTemplateById,
    isLegalTemplateId
} from '../src/features/legalTemplates.js';

describe('legalTemplates', () => {
    it('contains three selectable templates', () => {
        expect(LEGAL_TEMPLATES).toHaveLength(3);
        expect(LEGAL_TEMPLATES.map((template) => template.id)).toEqual([
            'standard',
            'service_work',
            'project_delivery'
        ]);
        expect(LEGAL_TEMPLATES.map((template) => template.label)).toEqual([
            'Standardvillkor',
            'Standardvillkor (tidigare service)',
            'Standardvillkor (tidigare projekt)'
        ]);
    });

    it('falls back to default template for unknown id', () => {
        const fallback = getTemplateById('does-not-exist');
        expect(fallback.id).toBe(DEFAULT_TEMPLATE_ID);
        expect(typeof fallback.body).toBe('string');
        expect(fallback.body.length).toBeGreaterThan(20);
    });

    it('validates known template ids', () => {
        expect(isLegalTemplateId('service_work')).toBe(true);
        expect(isLegalTemplateId('missing')).toBe(false);
    });

    it('uses the same main body for all built-in templates', () => {
        const bodies = LEGAL_TEMPLATES.map((template) => template.body);
        expect(new Set(bodies).size).toBe(1);
        expect(bodies[0]).toContain('Samtliga priser i offerten anges i SEK exklusive moms');
        expect(bodies[0]).toContain('Betalning sker mot faktura med 30 dagars netto');
        expect(bodies[0]).toContain('Kundunika eller specialbeställda produkter');
        expect(bodies[0]).toContain('force majeure');
    });

    it('does not contain mojibake or stray emoji markers', () => {
        LEGAL_TEMPLATES.forEach((template) => {
            expect(template.label).not.toMatch(/[ÃâðŸ]/);
            expect(template.body).not.toMatch(/[ÃâðŸ]/);
        });
    });
});
