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
});
