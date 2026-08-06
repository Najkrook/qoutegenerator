// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
    login: vi.fn()
}));

vi.mock('../src/store/AuthContext', () => ({
    useAuth: () => ({ login: authMocks.login })
}));

import { Login } from '../src/views/Login';

beforeEach(() => {
    authMocks.login.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

function fillCredentials() {
    fireEvent.change(screen.getByLabelText('E-post'), {
        target: { value: 'person@example.com' }
    });
    fireEvent.change(screen.getByLabelText('Lösenord'), {
        target: { value: 'hemligt' }
    });
}

describe('Login', () => {
    it('exposes labeled fields with browser-friendly metadata', () => {
        render(<Login />);

        expect(screen.getByRole('heading', { name: 'Offertverktyg' })).toBeTruthy();

        const email = screen.getByLabelText('E-post');
        const password = screen.getByLabelText('Lösenord');

        expect(email.getAttribute('type')).toBe('email');
        expect(email.getAttribute('name')).toBe('email');
        expect(email.getAttribute('autocomplete')).toBe('email');
        expect(email.required).toBe(true);
        expect(password.getAttribute('type')).toBe('password');
        expect(password.getAttribute('name')).toBe('password');
        expect(password.getAttribute('autocomplete')).toBe('current-password');
        expect(password.required).toBe(true);
    });

    it('reveals and hides the password without submitting the form', () => {
        render(<Login />);

        const password = screen.getByLabelText('Lösenord');
        fireEvent.click(screen.getByRole('button', { name: 'Visa lösenord' }));

        expect(password.getAttribute('type')).toBe('text');
        expect(screen.getByRole('button', { name: 'Dölj lösenord' })).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Dölj lösenord' }));
        expect(password.getAttribute('type')).toBe('password');
        expect(authMocks.login).not.toHaveBeenCalled();
    });

    it('submits the entered credentials and disables the primary action while waiting', async () => {
        let resolveLogin;
        authMocks.login.mockImplementation(() => new Promise((resolve) => {
            resolveLogin = resolve;
        }));
        render(<Login />);
        fillCredentials();

        fireEvent.click(screen.getByRole('button', { name: 'Logga in' }));

        expect(authMocks.login).toHaveBeenCalledWith('person@example.com', 'hemligt');
        expect(screen.getByRole('button', { name: 'Loggar in...' }).disabled).toBe(true);

        resolveLogin();
        await waitFor(() => {
            expect(authMocks.login).toHaveBeenCalledTimes(1);
        });
    });

    it('shows a safe alert for invalid credentials and links it to both fields', async () => {
        authMocks.login.mockRejectedValueOnce({ code: 'auth/user-not-found' });
        render(<Login />);
        fillCredentials();

        fireEvent.click(screen.getByRole('button', { name: 'Logga in' }));

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toBe('Fel e-post eller lösenord.');
        expect(alert.textContent).not.toContain('auth/user-not-found');
        expect(screen.getByLabelText('E-post').getAttribute('aria-describedby')).toBe('login-error');
        expect(screen.getByLabelText('Lösenord').getAttribute('aria-describedby')).toBe('login-error');
        expect(screen.getByLabelText('E-post').getAttribute('aria-invalid')).toBe('true');

        fireEvent.change(screen.getByLabelText('E-post'), {
            target: { value: 'annan@example.com' }
        });
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('does not expose raw information from an unknown authentication error', async () => {
        authMocks.login.mockRejectedValueOnce(new Error('firebase-internal-secret'));
        render(<Login />);
        fillCredentials();

        fireEvent.click(screen.getByRole('button', { name: 'Logga in' }));

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toBe('Ett tekniskt fel uppstod. Försök igen om en stund.');
        expect(alert.textContent).not.toContain('firebase-internal-secret');
    });
});
