import { describe, expect, it } from 'vitest';

import {
    buildActivityLogEntry,
    buildActivityLogFailureResult,
    buildActivityLogSuccessResult,
    formatActivityMetadata,
    getActivityEventDefinition,
    getActivityLogVisual,
    getActivitySystemLabel,
    isActivityLogFailure,
    normalizeActivityLog
} from '../src/services/activityLogService.js';

describe('activityLogService', () => {
    it('builds a normalized activity log entry for the authenticated user', () => {
        const entry = buildActivityLogEntry({
            user: { uid: 'user-1', email: 'sales@example.com' },
            eventType: 'quote_created',
            system: 'quote',
            targetType: 'quote',
            targetId: 'quote_123',
            details: 'Offert skapad och sparad i Mina Offerter.',
            metadata: {
                version: 1,
                customerName: 'Ada',
                reference: 'REF-7'
            }
        });

        expect(entry.userUid).toBe('user-1');
        expect(entry.user).toBe('sales@example.com');
        expect(entry.eventType).toBe('quote_created');
        expect(entry.system).toBe('quote');
        expect(entry.targetId).toBe('quote_123');
        expect(entry.metadata).toEqual({
            version: 1,
            customerName: 'Ada',
            reference: 'REF-7'
        });
        expect(typeof entry.createdAt).toBe('number');
        expect(entry.timestamp).toContain('T');
    });

    it('normalizes stored activity rows and resolves labels', () => {
        const row = normalizeActivityLog({
            id: 'log-1',
            data: () => ({
                createdAt: 1700000000000,
                timestamp: '2026-03-12T11:00:00.000Z',
                eventType: 'sketch_export_image',
                system: 'sketch',
                targetType: 'sketch',
                targetId: 'sketch_canvas',
                user: 'admin@example.com',
                userUid: 'uid-7',
                details: 'Ritningsbild nedladdad: skiss.png',
                metadata: { format: 'png', sectionCount: 5 }
            })
        });

        expect(row.id).toBe('log-1');
        expect(row.resolvedMs).toBe(1700000000000);
        expect(getActivitySystemLabel(row.system)).toBe('Ritning');
        expect(getActivityEventDefinition(row.eventType).label).toBe('Ritningsbild nedladdad');
        expect(getActivityLogVisual(row).icon).toBe('🖼️');
        expect(formatActivityMetadata(row.metadata)).toBe('PNG · 5 sektioner');
    });

    it('builds a structured success result when activity logging succeeds', () => {
        const result = buildActivityLogSuccessResult(
            { id: 'log-123' },
            {
            eventType: 'quote_created',
                system: 'quote'
            }
        );

        expect(result).toMatchObject({
            ok: true,
            id: 'log-123',
            eventType: 'quote_created',
            system: 'quote'
        });
        expect(isActivityLogFailure(result)).toBe(false);
    });

    it('builds a structured failure result when activity logging fails', () => {
        const result = buildActivityLogFailureResult(
            Object.assign(new Error('Missing or insufficient permissions.'), {
                code: 'permission-denied'
            }),
            {
                eventType: 'quote_created',
                system: 'quote'
            }
        );

        expect(result).toMatchObject({
            ok: false,
            id: null,
            eventType: 'quote_created',
            system: 'quote',
            error: {
                code: 'permission-denied',
                message: expect.stringContaining('Missing or insufficient permissions.')
            }
        });
        expect(isActivityLogFailure(result)).toBe(true);
    });
});
