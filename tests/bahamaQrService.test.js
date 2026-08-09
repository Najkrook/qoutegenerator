import { beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseMocks = vi.hoisted(() => ({
    db: {},
    doc: vi.fn((_db, collection, id) => `${collection}/${id}`),
    getDoc: vi.fn()
}));

vi.mock('../src/services/firebase', () => firebaseMocks);

import {
    createBahamaQrId,
    ensureBahamaQrIds,
    getBahamaQrUrl,
    isBahamaQrId,
    normalizeBahamaQrRecord,
    parseBahamaQrInput,
    stageBahamaQrProjectionWrites,
    toBahamaQrActiveRecord
} from '../src/services/bahamaQrService';

const QR_ID = 'd1d3ba1f-bdee-4f45-8f63-04b379e3d45b';

function item(overrides = {}) {
    return {
        qrId: QR_ID,
        id: 'BA-001',
        type: 'Jumbrella',
        size: '4 × 4 m',
        status: 'available',
        location: 'A-12',
        properties: { stativ: 'RAL 7016', textil: 'MUSHROOM', fot: 'TIPP', belysning: 'Classic Light', varme: 'Infra' },
        comment: 'Kontrollerad',
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-02T10:00:00.000Z',
        updatedByUid: 'admin-1',
        updatedByEmail: 'admin@example.com',
        ...overrides
    };
}

describe('bahamaQrService', () => {
    beforeEach(() => vi.clearAllMocks());

    it('creates UUID v4 identifiers and assigns only missing IDs', () => {
        const generated = createBahamaQrId();
        expect(isBahamaQrId(generated)).toBe(true);
        const [existing, assigned] = ensureBahamaQrIds([item(), item({ id: 'BA-002', qrId: '' })]);
        expect(existing.qrId).toBe(QR_ID);
        expect(isBahamaQrId(assigned.qrId)).toBe(true);
    });

    it('rejects duplicate identifiers instead of silently changing existing links', () => {
        expect(() => ensureBahamaQrIds([item(), item({ id: 'BA-002' })])).toThrow(/Dubblett/);
    });

    it('parses raw IDs and same-origin detail links while rejecting external links', () => {
        expect(parseBahamaQrInput(QR_ID, 'https://lager.brixx.se')).toBe(QR_ID);
        expect(getBahamaQrUrl(QR_ID, 'https://lager.brixx.se')).toBe(`https://lager.brixx.se/p/${QR_ID}`);
        expect(parseBahamaQrInput(`https://lager.brixx.se/p/${QR_ID}`, 'https://lager.brixx.se')).toBe(QR_ID);
        expect(parseBahamaQrInput(`https://evil.example/p/${QR_ID}`, 'https://lager.brixx.se')).toBeNull();
    });

    it('builds a full active projection and a minimal archived projection write', () => {
        expect(toBahamaQrActiveRecord(item())).toEqual(expect.objectContaining({
            schemaVersion: 1,
            qrId: QR_ID,
            inventoryId: 'BA-001',
            active: true,
            properties: expect.objectContaining({ fot: 'TIPP' })
        }));

        const batch = { set: vi.fn() };
        stageBahamaQrProjectionWrites(batch, [], [item()], '2026-08-09T10:00:00.000Z');
        expect(batch.set).toHaveBeenCalledWith(`bahama_qr_items/${QR_ID}`, {
            schemaVersion: 1,
            qrId: QR_ID,
            inventoryId: 'BA-001',
            active: false,
            archivedAt: '2026-08-09T10:00:00.000Z',
            updatedAt: '2026-08-09T10:00:00.000Z'
        });
    });

    it('normalizes only supported projection shapes', () => {
        const active = toBahamaQrActiveRecord(item());
        expect(normalizeBahamaQrRecord(active, QR_ID)).toEqual(active);
        expect(normalizeBahamaQrRecord({ ...active, status: 'unknown' }, QR_ID)).toBeNull();
        expect(normalizeBahamaQrRecord({ ...active, qrId: 'other' }, QR_ID)).toBeNull();
    });
});
