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
        selectedLines: ['BaHaMa'],
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
});
