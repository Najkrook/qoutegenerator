import { useQuote } from '../store/QuoteContext';
import { WorkflowPreview } from '../prototypes/3d-workflow-prototype/WorkflowPreview';

export function Sketch3dPrototype({ onBack }: { onBack: () => void }) {
    const { state } = useQuote();
    return <WorkflowPreview config={state.sketchDraft?.config}
        label={state.quoteNumber || state.customerInfo.reference || 'Aktuell skiss'} onBack={onBack} />;
}
