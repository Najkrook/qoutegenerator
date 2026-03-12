import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../src/features/utils.js';

describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
        const value = `<script>alert("x") & 'y'</script>`;
        const escaped = escapeHtml(value);

        expect(escaped).toBe('&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;');
    });

    it('handles nullish inputs safely', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });
});
