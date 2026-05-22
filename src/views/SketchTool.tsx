import React, { useState } from 'react';
import { useQuote } from '../store/QuoteContext';
import { SimpleSketchEditor } from '../components/features/SimpleSketch/SimpleSketchEditor';
import { AdvancedSketchEditor } from '../components/features/AdvancedSketch/AdvancedSketchEditor';
import { confirmAction } from '../services/notificationService';
import type { SketchToolProps } from '../types/contracts';

export function SketchTool(props: SketchToolProps) {
    const { state, dispatch } = useQuote();

    const initialMode = state.advancedSketchDraft && !state.sketchDraft ? 'advanced' : 'simple';
    const [editorMode, setEditorMode] = useState<'simple' | 'advanced'>(initialMode);

    const handleModeSwitch = async (newMode: 'simple' | 'advanced') => {
        if (newMode === editorMode) return;

        const hasSimpleData = !!state.sketchDraft;
        const hasAdvancedData = !!state.advancedSketchDraft;

        if ((editorMode === 'simple' && hasSimpleData) || (editorMode === 'advanced' && hasAdvancedData)) {
            const confirmed = await confirmAction({
                title: 'Byt ritläge?',
                message: 'Varning: Byter du ritläge kommer din nuvarande ritning att nollställas. Vill du fortsätta?',
                confirmText: 'Ja, rensa och byt',
                cancelText: 'Avbryt',
                tone: 'danger'
            });
            if (!confirmed) return;
        }

        // Rensa rit-data för säkerhets skull vid byte
        if (newMode === 'advanced') {
            dispatch({ type: 'UPDATE_STATE', payload: { sketchDraft: null } });
        } else {
            dispatch({ type: 'UPDATE_STATE', payload: { advancedSketchDraft: null } });
        }

        setEditorMode(newMode);
    };

    const toggleNode = (
        <div className="flex bg-panel-bg border border-panel-border rounded-md overflow-hidden ml-4">
            <button
                onClick={() => handleModeSwitch('simple')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    editorMode === 'simple' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                }`}
            >
                Rektangel
            </button>
            <button
                onClick={() => handleModeSwitch('advanced')}
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-panel-border ${
                    editorMode === 'advanced' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                }`}
            >
                Friform
            </button>
        </div>
    );

    if (editorMode === 'simple') {
        return <SimpleSketchEditor {...props} modeToggleNode={toggleNode} />;
    }

    return <AdvancedSketchEditor {...props} modeToggleNode={toggleNode} />;
}
