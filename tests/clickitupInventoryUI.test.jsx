// @vitest-environment jsdom

import React, { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ClickitupAccessoryStock } from '../src/components/features/ClickitupAccessoryStock';
import { ClickitupStockGrid } from '../src/components/features/ClickitupStockGrid';
import {
    getOpeningAccessoryBalances,
    setClickitupAccessoryQuantity,
    setClickitupSizeQuantity,
    toggleClickitupCounted
} from '../src/services/clickitupInventory';
import { createDefaultInventoryData } from '../src/views/inventoryData';

afterEach(cleanup);

function AccessoriesHarness() {
    const [inventory, setInventory] = useState(() => ({ ...createDefaultInventoryData(), clickitupAccessories: getOpeningAccessoryBalances() }));
    return <ClickitupAccessoryStock
        inventoryData={inventory}
        cloudInventoryData={createDefaultInventoryData()}
        onSetStock={(id, value) => setInventory((current) => setClickitupAccessoryQuantity(current, id, value))}
        onToggleCounted={(id) => setInventory((current) => toggleClickitupCounted(current, 'accessory', id))}
    />;
}

function SectionsHarness() {
    const [inventory, setInventory] = useState(createDefaultInventoryData);
    return <ClickitupStockGrid
        inventoryData={inventory}
        cloudInventoryData={createDefaultInventoryData()}
        onSetStock={(size, field, value) => setInventory((current) => setClickitupSizeQuantity(current, size, field, value))}
        onToggleCounted={(type, id) => setInventory((current) => toggleClickitupCounted(current, type, id))}
    />;
}

describe('ClickitUp counting controls', () => {
    it('shows grouped Excel accessories and supports tap, direct entry and recount', () => {
        render(<AccessoriesHarness />);
        expect(screen.getByRole('region', { name: 'Stickfötter' })).toBeTruthy();
        expect(screen.getByRole('region', { name: 'Gångjärn' })).toBeTruthy();
        expect(screen.getByRole('region', { name: 'Stolpe och smådelar' })).toBeTruthy();
        const input = screen.getByRole('textbox', { name: 'Antal Standard Singel' });
        expect(input.value).toBe('206');
        fireEvent.click(screen.getByRole('button', { name: 'Öka Standard Singel med 1' }));
        expect(input.value).toBe('207');
        fireEvent.change(input, { target: { value: '300' } });
        fireEvent.blur(input);
        expect(input.value).toBe('300');
        fireEvent.click(screen.getByRole('button', { name: 'Standard Singel: ej räknad' }));
        expect(screen.getByRole('button', { name: 'Standard Singel: räknad' }).getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(screen.getByRole('button', { name: 'Minska Standard Singel med 1' }));
        expect(input.value).toBe('299');
        expect(screen.getByRole('button', { name: 'Standard Singel: ej räknad' }).getAttribute('aria-pressed')).toBe('false');
    });

    it('provides one mobile card per size with all five quantities and a completion action', () => {
        render(<SectionsHarness />);
        const card = within(screen.getByRole('region', { name: 'Storlek 700' }));
        expect(card.getByText('Dörr H')).toBeTruthy();
        expect(card.getByText('Hane V')).toBeTruthy();
        fireEvent.click(card.getByRole('button', { name: 'Öka Sektion 700 med 1' }));
        expect(card.getByRole('textbox', { name: 'Antal Sektion 700' }).value).toBe('1');
        fireEvent.click(card.getByRole('button', { name: 'Storlek 700: ej räknad' }));
        expect(card.getByRole('button', { name: 'Storlek 700: räknad' }).getAttribute('aria-pressed')).toBe('true');
        fireEvent.click(card.getByRole('button', { name: 'Öka Dörr H 700 med 1' }));
        expect(card.getByRole('button', { name: 'Storlek 700: ej räknad' })).toBeTruthy();
    });
});
