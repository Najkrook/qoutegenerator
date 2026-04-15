import type { AccessCapabilities, AccessLevel, AccessUser, AdminStep, QuoteFlowStep, QuoteStep, StepInput } from '../types/contracts';

export const ADMIN_UIDS = Object.freeze([
    'ZPxZusAiyfY6cf2LSn1ynP5A7rG3',
    'XolYJ2aOCdZPgiTg4WKVSOcRPmO2',
    'cNXpQsFClscsPGURl0gedehYcFo2'
]);

export const SKETCH_ONLY_UIDS = Object.freeze([
    // Add Firebase Auth UIDs here for users that may only access "Rita Uteservering".
    'VpHpMybaN0VbmSsDkz57Jryyx3v1'
]);

const ADMIN_UID_SET = new Set(ADMIN_UIDS);
const SKETCH_ONLY_UID_SET = new Set(SKETCH_ONLY_UIDS);
const FULL_ONLY_STEPS = new Set<AdminStep>(['inventory', 'inventory-logs', 'activity-logs', 'planner', 'retailers']);

export const ACCESS_LEVELS = Object.freeze({
    GUEST: 'guest',
    FULL: 'full',
    QUOTE_ONLY: 'quote-only',
    SKETCH_ONLY: 'sketch-only',
    RETAILER: 'retailer'
} as const);

export function isFullAccessUser(user: AccessUser | null | undefined): boolean {
    return Boolean(user?.uid) && ADMIN_UID_SET.has(user.uid);
}

export function isSketchOnlyUser(user: AccessUser | null | undefined): boolean {
    return Boolean(user?.uid) && SKETCH_ONLY_UID_SET.has(user.uid);
}

export function resolveAccessLevelFromUser(user: AccessUser | null | undefined): AccessLevel {
    if (!user?.uid) return ACCESS_LEVELS.GUEST;
    if (isFullAccessUser(user)) return ACCESS_LEVELS.FULL;
    if (isSketchOnlyUser(user)) return ACCESS_LEVELS.SKETCH_ONLY;
    return ACCESS_LEVELS.QUOTE_ONLY;
}

export function canViewEverythingLevel(accessLevel: AccessLevel): boolean {
    return accessLevel === ACCESS_LEVELS.FULL;
}

export function canStartQuoteLevel(accessLevel: AccessLevel): boolean {
    return accessLevel === ACCESS_LEVELS.FULL || accessLevel === ACCESS_LEVELS.QUOTE_ONLY || accessLevel === ACCESS_LEVELS.RETAILER;
}

export function canAccessSketchLevel(accessLevel: AccessLevel): boolean {
    return accessLevel === ACCESS_LEVELS.FULL || accessLevel === ACCESS_LEVELS.SKETCH_ONLY;
}

export function canAccessQuoteHistoryLevel(accessLevel: AccessLevel): boolean {
    return accessLevel === ACCESS_LEVELS.FULL || accessLevel === ACCESS_LEVELS.QUOTE_ONLY || accessLevel === ACCESS_LEVELS.RETAILER;
}

export function canExportSketchToQuoteLevel(accessLevel: AccessLevel): boolean {
    return accessLevel === ACCESS_LEVELS.FULL;
}

export function canAccessQuoteHistoryUser(user: AccessUser | null | undefined): boolean {
    return canAccessQuoteHistoryLevel(resolveAccessLevelFromUser(user));
}

export function getAccessCapabilities(level: AccessLevel): AccessCapabilities {
    switch (level) {
        case ACCESS_LEVELS.FULL:
            return {
                canViewEverything: true,
                canStartQuote: true,
                canAccessSketch: true,
                canAccessQuoteHistory: true,
                canExportSketchToQuote: true
            };
        case ACCESS_LEVELS.RETAILER:
        case ACCESS_LEVELS.QUOTE_ONLY:
            return {
                canViewEverything: false,
                canStartQuote: true,
                canAccessSketch: false,
                canAccessQuoteHistory: true,
                canExportSketchToQuote: false
            };
        case ACCESS_LEVELS.GUEST:
        default:
            return {
                canViewEverything: false,
                canStartQuote: false,
                canAccessSketch: false,
                canAccessQuoteHistory: false,
                canExportSketchToQuote: false
            };
    }
}

export function isQuoteFlowStep(step: StepInput): step is QuoteFlowStep {
    return typeof step === 'number' && Number.isInteger(step) && step >= 1 && step <= 4;
}

export function isQuoteStep(step: StepInput): step is QuoteStep {
    return step === 0
        || isQuoteFlowStep(step)
        || step === 'inventory'
        || step === 'inventory-logs'
        || step === 'activity-logs'
        || step === 'planner'
        || step === 'retailers'
        || step === 'sketch'
        || step === 'history';
}

export function isAdminStep(step: StepInput): step is AdminStep {
    return typeof step === 'string' && FULL_ONLY_STEPS.has(step as AdminStep);
}

export function getAuthorizedStepForAccess(step: StepInput, accessLevel: AccessLevel): QuoteStep {
    if (!isQuoteStep(step)) {
        return 0;
    }

    if (isAdminStep(step)) {
        return canViewEverythingLevel(accessLevel) ? step : 0;
    }

    if (step === 'sketch') {
        return canAccessSketchLevel(accessLevel) ? step : 0;
    }

    if (step === 'history') {
        return canAccessQuoteHistoryLevel(accessLevel) ? step : 0;
    }

    if (isQuoteFlowStep(step)) {
        return canStartQuoteLevel(accessLevel) ? step : 0;
    }

    return step;
}
