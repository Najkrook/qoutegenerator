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
const FULL_ONLY_STEPS = new Set(['inventory', 'inventory-logs', 'activity-logs', 'planner']);

export const ACCESS_LEVELS = Object.freeze({
    GUEST: 'guest',
    FULL: 'full',
    QUOTE_ONLY: 'quote-only',
    SKETCH_ONLY: 'sketch-only'
});

export function isFullAccessUser(user) {
    return Boolean(user?.uid) && ADMIN_UID_SET.has(user.uid);
}

export function isSketchOnlyUser(user) {
    return Boolean(user?.uid) && SKETCH_ONLY_UID_SET.has(user.uid);
}

export function resolveAccessLevelFromUser(user) {
    if (!user?.uid) return ACCESS_LEVELS.GUEST;
    if (isFullAccessUser(user)) return ACCESS_LEVELS.FULL;
    if (isSketchOnlyUser(user)) return ACCESS_LEVELS.SKETCH_ONLY;
    return ACCESS_LEVELS.QUOTE_ONLY;
}

export function canViewEverythingLevel(accessLevel) {
    return accessLevel === ACCESS_LEVELS.FULL;
}

export function canStartQuoteLevel(accessLevel) {
    return accessLevel === ACCESS_LEVELS.FULL || accessLevel === ACCESS_LEVELS.QUOTE_ONLY;
}

export function canAccessSketchLevel(accessLevel) {
    return accessLevel === ACCESS_LEVELS.FULL || accessLevel === ACCESS_LEVELS.SKETCH_ONLY;
}

export function canAccessQuoteHistoryLevel(accessLevel) {
    return accessLevel === ACCESS_LEVELS.FULL || accessLevel === ACCESS_LEVELS.QUOTE_ONLY;
}

export function canExportSketchToQuoteLevel(accessLevel) {
    return accessLevel === ACCESS_LEVELS.FULL;
}

export function canAccessQuoteHistoryUser(user) {
    return canAccessQuoteHistoryLevel(resolveAccessLevelFromUser(user));
}

export function getAccessCapabilities(accessLevel) {
    return {
        canViewEverything: canViewEverythingLevel(accessLevel),
        canStartQuote: canStartQuoteLevel(accessLevel),
        canAccessSketch: canAccessSketchLevel(accessLevel),
        canAccessQuoteHistory: canAccessQuoteHistoryLevel(accessLevel),
        canExportSketchToQuote: canExportSketchToQuoteLevel(accessLevel)
    };
}

export function isQuoteFlowStep(step) {
    return Number.isInteger(step) && step >= 1 && step <= 4;
}

export function getAuthorizedStepForAccess(step, accessLevel) {
    if (FULL_ONLY_STEPS.has(step)) {
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
