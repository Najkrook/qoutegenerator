import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

function readThemeVariables(selector) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n\\}`));
    expect(match, `Missing theme block for ${selector}`).toBeTruthy();

    return Object.fromEntries(
        Array.from(match[1].matchAll(/--([\w-]+):\s*([^;]+);/g))
            .map((entry) => [entry[1], entry[2].trim()])
    );
}

function relativeLuminance(hex) {
    const channels = hex.match(/[a-f\d]{2}/gi).map((channel) => (
        Number.parseInt(channel, 16) / 255
    )).map((channel) => (
        channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4
    ));

    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
    const firstLuminance = relativeLuminance(first);
    const secondLuminance = relativeLuminance(second);
    const lighter = Math.max(firstLuminance, secondLuminance);
    const darker = Math.min(firstLuminance, secondLuminance);
    return (lighter + 0.05) / (darker + 0.05);
}

const requiredThemeTokens = [
    'theme-action',
    'theme-action-hover',
    'theme-action-active',
    'theme-action-soft',
    'theme-action-soft-text',
    'theme-brand-solid',
    'theme-brand-emphasis',
    'theme-canvas',
    'theme-surface',
    'theme-surface-raised',
    'theme-surface-active',
    'theme-input',
    'theme-hover',
    'theme-border',
    'theme-control-border',
    'theme-focus-ring',
    'theme-text',
    'theme-text-muted',
    'theme-text-subtle',
    'theme-text-inverse',
    'theme-success-bg',
    'theme-success-border',
    'theme-success-text',
    'theme-warning-bg',
    'theme-warning-border',
    'theme-warning-text',
    'theme-danger-bg',
    'theme-danger-border',
    'theme-danger-text',
    'theme-info-bg',
    'theme-info-border',
    'theme-info-text'
];

describe('design token contract', () => {
    it('defines the semantic contract and legacy aliases used during migration', () => {
        for (const token of requiredThemeTokens) {
            expect(css).toContain(`--${token}:`);
        }

        expect(css).toContain('--color-input-bg: var(--theme-input);');
        expect(css).toContain('--color-panel-hover: var(--theme-hover);');
        expect(css).toContain('--color-secondary: var(--theme-secondary);');
    });

    it('keeps primary text, actions, focus rings, and control borders at accessible contrast', () => {
        const dark = readThemeVariables('[data-theme="portal-dark"]');
        const light = readThemeVariables('[data-theme="brixx-light"]');

        expect(contrastRatio(dark['theme-text'], dark['theme-surface-raised'])).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(dark['theme-text-muted'], dark['theme-surface-raised'])).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(light['theme-text'], light['theme-surface-raised'])).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(light['theme-text-muted'], light['theme-surface-raised'])).toBeGreaterThanOrEqual(4.5);

        expect(contrastRatio(dark['theme-text-inverse'], dark['theme-action'])).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(light['theme-text-inverse'], light['theme-action'])).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(dark['theme-focus-ring'], dark['theme-surface-raised'])).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(light['theme-focus-ring'], light['theme-surface-raised'])).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(dark['theme-control-border'], dark['theme-input'])).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(light['theme-control-border'], light['theme-input'])).toBeGreaterThanOrEqual(3);
    });

    it('includes keyboard, reduced-motion, and forced-colors safeguards', () => {
        expect(css).toContain('[contenteditable]');
        expect(css).toContain('@media (prefers-reduced-motion: reduce)');
        expect(css).toContain('@media (forced-colors: active)');
        expect(css).toContain('outline-color: CanvasText');
    });
});
