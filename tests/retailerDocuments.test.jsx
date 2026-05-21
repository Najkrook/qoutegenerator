// @vitest-environment jsdom

import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const retailerDocumentMocks = vi.hoisted(() => ({
    getRetailerDocumentsForLines: vi.fn(async () => [])
}));

const notificationMocks = vi.hoisted(() => ({
    notifyError: vi.fn(),
    notifySuccess: vi.fn()
}));

const fileUtilsMocks = vi.hoisted(() => ({
    downloadBlob: vi.fn()
}));

vi.mock('../src/services/retailerDocumentService', () => ({
    getRetailerDocumentKindLabel: (kind) => (
        kind === 'installation-instructions' ? 'Installationsinstruktion' : 'Färgkarta'
    ),
    retailerDocumentService: {
        getRetailerDocumentsForLines: retailerDocumentMocks.getRetailerDocumentsForLines
    }
}));

vi.mock('../src/services/notificationService', () => notificationMocks);
vi.mock('../src/utils/fileUtils', () => fileUtilsMocks);

import { RetailerDocuments } from '../src/views/RetailerDocuments';
import { AuthContext } from '../src/store/AuthContext';

const mountedRoots = [];

function createAuthValue(overrides = {}) {
    return {
        user: { uid: 'retailer-1', email: 'retailer@example.com' },
        loading: false,
        accessLevel: 'retailer',
        canViewEverything: false,
        canStartQuote: true,
        canAccessSketch: false,
        canAccessQuoteHistory: true,
        canExportSketchToQuote: false,
        login: vi.fn(),
        logout: vi.fn(),
        retailer: {
            id: 'retailer_1',
            name: 'Markishuset',
            email: 'retailer@example.com',
            productLines: {
                BaHaMa: { enabled: true, discountPct: 12 },
                ClickitUp: { enabled: false, discountPct: 0 },
                Fiesta: { enabled: true, discountPct: 8 }
            }
        },
        isRetailer: true,
        ...overrides
    };
}

async function flushUi() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
}

async function renderRetailerDocuments(authOverrides = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
        root.render(
            <AuthContext.Provider value={createAuthValue(authOverrides)}>
                <RetailerDocuments onBack={() => {}} />
            </AuthContext.Provider>
        );
    });
    await flushUi();

    mountedRoots.push({ root, container });
    return { container };
}

function findButton(container, label) {
    const button = Array.from(container.querySelectorAll('button')).find((candidate) => (
        candidate.textContent?.includes(label)
    ));

    expect(button).toBeTruthy();
    return button;
}

beforeEach(() => {
    retailerDocumentMocks.getRetailerDocumentsForLines.mockReset();
    retailerDocumentMocks.getRetailerDocumentsForLines.mockResolvedValue([
        {
            lineId: 'BaHaMa',
            documents: [{
                id: 'bahama-colors',
                title: 'Färgkarta Akryl',
                kind: 'color-chart',
                url: 'https://cdn.example.com/bahama/colors.pdf',
                fileName: 'bahama-colors.pdf',
                description: 'Alla tillgängliga vävar för BaHaMa.',
                sortOrder: 0
            }],
            updatedAt: 100,
            updatedBy: 'admin@example.com',
            updatedByUid: 'admin-1'
        },
        {
            lineId: 'Fiesta',
            documents: [{
                id: 'fiesta-install',
                title: 'Installationsguide Fiesta',
                kind: 'installation-instructions',
                url: 'https://cdn.example.com/fiesta/install.pdf',
                fileName: 'fiesta-install.pdf',
                description: '',
                sortOrder: 0
            }],
            updatedAt: 110,
            updatedBy: 'admin@example.com',
            updatedByUid: 'admin-1'
        }
    ]);
    notificationMocks.notifyError.mockReset();
    notificationMocks.notifySuccess.mockReset();
    fileUtilsMocks.downloadBlob.mockReset();
    globalThis.fetch = vi.fn(async (url) => ({
        ok: true,
        blob: async () => new Blob([String(url)])
    }));
    globalThis.open = vi.fn();
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

describe('RetailerDocuments', () => {
    it('renders grouped documents for the retailer active product lines only', async () => {
        const { container } = await renderRetailerDocuments();

        expect(retailerDocumentMocks.getRetailerDocumentsForLines).toHaveBeenCalledWith({
            lineIds: ['BaHaMa', 'Fiesta']
        });
        expect(container.textContent).toContain('Produktdokument');
        expect(container.textContent).toContain('BaHaMa');
        expect(container.textContent).toContain('Fiesta');
        expect(container.textContent).toContain('Färgkarta Akryl');
        expect(container.textContent).toContain('Installationsguide Fiesta');
        expect(container.textContent).toContain('Visa PDF');
        expect(container.textContent).toContain('Ladda ner PDF');
        expect(container.textContent).not.toContain('ClickitUp');
    });

    it('renders an empty state when no product lines are active', async () => {
        const { container } = await renderRetailerDocuments({
            retailer: {
                id: 'retailer_1',
                name: 'Markishuset',
                email: 'retailer@example.com',
                productLines: {
                    BaHaMa: { enabled: false, discountPct: 0 },
                    Fiesta: { enabled: false, discountPct: 0 }
                }
            }
        });

        expect(retailerDocumentMocks.getRetailerDocumentsForLines).not.toHaveBeenCalled();
        expect(container.textContent).toContain('Inga produktlinjer är aktiva för ert retailer-konto ännu');
    });

    it('renders an empty state when active product lines have no published documents', async () => {
        retailerDocumentMocks.getRetailerDocumentsForLines.mockResolvedValueOnce([
            { lineId: 'BaHaMa', documents: [], updatedAt: 0, updatedBy: '', updatedByUid: '' },
            { lineId: 'Fiesta', documents: [], updatedAt: 0, updatedBy: '', updatedByUid: '' }
        ]);

        const { container } = await renderRetailerDocuments();
        expect(container.textContent).toContain('Det finns inga publicerade PDF-dokument för era aktiva produktlinjer ännu.');
    });

    it('opens documents in a new tab and downloads them as PDFs', async () => {
        const { container } = await renderRetailerDocuments();

        await act(async () => {
            findButton(container, 'Visa PDF').click();
        });
        expect(globalThis.open).toHaveBeenCalledWith(
            'https://cdn.example.com/bahama/colors.pdf',
            '_blank',
            'noopener,noreferrer'
        );

        await act(async () => {
            findButton(container, 'Ladda ner PDF').click();
            await Promise.resolve();
        });

        expect(globalThis.fetch).toHaveBeenCalledWith('https://cdn.example.com/bahama/colors.pdf');
        expect(fileUtilsMocks.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'bahama-colors.pdf');
        expect(notificationMocks.notifySuccess).toHaveBeenCalled();
    });
});
