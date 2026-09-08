import { useQuote } from '../store/QuoteContext';
import { VisualizationWorkspace } from '../features/visualization/VisualizationWorkspace';

export function SketchVisualization({ onBack }: { onBack: () => void }) {
    const { state } = useQuote();
    return (
        <VisualizationWorkspace
            config={state.sketchDraft?.config}
            label={state.quoteNumber || state.customerInfo.reference || ''}
            language={state.exportLanguage}
            onBack={onBack}
        />
    );
}
