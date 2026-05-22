/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthContext, AuthProvider, useAuth } from '../src/store/AuthContext';
import { ACCESS_LEVELS, resolveAccessLevelFromUser } from '../src/config/accessControl.shared';
import * as authService from '../src/services/authService';
import * as firebase from '../src/services/firebase';
import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

afterEach(() => {
    cleanup();
});

// Mock the services
vi.mock('../src/services/authService', () => ({
    onAuthChange: vi.fn(),
    login: vi.fn(),
    logout: vi.fn()
}));

vi.mock('../src/services/firebase', () => ({
    db: {},
    doc: vi.fn(),
    getDoc: vi.fn(),
    collection: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    getDocs: vi.fn()
}));

// Test component to read context
function TestConsumer() {
    const { accessLevel, isRetailer, canViewEverything, canAccessSketch } = useAuth();
    return (
        <div>
            <div data-testid="level">{accessLevel}</div>
            <div data-testid="is-retailer">{String(isRetailer)}</div>
            <div data-testid="can-view-everything">{String(canViewEverything)}</div>
            <div data-testid="can-access-sketch">{String(canAccessSketch)}</div>
        </div>
    );
}

describe('AuthContext Role Precedence', () => {
    let authCallback;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Capture the callback passed to onAuthChange
        authService.onAuthChange.mockImplementation((cb) => {
            authCallback = cb;
            return () => {}; // unsubscribe function
        });
    });

    const triggerAuth = async (user) => {
        // Render provider
        render(
            <AuthProvider>
                <TestConsumer />
            </AuthProvider>
        );
        
        // Wait for effect to register callback
        await waitFor(() => expect(authCallback).toBeDefined());
        
        // Trigger callback
        await authCallback(user);
        
        // Give promises time to resolve
        await new Promise(resolve => setTimeout(resolve, 0));
    };

    it('resolves guest when not logged in', async () => {
        await triggerAuth(null);
        expect(screen.getByTestId('level').textContent).toBe(ACCESS_LEVELS.GUEST);
        expect(screen.getByTestId('can-view-everything').textContent).toBe('false');
        expect(firebase.getDoc).not.toHaveBeenCalled();
    });

    it('resolves admin from user_roles collection', async () => {
        firebase.getDoc.mockResolvedValueOnce({
            exists: () => true,
            data: () => ({ role: 'admin' })
        });

        await triggerAuth({ uid: 'new-uid', email: 'test@test.com' });
        
        expect(screen.getByTestId('level').textContent).toBe(ACCESS_LEVELS.FULL);
        expect(screen.getByTestId('can-view-everything').textContent).toBe('true');
        expect(firebase.getDoc).toHaveBeenCalled();
        expect(firebase.getDocs).not.toHaveBeenCalled(); // Admin short-circuits retailer check
    });

    it('resolves sketch_only from user_roles collection', async () => {
        firebase.getDoc.mockResolvedValueOnce({
            exists: () => true,
            data: () => ({ role: 'sketch_only' })
        });

        await triggerAuth({ uid: 'new-uid', email: 'test@test.com' });
        
        expect(screen.getByTestId('level').textContent).toBe(ACCESS_LEVELS.SKETCH_ONLY);
        expect(screen.getByTestId('can-access-sketch').textContent).toBe('true');
        expect(firebase.getDocs).not.toHaveBeenCalled(); // sketch_only short-circuits retailer check
    });

    it('falls back to hardcoded admin if user_roles fetch fails', async () => {
        // Simulate missing document or permission error
        firebase.getDoc.mockRejectedValueOnce(new Error('Missing or insufficient permissions'));

        // Use a known admin UID from hardcoded list
        await triggerAuth({ uid: 'ZPxZusAiyfY6cf2LSn1ynP5A7rG3', email: 'admin@test.com' });
        
        expect(screen.getByTestId('level').textContent).toBe(ACCESS_LEVELS.FULL);
        expect(screen.getByTestId('can-view-everything').textContent).toBe('true');
    });

    it('falls back to retailer if explicit quote_only is found (or doc missing) and user is in retailers collection', async () => {
        firebase.getDoc.mockResolvedValueOnce({
            exists: () => true,
            data: () => ({ role: 'quote_only' })
        });

        firebase.getDocs.mockResolvedValueOnce({
            empty: false,
            docs: [{ id: 'ret-1', data: () => ({ name: 'Test Retailer' }) }]
        });

        await triggerAuth({ uid: 'some-uid', email: 'retailer@test.com' });
        
        expect(screen.getByTestId('level').textContent).toBe(ACCESS_LEVELS.RETAILER);
        expect(screen.getByTestId('is-retailer').textContent).toBe('true');
        expect(firebase.getDocs).toHaveBeenCalled();
    });

    it('resolves quote_only if user is logged in, no special role, and not a retailer', async () => {
        firebase.getDoc.mockResolvedValueOnce({
            exists: () => false
        });

        firebase.getDocs.mockResolvedValueOnce({
            empty: true
        });

        await triggerAuth({ uid: 'some-uid', email: 'normal@test.com' });
        
        expect(screen.getByTestId('level').textContent).toBe(ACCESS_LEVELS.QUOTE_ONLY);
        expect(screen.getByTestId('can-view-everything').textContent).toBe('false');
    });
});
