import React from 'react';

const PRIO_DESCRIPTIONS = {
    target: 'Maximerar antalet sektioner av den valda storleken.',
    convenient: 'Använder störst möjliga sektioner för minsta antal delar.',
    symmetrical: 'Alla sektioner får samma storlek för jämn symmetri.'
};

export function SketchConfig({ config, onChange }) {
    const { width, depth, includeBack, prioMode, targetLength, doorEdges, doorSize } = config;

    const toggleDoor = (edge) => {
        const newDoors = new Set(doorEdges);
        if (newDoors.has(edge)) newDoors.delete(edge);
        else newDoors.add(edge);
        onChange({ doorEdges: newDoors });
    };

    return (
        <div className="bg-panel-bg border border-panel-border rounded-xl p-5 space-y-5">
            <h3 className="text-lg font-semibold text-text-primary m-0">⚙️ Konfiguration</h3>

            {/* Dimensions */}
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Bredd (mm)</label>
                    <input
                        type="number"
                        value={width}
                        step={100}
                        min={1000}
                        onChange={(e) => onChange({ width: parseInt(e.target.value) || 1000 })}
                        className="bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Djup (mm)</label>
                    <input
                        type="number"
                        value={depth}
                        step={100}
                        min={1000}
                        onChange={(e) => onChange({ depth: parseInt(e.target.value) || 1000 })}
                        className="bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                    />
                </div>
            </div>

            {/* Include back wall */}
            <label className="flex items-center gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={includeBack}
                    onChange={(e) => {
                        const newBack = e.target.checked;
                        if (!newBack) {
                            const newDoors = new Set(doorEdges);
                            newDoors.delete('back');
                            onChange({ includeBack: newBack, doorEdges: newDoors });
                        } else {
                            onChange({ includeBack: newBack });
                        }
                    }}
                    className="accent-primary w-4 h-4"
                />
                <span className="text-sm text-text-primary">Inkludera bakvägg</span>
            </label>

            {/* Priority mode */}
            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase">Prioritering</label>
                <select
                    value={prioMode}
                    onChange={(e) => onChange({ prioMode: e.target.value })}
                    className="bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                >
                    <option value="symmetrical">Symmetrisk</option>
                    <option value="convenient">Bekväm (färst delar)</option>
                    <option value="target">Målstorlek</option>
                </select>
                <p className="text-xs text-text-secondary m-0">{PRIO_DESCRIPTIONS[prioMode]}</p>
            </div>

            {/* Target length (only in target mode) */}
            {prioMode === 'target' && (
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Målstorlek (mm)</label>
                    <select
                        value={targetLength}
                        onChange={(e) => onChange({ targetLength: parseInt(e.target.value) })}
                        className="bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                    >
                        {[2000, 1900, 1800, 1700, 1600, 1500, 1400, 1300, 1200, 1100, 1000].map(sz => (
                            <option key={sz} value={sz}>{sz} mm</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Door placement */}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-text-secondary uppercase">Dörr-placering</label>
                <div className="flex flex-wrap gap-3">
                    {['front', 'left', 'right'].map(edge => (
                        <label key={edge} className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={doorEdges.has(edge)}
                                onChange={() => toggleDoor(edge)}
                                className="accent-primary w-4 h-4"
                            />
                            <span className="text-sm text-text-primary capitalize">
                                {edge === 'front' ? 'Fram' : edge === 'left' ? 'Vänster' : 'Höger'}
                            </span>
                        </label>
                    ))}
                    {includeBack && (
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={doorEdges.has('back')}
                                onChange={() => toggleDoor('back')}
                                className="accent-primary w-4 h-4"
                            />
                            <span className="text-sm text-text-primary">Bak</span>
                        </label>
                    )}
                </div>
            </div>

            {/* Door size */}
            {doorEdges.size > 0 && (
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Dörrstorlek</label>
                    <select
                        value={doorSize}
                        onChange={(e) => onChange({ doorSize: parseInt(e.target.value) })}
                        className="bg-input-bg border border-panel-border text-text-primary p-2.5 rounded-lg outline-none focus:border-primary text-sm"
                    >
                        <option value={1000}>1000 mm</option>
                        <option value={1100}>1100 mm</option>
                    </select>
                </div>
            )}
        </div>
    );
}
