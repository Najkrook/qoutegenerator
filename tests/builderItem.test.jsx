import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuoteProvider } from '../src/store/QuoteContext.jsx';
import { QUOTE_STATE_STORAGE_KEY } from '../src/store/quoteStateSchema.js';
import { BuilderItem } from '../src/components/features/BuilderItem.jsx';
import { catalogData } from '../src/data/catalog.js';

const baseItem = {
    id: 'item-1',
    line: 'BaHaMa',
    model: 'Jumbrella',
    size: '5x5 Kvadrat',
    qty: 1,
    addons: []
};

const installationItems = catalogData.BaHaMa.models.Jumbrella.addonCategories.find(
    (category) => category.name === 'Installationsalternativ'
)?.items ?? [];
const squareGutterItems = catalogData.BaHaMa.models.Jumbrella.addonCategories.find(
    (category) => category.name === 'Hängränna Kvadrat'
)?.items ?? [];
const miscItems = catalogData.BaHaMa.models.Jumbrella.addonCategories.find(
    (category) => category.name === 'Annat'
)?.items ?? [];

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

function renderBuilderItem(item) {
    stubLocalStorage(JSON.stringify({
        exchangeRate: 12.2,
        globalDiscountPct: 5,
        selectedLines: [item.line],
        builderItems: [item]
    }));

    return renderToStaticMarkup(
        <QuoteProvider>
            <BuilderItem item={item} index={0} onRemove={vi.fn()} />
        </QuoteProvider>
    );
}

describe('BuilderItem header add-on badge', () => {
    beforeEach(() => {
        stubLocalStorage();
    });

    it('hides the header badge when no add-ons are selected', () => {
        const html = renderBuilderItem(baseItem);

        expect(html).not.toContain('1 tillägg');
        expect(html).not.toContain('2 tillägg');
        expect(html).toContain('Inga valda');
    });

    it('renders a singular badge when one add-on is selected', () => {
        const html = renderBuilderItem({
            ...baseItem,
            addons: [{ id: 'gjuthylsa', qty: 1, discountPct: 5 }]
        });

        expect(html).toContain('1 tillägg');
        expect(html).toContain('1 valda');
        expect(html).toContain('1 vald');
    });

    it('renders the correct plural count and updates consistently as add-ons change', () => {
        const htmlWithThree = renderBuilderItem({
            ...baseItem,
            addons: [
                { id: installationItems[0].id, qty: 1, discountPct: 5 },
                { id: installationItems[1].id, qty: 1, discountPct: 5 },
                { id: installationItems[2].id, qty: 1, discountPct: 5 }
            ]
        });

        const htmlAfterRemoval = renderBuilderItem({
            ...baseItem,
            addons: [
                { id: installationItems[0].id, qty: 1, discountPct: 5 },
                { id: installationItems[1].id, qty: 1, discountPct: 5 }
            ]
        });

        expect(htmlWithThree).toContain('3 tillägg');
        expect(htmlWithThree).toContain('3 valda');
        expect(htmlWithThree).toContain('Installationsalternativ');
        expect(htmlAfterRemoval).toContain('2 tillägg');
        expect(htmlAfterRemoval).toContain('2 valda');
        expect(htmlAfterRemoval).toContain('Installationsalternativ');
    });

    it('renders add-row actions and custom builder add-ons inside categories', () => {
        const html = renderBuilderItem({
            ...baseItem,
            addons: [
                {
                    id: 'builder_custom_1',
                    qty: 2,
                    discountPct: 5,
                    isCustom: true,
                    name: 'Speciallack',
                    price: 900,
                    categoryId: 'installationsalternativ'
                }
            ]
        });

        expect(html).toContain('Lägg till egen rad');
        expect(html).toContain('Speciallack');
        expect(html).toContain('900');
        expect(html).toContain('1 tillägg');
    });

    it('includes the Jumbrella square gutter category with the expected sizes and prices', () => {
        expect(squareGutterItems).toEqual([
            { id: 'jumb_hang_kv_3x3', name: 'Hängränna 3x3', price: 620 },
            { id: 'jumb_hang_kv_35x35', name: 'Hängränna 3,5x3,5', price: 670 },
            { id: 'jumb_hang_kv_4x4', name: 'Hängränna 4x4', price: 710 },
            { id: 'jumb_hang_kv_45x45', name: 'Hängränna 4,5x4,5', price: 810 },
            { id: 'jumb_hang_kv_5x5', name: 'Hängränna 5x5', price: 830 },
            { id: 'jumb_hang_kv_6x6', name: 'Hängränna 6x6', price: 1060 }
        ]);
    });

    it('includes the 1m textile roll item under the Jumbrella misc category', () => {
        expect(miscItems).toEqual(
            expect.arrayContaining([
                { id: 'jumb_textil_roll_1m', name: '1m textile on roll', price: 50 }
            ])
        );
    });

    it('shows the pseudo category for models that only have flat add-ons', () => {
        const html = renderBuilderItem({
            id: 'fiesta-item',
            line: 'Fiesta',
            model: 'FIESTA Biogasstolpe 12 kW',
            size: 'Standard',
            qty: 1,
            addons: []
        });

        expect(html).toContain('Övriga tillval');
        expect(html).toContain('Lägg till egen rad');
    });
});
