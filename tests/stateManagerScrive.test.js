import { describe, expect, it } from 'vitest';
import { state } from '../services/stateManager.js';

describe('stateManager Scrive defaults', () => {
    it('starts with Scrive disabled by default', () => {
        expect(state.scriveEnabled).toBe(false);
        expect(state.scriveStatus).toBe('not_sent');
        expect(state.customerInfo).toHaveProperty('email');
    });
});
