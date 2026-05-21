import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/activityLogService', () => ({
    safeLogActivity: vi.fn(async () => ({ ok: true }))
}));

import {
    createRetailerDocumentService,
    normalizeRetailerDocumentKind
} from '../src/services/retailerDocumentService';
import { createFirestoreMock } from './fixtures/firestoreMock';

function buildService(initialDocs = {}) {
    const mock = createFirestoreMock(initialDocs);
    const service = createRetailerDocumentService(mock);
    return { service, mock };
}

describe('retailerDocumentService', () => {
    it('normalizes, sorts, and persists retailer line documents while ignoring invalid rows', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-21T09:00:00.000Z'));

        const { service, mock } = buildService();
        const saved = await service.saveRetailerLineDocuments({
            lineId: 'BaHaMa',
            user: { uid: 'admin-1', email: 'admin@example.com' },
            documents: [
                {
                    title: 'Installationsguide',
                    kind: 'installation-instructions',
                    url: 'https://cdn.example.com/bahama/install.pdf',
                    fileName: 'install.pdf',
                    sortOrder: 2
                },
                {
                    title: '',
                    kind: 'color-chart',
                    url: 'https://cdn.example.com/bahama/ignored.pdf',
                    sortOrder: 1
                },
                {
                    title: 'Färgkarta Sand',
                    kind: 'bad-kind',
                    url: 'https://cdn.example.com/bahama/colors.pdf',
                    sortOrder: 1
                }
            ]
        });

        expect(saved.lineId).toBe('BaHaMa');
        expect(saved.documents).toHaveLength(2);
        expect(saved.documents.map((document) => document.title)).toEqual(['Färgkarta Sand', 'Installationsguide']);
        expect(saved.documents[0]).toMatchObject({
            kind: 'color-chart',
            fileName: 'colors.pdf'
        });
        expect(mock.__docs.get('retailer_line_documents/BaHaMa')).toMatchObject({
            lineId: 'BaHaMa',
            updatedByUid: 'admin-1'
        });

        vi.useRealTimers();
    });

    it('returns document records for multiple product lines while preserving requested order', async () => {
        const { service } = buildService({
            'retailer_line_documents/BaHaMa': {
                lineId: 'BaHaMa',
                documents: [{
                    id: 'bahama-1',
                    title: 'Färgkarta',
                    kind: 'color-chart',
                    url: 'https://cdn.example.com/bahama/colors.pdf',
                    fileName: 'bahama-colors.pdf',
                    sortOrder: 0
                }],
                updatedAt: 100,
                updatedBy: 'admin@example.com',
                updatedByUid: 'admin-1'
            }
        });

        const records = await service.getRetailerDocumentsForLines({
            lineIds: ['ClickitUp', 'BaHaMa']
        });

        expect(records.map((record) => record.lineId)).toEqual(['ClickitUp', 'BaHaMa']);
        expect(records[0].documents).toEqual([]);
        expect(records[1].documents[0].fileName).toBe('bahama-colors.pdf');
    });

    it('lists all saved retailer line documents for admin configuration', async () => {
        const { service } = buildService({
            'retailer_line_documents/BaHaMa': {
                lineId: 'BaHaMa',
                documents: [{
                    id: 'bahama-1',
                    title: 'Färgkarta',
                    kind: 'color-chart',
                    url: 'https://cdn.example.com/bahama/colors.pdf',
                    fileName: 'bahama-colors.pdf',
                    sortOrder: 0
                }],
                updatedAt: 100,
                updatedBy: 'admin@example.com',
                updatedByUid: 'admin-1'
            },
            'retailer_line_documents/ClickitUp': {
                lineId: 'ClickitUp',
                documents: [{
                    id: 'clickitup-1',
                    title: 'Installation',
                    kind: 'installation-instructions',
                    url: 'https://cdn.example.com/clickitup/install.pdf',
                    fileName: 'clickitup-install.pdf',
                    sortOrder: 0
                }],
                updatedAt: 110,
                updatedBy: 'admin@example.com',
                updatedByUid: 'admin-1'
            }
        });

        const listed = await service.listRetailerLineDocuments();
        expect(listed).toHaveLength(2);
        expect(listed.map((record) => record.lineId)).toEqual(['BaHaMa', 'ClickitUp']);
    });

    it('normalizes unknown document kinds back to color-chart', () => {
        expect(normalizeRetailerDocumentKind('installation-instructions')).toBe('installation-instructions');
        expect(normalizeRetailerDocumentKind('COLOR-CHART')).toBe('color-chart');
        expect(normalizeRetailerDocumentKind('unknown-kind')).toBe('color-chart');
    });
});
