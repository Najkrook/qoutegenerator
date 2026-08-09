import { describe, expect, it } from 'vitest';
import { planBahamaQrBackfill } from '../scripts/backfill-bahama-qr.mjs';

describe('BaHaMa QR backfill', () => {
    it('assigns missing IDs and builds active projections without changing warehouse IDs', () => {
        const plan = planBahamaQrBackfill({
            notes: 'Behåll',
            bahamaV2: [{
                id: 'BA-001',
                type: 'Jumbrella',
                size: '4x4',
                status: 'available',
                properties: {}
            }]
        });
        expect(plan.assignedQrIds).toBe(1);
        expect(plan.inventory.notes).toBe('Behåll');
        expect(plan.inventory.bahamaV2[0].id).toBe('BA-001');
        expect(plan.projections[0]).toEqual(expect.objectContaining({ active: true, inventoryId: 'BA-001' }));
    });

    it('fails before writes when existing identifiers are duplicated', () => {
        const qrId = 'd1d3ba1f-bdee-4f45-8f63-04b379e3d45b';
        expect(() => planBahamaQrBackfill({ bahamaV2: [
            { id: 'BA-001', qrId },
            { id: 'BA-002', qrId }
        ] })).toThrow(/Dubblett av QR-ID/);
    });
});
