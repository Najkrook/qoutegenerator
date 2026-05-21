// @vitest-environment jsdom

import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const retailerServiceMocks = vi.hoisted(() => ({
    fetchRetailers: vi.fn(async () => []),
    createRetailer: vi.fn(),
    updateRetailer: vi.fn(),
    deleteRetailer: vi.fn(),
    normalizeRetailerData: vi.fn(() => ({}))
}));

const retailerDocumentMocks = vi.hoisted(() => ({
    listRetailerLineDocuments: vi.fn(async () => []),
    saveRetailerLineDocuments: vi.fn(async ({ lineId, documents, user }) => ({
        lineId,
        documents,
        updatedAt: 100,
        updatedBy: user?.email || '',
        updatedByUid: user?.uid || ''
    }))
}));

const notificationMocks = vi.hoisted(() => ({
    notifySuccess: vi.fn()
}));

vi.mock('../src/services/retailerService', () => retailerServiceMocks);
vi.mock('../src/services/retailerDocumentService', () => ({
    getRetailerDocumentKindLabel: (kind) => (
        kind === 'installation-instructions' ? 'Installationsinstruktion' : 'Färgkarta'
    ),
    retailerDocumentService: retailerDocumentMocks
}));
vi.mock('../src/services/authService', () => ({
    createRetailerAuthUser: vi.fn()
}));
vi.mock('../src/services/notificationService', () => notificationMocks);

import { RetailerManager } from '../src/views/RetailerManager';
import { AuthContext } from '../src/store/AuthContext';

const mountedRoots = [];

function createAuthValue(overrides = {}) {
    return {
        user: { uid: 'admin-1', email: 'admin@example.com' },
        loading: false,
        accessLevel: 'full',
        canViewEverything: true,
        canStartQuote: true,
        canAccessSketch: true,
        canAccessQuoteHistory: true,
        canExportSketchToQuote: true,
        login: vi.fn(),
        logout: vi.fn(),
        retailer: null,
        isRetailer: false,
        ...overrides
    };
}

async function flushUi() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
}

async function renderRetailerManager() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
        root.render(
            <AuthContext.Provider value={createAuthValue()}>
                <RetailerManager onBack={() => {}} />
            </AuthContext.Provider>
        );
    });
    await flushUi();

    mountedRoots.push({ root, container });
    return { container };
}

function getLineSection(container, lineLabel) {
    const section = Array.from(container.querySelectorAll('section')).find((candidate) => (
        candidate.querySelector('h4')?.textContent?.includes(lineLabel)
    ));

    expect(section).toBeTruthy();
    return section;
}

function getButtonByText(scope, label) {
    const button = Array.from(scope.querySelectorAll('button')).find((candidate) => (
        candidate.textContent?.includes(label)
    ));

    expect(button).toBeTruthy();
    return button;
}

async function setFieldValue(field, value) {
    await act(async () => {
        const prototype = field instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        descriptor?.set?.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
    });
}

beforeEach(() => {
    retailerServiceMocks.fetchRetailers.mockReset();
    retailerServiceMocks.fetchRetailers.mockResolvedValue([]);
    retailerDocumentMocks.listRetailerLineDocuments.mockReset();
    retailerDocumentMocks.listRetailerLineDocuments.mockResolvedValue([]);
    retailerDocumentMocks.saveRetailerLineDocuments.mockReset();
    retailerDocumentMocks.saveRetailerLineDocuments.mockImplementation(async ({ lineId, documents, user }) => ({
        lineId,
        documents,
        updatedAt: 100,
        updatedBy: user?.email || '',
        updatedByUid: user?.uid || ''
    }));
    notificationMocks.notifySuccess.mockReset();
});

afterEach(() => {
    while (mountedRoots.length > 0) {
        const mounted = mountedRoots.pop();
        act(() => {
            mounted.root.unmount();
        });
        mounted.container.remove();
    }
    vi.clearAllMocks();
});

describe('RetailerManager document admin', () => {
    it('lets admins add, edit, and save product-line documents', async () => {
        const { container } = await renderRetailerManager();
        const baHaMaSection = getLineSection(container, 'BaHaMa');

        await act(async () => {
            getButtonByText(baHaMaSection, 'Lägg till dokument').click();
        });

        await setFieldValue(
            baHaMaSection.querySelector('input[placeholder="T.ex. Färgkarta Markisväv"]'),
            'Färgkarta Premium'
        );
        await setFieldValue(
            baHaMaSection.querySelector('input[placeholder="https://..."]'),
            'https://cdn.example.com/bahama/premium.pdf'
        );
        await setFieldValue(
            baHaMaSection.querySelector('input[placeholder="fargkarta.pdf"]'),
            'premium.pdf'
        );

        await act(async () => {
            getButtonByText(baHaMaSection, 'Spara dokument').click();
            await Promise.resolve();
        });

        expect(retailerDocumentMocks.saveRetailerLineDocuments).toHaveBeenCalledWith(expect.objectContaining({
            lineId: 'BaHaMa',
            user: expect.objectContaining({ uid: 'admin-1' }),
            documents: [expect.objectContaining({
                title: 'Färgkarta Premium',
                url: 'https://cdn.example.com/bahama/premium.pdf',
                fileName: 'premium.pdf'
            })]
        }));
        expect(notificationMocks.notifySuccess).toHaveBeenCalled();
    });

    it('lets admins remove an existing product-line document row', async () => {
        retailerDocumentMocks.listRetailerLineDocuments.mockResolvedValueOnce([{
            lineId: 'BaHaMa',
            documents: [{
                id: 'bahama-doc-1',
                title: 'Installationsguide',
                kind: 'installation-instructions',
                url: 'https://cdn.example.com/bahama/install.pdf',
                fileName: 'install.pdf',
                description: '',
                sortOrder: 0
            }],
            updatedAt: 100,
            updatedBy: 'admin@example.com',
            updatedByUid: 'admin-1'
        }]);

        const { container } = await renderRetailerManager();
        const baHaMaSection = getLineSection(container, 'BaHaMa');

        expect(baHaMaSection.querySelector('input[placeholder="T.ex. Färgkarta Markisväv"]').value).toBe('Installationsguide');

        await act(async () => {
            getButtonByText(baHaMaSection, 'Ta bort dokument').click();
        });

        expect(baHaMaSection.textContent).not.toContain('Installationsguide');
        expect(baHaMaSection.textContent).toContain('Lägg till de PDF-länkar som ska visas för retailers med denna produktlinje.');
    });
});
