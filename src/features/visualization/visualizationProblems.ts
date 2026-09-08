import type { VisualizationProblemV1 as Problem } from './types';

export const entityKey = (ref: Problem['entityRef']) =>
    `${ref.kind}:${ref.id}${ref.memberIndex === undefined ? '' : ':' + ref.memberIndex}`;
export const problemKey = (problem: Problem) => `${entityKey(problem.entityRef)}:${problem.code}`;
export function combineProblems(...lists: Problem[][]): Problem[] {
    return [...new Map(lists.flat().map((p) => [problemKey(p), p])).values()];
}
export function getVisualizationExportPolicy(problems: Problem[], ready: boolean) {
    const blockers = problems.filter((p) => p.effect === 'omitted');
    return {
        allowed: ready && blockers.length === 0,
        blockers,
        disclosure: problems.some((p) => p.effect === 'degraded')
    };
}
const labels = { front: 'Framkanten', left: 'Vänster sida', right: 'Höger sida', back: 'Bakkanten' };
export function entityLabel(ref: Problem['entityRef']) {
    if (ref.kind === 'plan') return 'Skissen';
    if (ref.kind === 'placed-product') return `Produkt ${ref.id}`;
    return `${labels[ref.id] || ref.id}${ref.memberIndex === undefined ? '' : ` · del ${ref.memberIndex + 1}`}`;
}
const messages: Record<string, string> = {
    RUN_NO_DOOR_COMBINATION: 'Kan inte byggas med vald dörrstorlek.',
    RUN_NO_SECTION_SOLUTION: 'Saknar en giltig sektionskombination.',
    RUN_WRONG_MEMBER_COUNT: 'Kan inte byggas med valt antal medlemmar.',
    DOOR_AUTO_ADJUSTED: 'Dörrstorleken har autojusterats.',
    RUN_ENDPOINT_DISCONNECTED: 'Ansluter inte till den intilliggande ClickitUp-sträckningen.',
    PRODUCT_KEY_UNKNOWN: 'Produktmodellen känns inte igen. En förenklad modell visas med skissens mått.',
    PRODUCT_DIMENSIONS_INVALID: 'Produkten kan inte visas eftersom användbara mått eller placering saknas.',
    PRODUCT_INSTANCE_ID_REPAIRED: 'En produkt saknade unik identitet i skissen.',
    PRODUCT_CENTER_OUTSIDE: 'Produktens centrum ligger utanför skissytan.',
    FIESTA_FOOTPRINT_OUTSIDE: 'Fiesta ligger delvis utanför skissytan.',
    PRODUCT_OVERLAP: 'Två produkter av samma typ överlappar varandra.',
    VISUAL_MODEL_SIMPLIFIED: 'Färdig modell saknas. En förenklad produktmodell visas.',
    FIESTA_IDENTITY_UNVERIFIED:
        'Produktidentiteten för Fiesta behöver verifieras. Skissens placeringsyta är 700 mm; modellen visar 860 mm största bredd.',
    TEXTURE_ASSET_FAILED: 'En textur kunde inte laddas. Ett neutralt material används.',
    VISUAL_MODEL_ASSET_FAILED: 'Den färdiga modellen kunde inte laddas. En förenklad produktmodell visas.',
    VISUAL_MODEL_FALLBACK_FAILED: 'Produkten kunde inte visas.'
};
export const problemText = (problem: Problem) =>
    messages[problem.code] || 'Skissen innehåller en avvikelse som behöver kontrolleras.';
