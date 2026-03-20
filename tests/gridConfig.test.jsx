import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuoteProvider } from '../src/store/QuoteContext.jsx';
import { QUOTE_STATE_STORAGE_KEY } from '../src/store/quoteStateSchema.js';
import { GridConfig } from '../src/components/features/GridConfig.jsx';

function stubLocalStorage(serializedState) {
    const storage = new Map();
    if (serializedState !== undefined) {
        storage.set(QUOTE_STATE_STORAGE_KEY, serializedState);
    }

    const localStorageMock = {
        getItem: vi.fn((key) => (storage.has(key) ? storage.get(key) : null)),
        setItem: vi.fn((key, value) => storage.set(key, value)),
        removeItem: vi.fn((key) => storage.delete(key)),
        clear: vi.fn(() => storage.clear())
    };

    Object.defineProperty(globalThis, 'localStorage', {
        value: localStorageMock,
        configurable: true,
        writable: true
    });
}

function renderGridConfig(state) {
    stubLocalStorage(JSON.stringify(state));
    return renderToStaticMarkup(
        <QuoteProvider>
            <GridConfig lineId="ClickitUP" />
        </QuoteProvider>
    );
}

describe('GridConfig auto-scale add-ons', () => {
    beforeEach(() => {
        stubLocalStorage();
    });

    it('renders auto-sync controls for ClickitUp recommended add-ons by default', () => {
        const html = renderGridConfig({
            globalDiscountPct: 0,
            gridSelections: {
                ClickitUP: {
                    items: {
                        'ClickitUP Section|1500': { qty: 4, discountPct: 0 },
                        'ClickitUP Section|1600': { qty: 3, discountPct: 0 }
                    },
                    addons: {}
                }
            }
        });

        expect(html).toContain('Svartanodiserade profiler');
        expect(html).toContain('Stoppknapp 140 cm');
        expect((html.match(/aria-pressed=\"true\"/g) || []).length).toBe(2);
        expect((html.match(/value=\"7\"/g) || []).length).toBeGreaterThanOrEqual(2);
    });

    it('renders a manual auto-scale row as inactive while leaving missing rows auto', () => {
        const html = renderGridConfig({
            globalDiscountPct: 0,
            gridSelections: {
                ClickitUP: {
                    items: {
                        'ClickitUP Section|1500': { qty: 4, discountPct: 0 },
                        'ClickitUP Section|1600': { qty: 3, discountPct: 0 }
                    },
                    addons: {
                        svartanodiserade: { qty: 4, discountPct: 0, syncMode: 'manual' }
                    }
                }
            }
        });

        expect(html).toContain('Svartanodiserade profiler');
        expect(html).toContain('Stoppknapp 140 cm');
        expect(html).toContain('aria-pressed="false"');
        expect(html).toContain('aria-pressed="true"');
    });

    it('renders add-row actions and persisted custom add-ons inside categories', () => {
        const html = renderGridConfig({
            globalDiscountPct: 5,
            gridSelections: {
                ClickitUP: {
                    items: {},
                    addons: {},
                    customAddonsByCategory: {
                        recommended: [
                            { id: 'custom_1', name: 'Egen profil', price: 680, qty: 2, discountPct: 5 }
                        ]
                    }
                }
            }
        });

        expect(html).toContain('Lägg till egen rad');
        expect(html).toContain('Egen profil');
        expect(html).toContain('value="680"');
        expect(html).toContain('value="2"');
    });
});
