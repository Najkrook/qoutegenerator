import { describe, expect, it } from 'vitest';
import {
    ACCESS_LEVELS,
    getAccessCapabilities,
    getAuthorizedStepForAccess
} from '../src/config/accessControl.shared.js';

describe('accessControl.shared', () => {
    it('exposes quote history for quote-only users without full admin access', () => {
        expect(getAccessCapabilities(ACCESS_LEVELS.QUOTE_ONLY)).toEqual({
            canViewEverything: false,
            canStartQuote: true,
            canAccessSketch: false,
            canAccessQuoteHistory: true,
            canExportSketchToQuote: false
        });
    });

    it('blocks unauthorized step transitions through the shared step gate', () => {
        expect(getAuthorizedStepForAccess('history', ACCESS_LEVELS.SKETCH_ONLY)).toBe(0);
        expect(getAuthorizedStepForAccess(3, ACCESS_LEVELS.SKETCH_ONLY)).toBe(0);
        expect(getAuthorizedStepForAccess('inventory', ACCESS_LEVELS.QUOTE_ONLY)).toBe(0);
        expect(getAuthorizedStepForAccess('planner', ACCESS_LEVELS.QUOTE_ONLY)).toBe(0);
    });

    it('preserves allowed quote-history and sketch routes for the correct roles', () => {
        expect(getAuthorizedStepForAccess('history', ACCESS_LEVELS.QUOTE_ONLY)).toBe('history');
        expect(getAuthorizedStepForAccess('sketch', ACCESS_LEVELS.SKETCH_ONLY)).toBe('sketch');
        expect(getAuthorizedStepForAccess('activity-logs', ACCESS_LEVELS.FULL)).toBe('activity-logs');
        expect(getAuthorizedStepForAccess(4, ACCESS_LEVELS.QUOTE_ONLY)).toBe(4);
    });

    it('gates retailers step to full-access users only', () => {
        expect(getAuthorizedStepForAccess('retailers', ACCESS_LEVELS.QUOTE_ONLY)).toBe(0);
        expect(getAuthorizedStepForAccess('retailers', ACCESS_LEVELS.SKETCH_ONLY)).toBe(0);
        expect(getAuthorizedStepForAccess('retailers', ACCESS_LEVELS.GUEST)).toBe(0);
        expect(getAuthorizedStepForAccess('retailers', ACCESS_LEVELS.FULL)).toBe('retailers');
    });
});
