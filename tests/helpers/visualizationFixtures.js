export const sketch = (patch = {}) => ({
    width: 8000,
    depth: 6000,
    depthLeft: 6000,
    depthRight: 6000,
    equalDepth: true,
    includeBack: false,
    prioMode: 'fewest',
    targetLength: 2000,
    doorSegmentsByEdge: {},
    manualSectionsByEdge: {},
    sectionCountByEdge: {},
    parasols: [],
    fiestaItems: [],
    ...patch
});
export const parasol = (patch = {}) => ({
    id: 'p1',
    presetId: 'parasol_3x3',
    widthMm: 3000,
    depthMm: 3000,
    xMm: 2000,
    yMm: 3000,
    rotationDeg: 0,
    exportLine: 'BaHaMa',
    exportModel: 'Jumbrella',
    exportSize: '3x3 Kvadrat',
    ...patch
});
