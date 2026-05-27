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
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[100] flex bg-panel-bg/80 backdrop-blur-md border border-indigo-500/30 p-1 rounded-full shadow-lg shadow-indigo-500/20">
            <button
                onClick={() => handleModeSwitch('simple')}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
                    editorMode === 'simple' ? 'bg-indigo-600 text-white shadow-md' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                }`}
            >
                Enkel
            </button>
            <button
                onClick={() => handleModeSwitch('advanced')}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
                    editorMode === 'advanced' ? 'bg-indigo-600 text-white shadow-md' : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                }`}
            >
                Avancerat
            </button>
        </div>
    );

    return (
        <div className="relative w-full h-full">
            {editorMode === 'simple' ? (
                <SimpleSketchEditor {...props} modeToggleNode={null} />
            ) : (
                <AdvancedSketchEditor {...props} modeToggleNode={null} />
            )}
            {toggleNode}
        </div>
    );
}
