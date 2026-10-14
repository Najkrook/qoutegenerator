// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { QuoteProvider, useQuote } from '../src/store/QuoteContext';
import { quoteContentSignature } from '../src/store/quoteChangeTracking';
import { loadPersistedQuoteWorkspace } from '../src/store/quoteStatePersistence';

let current;
function Probe() {
    current = useQuote();
    return <span>{current.hasUnsavedChanges ? 'dirty' : 'clean'}</span>;
}
afterEach(() => { cleanup(); localStorage.clear(); });

it('keeps save status across reload and owner switches, including an immediate pagehide', () => {
    const view = render(<QuoteProvider ownerUid="user-a"><Probe /></QuoteProvider>);
    expect(view.container.textContent).toBe('clean');
    act(() => current.dispatch({ type: 'UPDATE_CUSTOMER_INFO', payload: { company: 'Customer A' } }));
    const savedSignature = quoteContentSignature(current.state);
    const generation = current.workspaceGeneration;
    act(() => current.dispatch({ type: 'QUOTE_SAVED', payload: { generation, savedSignature,
        statePatch: { activeQuoteId: 'quote-a', activeQuoteVersion: 1, quoteNumber: 'A', quoteStatus: 'draft' }
    } }));
    expect(view.container.textContent).toBe('clean');
    act(() => window.dispatchEvent(new Event('pagehide')));
    expect(loadPersistedQuoteWorkspace('user-a').savedSignature).toBe(savedSignature);
    view.unmount();
    const restored = render(<QuoteProvider ownerUid="user-a"><Probe /></QuoteProvider>);
    expect(restored.container.textContent).toBe('clean');
    act(() => current.dispatch({ type: 'UPDATE_CUSTOMER_INFO', payload: { company: 'Changed A' } }));
    expect(restored.container.textContent).toBe('dirty');
    restored.rerender(<QuoteProvider ownerUid="user-b"><Probe /></QuoteProvider>);
    expect(restored.container.textContent).toBe('clean');
    expect(current.state.customerInfo.company).toBe('');
    restored.rerender(<QuoteProvider ownerUid="user-a"><Probe /></QuoteProvider>);
    expect(restored.container.textContent).toBe('dirty');
    expect(current.state.customerInfo.company).toBe('Changed A');
});
