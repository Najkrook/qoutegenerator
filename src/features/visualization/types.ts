export interface PlanPoint {
    xMm: number;
    zMm: number;
}
export type RunId = 'front' | 'left' | 'right' | 'back';
export type RunTerminalV1 =
    | { kind: 'corner'; connectsTo: { runId: RunId; terminal: 'start' | 'end' }; connectionGapMm?: number }
    | { kind: 'free' | 'unresolved' };
export interface ClickitUpRunV1 {
    id: RunId;
    start: PlanPoint;
    end: PlanPoint;
    members: { index: number; kind: 'section' | 'door'; lengthMm: number }[];
    /** Fixed trailing allowance drawn by Simple Sketch, not a section or added width. */
    trailingPostMm?: number;
    terminals: { start: RunTerminalV1; end: RunTerminalV1 };
}
export interface PlacedProductV1 {
    instanceId: string;
    productType: string;
    variantKey?: string;
    center: PlanPoint;
    /** Right-handed rotation about +Y. */
    rotationDeg: number;
    footprint:
        | { kind: 'rectangle'; widthMm: number; depthMm: number }
        | { kind: 'circle'; diameterMm: number };
}
export interface VisualizationProblemV1 {
    code: string;
    severity: 'warning' | 'error';
    entityRef: { kind: 'plan' | 'run' | 'run-member' | 'placed-product'; id: string; memberIndex?: number };
    effect: 'degraded' | 'omitted';
    /** Known anchor retained when an otherwise invalid entity must be omitted. */
    location?: PlanPoint;
}
export const VISUALIZATION_COORDINATES = {
    handedness: 'right',
    upAxis: 'y',
    groundPlane: 'xz',
    origin: 'front-left',
    xDirection: 'right',
    zDirection: 'back'
} as const;
export interface VisualizationPlanV1 {
    schemaVersion: 1;
    units: 'mm';
    coordinateSystem: typeof VISUALIZATION_COORDINATES;
    footprint: { points: PlanPoint[] };
    clickitUpRuns: ClickitUpRunV1[];
    placedProducts: PlacedProductV1[];
    problems: VisualizationProblemV1[];
}
export type VisualizationQuality = 'normal' | 'simple';
export type VisualizationStyle = 'environment' | 'technical';
