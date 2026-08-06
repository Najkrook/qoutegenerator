import React, { useState } from 'react';
import { useQuote } from '../store/QuoteContext';
import { SimpleSketchEditor } from '../components/features/SimpleSketch/SimpleSketchEditor';
import { AdvancedSketchEditor } from '../components/features/AdvancedSketch/AdvancedSketchEditor';
import type { SketchToolProps } from '../types/contracts';

export function SketchTool(props: SketchToolProps) {
    const { state } = useQuote();

    const initialMode = state.advancedSketchDraft && !state.sketchDraft ? 'advanced' : 'simple';
    const [editorMode, setEditorMode] = useState<'simple' | 'advanced'>(initialMode);

    const handleModeSwitch = (newMode: 'simple' | 'advanced') => {
        if (newMode === editorMode) return;

        setEditorMode(newMode);
    };

    const toggleNode = (
        <div
            role="group"
            aria-label="Skissläge"
            className="inline-flex min-h-10 items-center rounded-control border border-control-border bg-surface p-1"
        >
            <button
                type="button"
                aria-pressed={editorMode === 'simple'}
                onClick={() => handleModeSwitch('simple')}
                className={`min-h-8 rounded-control px-3 text-sm font-semibold transition-colors sm:px-4 ${
                    editorMode === 'simple'
                        ? 'bg-action-soft text-action-soft-text'
                        : 'text-text-muted hover:bg-surface-hover hover:text-text'
                }`}
            >
                Enkel
            </button>
            <button
                type="button"
                aria-pressed={editorMode === 'advanced'}
                onClick={() => handleModeSwitch('advanced')}
                className={`min-h-8 rounded-control px-3 text-sm font-semibold transition-colors sm:px-4 ${
                    editorMode === 'advanced'
                        ? 'bg-action-soft text-action-soft-text'
                        : 'text-text-muted hover:bg-surface-hover hover:text-text'
                }`}
            >
                Avancerat
            </button>
        </div>
    );

    return (
        <div className="relative flex min-h-0 w-full flex-1 basis-0 items-stretch overflow-hidden">
            {editorMode === 'simple' ? (
                <SimpleSketchEditor {...props} modeToggleNode={toggleNode} />
            ) : (
                <AdvancedSketchEditor {...props} modeToggleNode={toggleNode} />
            )}
        </div>
    );
}
