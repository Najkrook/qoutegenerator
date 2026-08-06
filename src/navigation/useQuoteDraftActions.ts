import {
    getQuoteResumeStep,
    getQuoteStepLabel,
    getQuoteStepNumber,
    hasQuoteStartDraftData
} from './routes';
import { useAppNavigation } from './useAppNavigation';
import { useAuth } from '../store/AuthContext';
import { useQuote } from '../store/QuoteContext';
import { confirmChoiceAction } from '../services/notificationService';
import type { DashboardQuoteDraftSummary } from '../types/contracts';

export function useQuoteDraftActions() {
    const navigation = useAppNavigation();
    const { state, dispatch } = useQuote();
    const { isRetailer } = useAuth();
    const quoteDraftOptions = { isRetailer };
    const hasQuoteDraft = hasQuoteStartDraftData(state, quoteDraftOptions);
    const resumeQuoteStep = getQuoteResumeStep(state, quoteDraftOptions);
    const customerLabel = String(state.customerInfo?.company || '').trim()
        || String(state.customerInfo?.name || '').trim()
        || (state.quoteNumber ? `Offert ${state.quoteNumber}` : 'Pågående offertutkast');
    const reference = String(state.customerInfo?.reference || '').trim()
        || String(state.customerInfo?.customerReference || '').trim()
        || undefined;
    const quoteDraftSummary: DashboardQuoteDraftSummary | null = hasQuoteDraft
        ? {
            customerLabel,
            reference,
            quoteNumber: state.quoteNumber || undefined,
            stepLabel: `Steg ${getQuoteStepNumber(resumeQuoteStep)} av 4 · ${getQuoteStepLabel(resumeQuoteStep)}`,
            updatedAtMs: state.draftUpdatedAtMs
        }
        : null;

    const continueQuote = (): void => {
        navigation.goToQuoteStep(resumeQuoteStep);
    };

    const startQuote = async (): Promise<void> => {
        if (hasQuoteDraft) {
            const choice = await confirmChoiceAction({
                title: 'Starta ny offert?',
                message: `Det finns ett pågående utkast för ${customerLabel}. Om du startar en ny offert rensas utkastet och du börjar om från början.`,
                confirmText: 'Starta ny offert',
                cancelText: 'Avbryt',
                secondaryText: 'Fortsätt utkast',
                tone: 'danger'
            });

            if (choice === 'secondary') {
                continueQuote();
                return;
            }

            if (choice !== 'confirm') {
                return;
            }
        }

        dispatch({ type: 'RESET_QUOTE_DRAFT' });
        navigation.goToNewQuote();
    };

    return {
        continueQuote,
        hasQuoteDraft,
        quoteDraftSummary,
        resumeQuoteStep,
        startQuote
    };
}
