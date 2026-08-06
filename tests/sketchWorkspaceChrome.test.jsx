// @vitest-environment jsdom

import { useState } from 'react';
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    SketchPanelTabs,
    SketchResponsivePanel,
    SketchWorkspaceHeader
} from '../src/components/features/SketchWorkspace/SketchWorkspaceChrome';

let animationFrameCallbacks = [];

function flushAnimationFrames() {
    act(() => {
        const callbacks = animationFrameCallbacks;
        animationFrameCallbacks = [];
        callbacks.forEach((callback) => callback(0));
    });
}

function createHeaderProps(overrides = {}) {
    return {
        modeToggleNode: <button type="button">Enkel</button>,
        onBack: vi.fn(),
        overflowActions: [{
            label: 'Börja om',
            onClick: vi.fn(),
            tone: 'danger'
        }],
        primaryAction: {
            label: 'Överför till offert',
            onClick: vi.fn()
        },
        readiness: {
            label: 'Redo att överföra',
            tone: 'success',
            onClick: vi.fn()
        },
        saveStatus: 'saved',
        secondaryAction: {
            label: 'Ladda ner bild',
            onClick: vi.fn()
        },
        ...overrides
    };
}

function ResponsivePanelHarness({ onOpenChange }) {
    const [open, setOpen] = useState(false);

    return (
        <SketchResponsivePanel
            activeTab="drawing"
            materialCount={2}
            onTabChange={() => {}}
            open={open}
            onOpenChange={(nextOpen) => {
                onOpenChange(nextOpen);
                setOpen(nextOpen);
            }}
        >
            Panelinnehåll
        </SketchResponsivePanel>
    );
}

beforeEach(() => {
    animationFrameCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', (callback) => {
        animationFrameCallbacks.push(callback);
        return animationFrameCallbacks.length;
    });
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe('SketchWorkspaceHeader', () => {
    it('renders save and readiness copy and invokes every visible header action', () => {
        const props = createHeaderProps();
        const { rerender } = render(<SketchWorkspaceHeader {...props} />);

        expect(screen.getByText('Sparad lokalt')).not.toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Tillbaka' }));
        fireEvent.click(screen.getByRole('button', { name: 'Redo att överföra' }));
        fireEvent.click(screen.getByText('Ladda ner bild').closest('button'));
        fireEvent.click(screen.getByText('Överför till offert').closest('button'));

        expect(props.onBack).toHaveBeenCalledTimes(1);
        expect(props.readiness.onClick).toHaveBeenCalledTimes(1);
        expect(props.secondaryAction.onClick).toHaveBeenCalledTimes(1);
        expect(props.primaryAction.onClick).toHaveBeenCalledTimes(1);

        rerender(<SketchWorkspaceHeader {...props} saveStatus="saving" />);
        expect(screen.getByText('Sparar…')).not.toBeNull();
    });

    it('exposes, opens and runs actions from the overflow menu', () => {
        const props = createHeaderProps();
        render(<SketchWorkspaceHeader {...props} />);

        const trigger = screen.getByRole('button', { name: 'Fler skissåtgärder' });
        expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
        expect(trigger.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(trigger);
        flushAnimationFrames();

        const menu = screen.getByRole('menu');
        const menuItem = screen.getByRole('menuitem', { name: 'Börja om' });
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(trigger.getAttribute('aria-controls')).toBe(menu.id);
        expect(document.activeElement).toBe(menuItem);

        fireEvent.click(menuItem);
        flushAnimationFrames();

        expect(props.overflowActions[0].onClick).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('menu')).toBeNull();
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(trigger);
    });

    it('closes the overflow menu on Escape and restores trigger focus', () => {
        render(<SketchWorkspaceHeader {...createHeaderProps()} />);

        const trigger = screen.getByRole('button', { name: 'Fler skissåtgärder' });
        fireEvent.click(trigger);
        expect(screen.getByRole('menu')).not.toBeNull();

        fireEvent.keyDown(document, { key: 'Escape' });
        flushAnimationFrames();

        expect(screen.queryByRole('menu')).toBeNull();
        expect(document.activeElement).toBe(trigger);
    });

    it('closes the overflow menu after an outside pointer press', () => {
        render(<SketchWorkspaceHeader {...createHeaderProps()} />);

        const trigger = screen.getByRole('button', { name: 'Fler skissåtgärder' });
        fireEvent.click(trigger);
        expect(screen.getByRole('menu')).not.toBeNull();

        fireEvent.mouseDown(document.body);

        expect(screen.queryByRole('menu')).toBeNull();
        expect(trigger.getAttribute('aria-expanded')).toBe('false');
    });
});

describe('SketchPanelTabs', () => {
    it('publishes tab selection through ARIA and invokes the tab callback', () => {
        const onChange = vi.fn();
        render(
            <SketchPanelTabs
                activeTab="drawing"
                materialCount={3}
                onChange={onChange}
            />
        );

        expect(screen.getByRole('tablist', { name: 'Skisspanel' })).not.toBeNull();
        expect(screen.getByRole('tab', { name: 'Ritning' }).getAttribute('aria-selected')).toBe('true');
        expect(screen.getByRole('tab', { name: 'Egenskaper' }).getAttribute('aria-selected')).toBe('false');
        expect(screen.getByRole('tab', { name: /^Material/ }).getAttribute('aria-selected')).toBe('false');

        fireEvent.click(screen.getByRole('tab', { name: 'Egenskaper' }));

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenLastCalledWith('properties');
    });
});

describe('SketchResponsivePanel', () => {
    it('closes with Escape, backdrop and panel control and restores trigger focus', () => {
        const onOpenChange = vi.fn();
        render(<ResponsivePanelHarness onOpenChange={onOpenChange} />);

        const trigger = screen.getByRole('button', { name: 'Öppna panel' });
        expect(trigger.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(trigger);
        expect(screen.queryByRole('button', { name: 'Öppna panel' })).toBeNull();
        expect(screen.getByRole('complementary', { name: 'Skissinställningar' })).not.toBeNull();

        fireEvent.keyDown(document, { key: 'Escape' });
        flushAnimationFrames();
        let currentTrigger = screen.getByRole('button', { name: 'Öppna panel' });
        expect(onOpenChange).toHaveBeenLastCalledWith(false);
        expect(currentTrigger.getAttribute('aria-expanded')).toBe('false');
        expect(document.activeElement).toBe(currentTrigger);

        fireEvent.click(currentTrigger);
        fireEvent.click(screen.getByRole('button', { name: 'Stäng panelen' }));
        flushAnimationFrames();
        currentTrigger = screen.getByRole('button', { name: 'Öppna panel' });
        expect(onOpenChange).toHaveBeenLastCalledWith(false);
        expect(document.activeElement).toBe(currentTrigger);

        fireEvent.click(currentTrigger);
        fireEvent.click(screen.getByRole('button', { name: 'Minimera panelen' }));
        flushAnimationFrames();
        currentTrigger = screen.getByRole('button', { name: 'Öppna panel' });
        expect(onOpenChange).toHaveBeenLastCalledWith(false);
        expect(document.activeElement).toBe(currentTrigger);

        expect(onOpenChange.mock.calls).toEqual([
            [true],
            [false],
            [true],
            [false],
            [true],
            [false]
        ]);
    });
});
