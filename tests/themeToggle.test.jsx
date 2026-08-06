// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ThemeToggle from '../src/components/ThemeToggle';

beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
});

afterEach(() => {
    cleanup();
    localStorage.clear();
    delete document.documentElement.dataset.theme;
});

describe('ThemeToggle', () => {
    it('uses the dark theme by default and exposes a Swedish action label', async () => {
        render(<ThemeToggle />);

        const button = screen.getByRole('button', { name: 'Byt till ljust läge' });
        expect(button.textContent).toBe('Ljust läge');
        expect(button.querySelector('svg')).toBeNull();
        await waitFor(() => {
            expect(document.documentElement.dataset.theme).toBe('portal-dark');
            expect(localStorage.getItem('quote-generator-theme')).toBe('portal-dark');
        });
    });

    it('toggles the document theme and persists the choice', async () => {
        render(<ThemeToggle />);

        fireEvent.click(screen.getByRole('button', { name: 'Byt till ljust läge' }));

        await waitFor(() => {
            expect(document.documentElement.dataset.theme).toBe('brixx-light');
            expect(localStorage.getItem('quote-generator-theme')).toBe('brixx-light');
        });
        expect(screen.getByRole('button', { name: 'Byt till mörkt läge' }).textContent).toBe('Mörkt läge');
    });

    it('restores a valid saved light theme', async () => {
        localStorage.setItem('quote-generator-theme', 'brixx-light');
        render(<ThemeToggle />);

        await waitFor(() => {
            expect(document.documentElement.dataset.theme).toBe('brixx-light');
        });
        expect(screen.getByRole('button', { name: 'Byt till mörkt läge' })).toBeTruthy();
    });

    it('falls back to dark for an unsupported stored value', async () => {
        localStorage.setItem('quote-generator-theme', 'neon');
        render(<ThemeToggle />);

        await waitFor(() => {
            expect(document.documentElement.dataset.theme).toBe('portal-dark');
        });
    });
});
