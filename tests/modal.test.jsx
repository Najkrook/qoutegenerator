// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '../src/components/ui/Modal';

afterEach(() => {
    cleanup();
    document.body.style.overflow = '';
});

describe('Modal', () => {
    it('supports the normal close button and Escape dismissal', () => {
        const onClose = vi.fn();
        render(
            <Modal onClose={onClose} title="Redigera">
                <button type="button">Spara</button>
            </Modal>
        );

        expect(screen.getByRole('dialog', { name: 'Redigera' })).toBeTruthy();
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('can prevent accidental dismissal while a protected action is active', () => {
        const onClose = vi.fn();
        render(
            <Modal dismissible={false} onClose={onClose} title="Tar bort">
                <p>Vänta tills åtgärden är klar.</p>
            </Modal>
        );

        expect(screen.queryByRole('button', { name: 'Stäng' })).toBeNull();
        fireEvent.keyDown(document, { key: 'Escape' });
        fireEvent.mouseDown(screen.getByRole('dialog', { name: 'Tar bort' }));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('keeps focus in an edited field when the parent rerenders with an inline close callback', () => {
        function Harness() {
            const [value, setValue] = React.useState('');
            return (
                <Modal onClose={() => {}} title="Redigera uppgift">
                    <label htmlFor="modal-note">Anteckning</label>
                    <input
                        id="modal-note"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                    />
                </Modal>
            );
        }

        render(<Harness />);
        const input = screen.getByLabelText('Anteckning');
        input.focus();
        fireEvent.change(input, { target: { value: 'Ny text' } });

        expect(document.activeElement).toBe(input);
        expect(input.value).toBe('Ny text');
    });
});
