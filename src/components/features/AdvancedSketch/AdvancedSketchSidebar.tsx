import React, { useState, useEffect } from 'react';
import type { AdvancedNode, AdvancedEdge } from '../../../types/contracts';
import { calculateSectionsForEdge, parseSection } from '../../../utils/sectionCalculator';

interface AdvancedSketchSidebarProps {
    selectedNode: AdvancedNode | null;
    selectedEdge: AdvancedEdge | null;
    nodes: AdvancedNode[];
    edges: AdvancedEdge[];
    onUpdateNode: (id: string, x: number, y: number) => void;
    onDeleteNode: (id: string) => void;
    onUpdateEdgeLength: (edgeId: string, newLengthMm: number) => void;
    onDeleteEdge: (edgeId: string) => void;
    onApplyTemplate: (templateType: 'rect' | 'lshape' | 'ushape') => void;
    onClearAll: () => void;
    gridActive: boolean;
    setGridActive: (active: boolean) => void;
    orthoActive: boolean;
    setOrthoActive: (active: boolean) => void;
    scale: number;
    // New props for selection and quote export
    onSelectEdge: (edgeId: string | null) => void;
    onExportToQuote: () => void;
    onUpdateEdgeProperties: (edgeId: string, updates: Partial<AdvancedEdge>) => void;
    onSplitEdge: (edgeId: string) => void;
}

export function AdvancedSketchSidebar({
    selectedNode,
    selectedEdge,
    nodes,
    edges,
    onUpdateNode,
    onDeleteNode,
    onUpdateEdgeLength,
    onDeleteEdge,
    onApplyTemplate,
    onClearAll,
    gridActive,
    setGridActive,
    orthoActive,
    setOrthoActive,
    scale,
    onSelectEdge,
    onExportToQuote,
    onUpdateEdgeProperties,
    onSplitEdge
}: AdvancedSketchSidebarProps) {
    const [lengthInput, setLengthInput] = useState('');
    const [nodeXInput, setNodeXInput] = useState('');
    const [nodeYInput, setNodeYInput] = useState('');

    // Compute edge length
    const startNode = selectedEdge ? nodes.find(n => n.id === selectedEdge.startNodeId) : null;
    const endNode = selectedEdge ? nodes.find(n => n.id === selectedEdge.endNodeId) : null;
    let computedLengthMm = 0;
    if (startNode && endNode) {
        const dx = endNode.x - startNode.x;
        const dy = endNode.y - startNode.y;
        computedLengthMm = Math.sqrt(dx * dx + dy * dy) * scale;
    }

    // Sync input states
    useEffect(() => {
        if (selectedEdge) {
            setLengthInput(Math.round(computedLengthMm).toString());
        }
    }, [selectedEdge, computedLengthMm]);

    useEffect(() => {
        if (selectedNode) {
            setNodeXInput(Math.round(selectedNode.x * scale).toString());
            setNodeYInput(Math.round(selectedNode.y * scale).toString());
        }
    }, [selectedNode, scale]);

    const handleLengthSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEdge) return;
        const val = parseFloat(lengthInput);
        if (!isNaN(val) && val > 0) {
            onUpdateEdgeLength(selectedEdge.id, val);
        }
    };

    const handleNodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedNode) return;
        const xVal = parseFloat(nodeXInput);
        const yVal = parseFloat(nodeYInput);
        if (!isNaN(xVal) && !isNaN(yVal)) {
            onUpdateNode(selectedNode.id, xVal / scale, yVal / scale);
        }
    };

    // Calculate edge sections for the selected edge
    const edgeSections = selectedEdge
        ? calculateSectionsForEdge(computedLengthMm, selectedEdge.hasDoor || false, {
              prioMode: selectedEdge.prioMode || 'symmetrical',
              targetLength: selectedEdge.targetLength || 1500,
              doorSize: selectedEdge.doorSize || 1000
          })
        : [];

    const hasTooShortEdges = edges.some(edge => {
        const start = nodes.find(n => n.id === edge.startNodeId);
        const end = nodes.find(n => n.id === edge.endNodeId);
        if (!start || !end) return false;
        const len = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2) * scale;
        return len < 1000;
    });

    // Aggregates for all edges (when nothing is selected)
    const bomCounts: Record<number, number> = {};
    const bomDoorCounts: Record<number, number> = {};
    let totalGlassLengthMm = 0;
    let totalSlimlineCount = 0;
    const nodeEdgeCounts: Record<string, number> = {};

    if (!selectedEdge && !selectedNode) {
        edges.forEach((edge) => {
            const sNode = nodes.find(n => n.id === edge.startNodeId);
            const eNode = nodes.find(n => n.id === edge.endNodeId);
            if (sNode && eNode) {
                const len = Math.round(Math.sqrt((eNode.x - sNode.x) ** 2 + (eNode.y - sNode.y) ** 2) * scale);
                if (len >= 1000) {
                    nodeEdgeCounts[edge.startNodeId] = (nodeEdgeCounts[edge.startNodeId] || 0) + 1;
                    nodeEdgeCounts[edge.endNodeId] = (nodeEdgeCounts[edge.endNodeId] || 0) + 1;

                    const sections = calculateSectionsForEdge(len, edge.hasDoor || false, {
                        prioMode: edge.prioMode || 'symmetrical',
                        targetLength: edge.targetLength || 1500,
                        doorSize: edge.doorSize || 1000
                    });
                    sections.forEach((sec) => {
                        const parsed = parseSection(sec);
                        if (parsed.kind === 'door') {
                            bomDoorCounts[parsed.length] = (bomDoorCounts[parsed.length] || 0) + 1;
                            totalSlimlineCount += 1;
                        } else {
                            const size = parsed.length;
                            if (size > 0) {
                                bomCounts[size] = (bomCounts[size] || 0) + 1;
                                totalGlassLengthMm += size;
                            }
                        }
                    });
                }
            }
        });
    }

    // Count support posts (stödben) for free ends (exactly 1 connected edge)
    let stodbenCount = 0;
    Object.values(nodeEdgeCounts).forEach((count) => {
        if (count === 1) stodbenCount += 1;
    });

    return (
        <aside className="w-80 flex-none flex flex-col bg-panel-bg/95 backdrop-blur-sm border-l border-panel-border overflow-y-auto">
            <div className="p-5 flex flex-col gap-6">
                <div>
                    <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider mb-2">
                        Inspektör (Friform)
                    </h3>
                    <p className="text-xs text-text-secondary leading-relaxed">
                        Skapa premiumritningar genom att rita väggar eller använda färdiga mallar.
                    </p>
                </div>

                {/* Snapping toggles */}
                <div className="flex flex-col gap-2 p-4 bg-panel-hover rounded-xl border border-panel-border">
                    <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-1">
                        Hjälpmedel
                    </h4>
                    <label className="flex items-center gap-3 text-xs text-text-secondary cursor-pointer select-none py-1 hover:text-text-primary transition-colors">
                        <input
                            type="checkbox"
                            checked={gridActive}
                            onChange={(e) => setGridActive(e.target.checked)}
                            className="w-4 h-4 rounded border-panel-border bg-black/25 text-primary focus:ring-primary focus:ring-offset-0 focus:ring-1"
                        />
                        <span>Aktivera Rutnät (Snap)</span>
                    </label>
                    <label className="flex items-center gap-3 text-xs text-text-secondary cursor-pointer select-none py-1 hover:text-text-primary transition-colors">
                        <input
                            type="checkbox"
                            checked={orthoActive}
                            onChange={(e) => setOrthoActive(e.target.checked)}
                            className="w-4 h-4 rounded border-panel-border bg-black/25 text-primary focus:ring-primary focus:ring-offset-0 focus:ring-1"
                        />
                        <span>Lås Raka Vinklar (90° Ortho)</span>
                    </label>
                </div>

                {/* Selected Edge Inspector */}
                {selectedEdge && startNode && endNode && (
                    <div className="flex flex-col gap-4 p-4 bg-panel-hover rounded-xl border border-panel-border border-l-4 border-l-primary animate-slide-in">
                        <div>
                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Vald Vägg</span>
                            <h4 className="text-sm font-semibold text-text-primary m-0 mt-0.5">Väggegenskaper</h4>
                        </div>

                        <form onSubmit={handleLengthSubmit} className="flex flex-col gap-2">
                            <label className="text-xs text-text-secondary">Längd (mm)</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={lengthInput}
                                    onChange={(e) => setLengthInput(e.target.value)}
                                    className="flex-1 px-3 py-1.5 bg-black/20 border border-panel-border rounded text-sm text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                />
                                <button
                                    type="submit"
                                    className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded transition-colors"
                                >
                                    Sätt
                                </button>
                            </div>
                        </form>

                        {/* Edge configurations (Door, Prio Mode, Target Length) */}
                        <div className="flex flex-col gap-3 border-t border-panel-border/40 pt-3">
                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Sektionsinställningar</span>
                            
                            {/* Prio Mode Select */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-text-secondary">Sektionsprioritering</label>
                                <select
                                    value={selectedEdge.prioMode || 'symmetrical'}
                                    onChange={(e) => onUpdateEdgeProperties(selectedEdge.id, { prioMode: e.target.value as any })}
                                    className="px-2.5 py-1.5 bg-black/20 border border-panel-border rounded text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
                                >
                                    <option value="symmetrical" className="bg-panel-bg">Symmetrisk (Symmetrical)</option>
                                    <option value="convenient" className="bg-panel-bg">Bekväm (Convenient)</option>
                                    <option value="target" className="bg-panel-bg">Målstorlek (Target)</option>
                                </select>
                            </div>

                            {/* Target Length Select */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-text-secondary">Målstorlek för glas</label>
                                <select
                                    value={selectedEdge.targetLength || 1500}
                                    onChange={(e) => onUpdateEdgeProperties(selectedEdge.id, { targetLength: parseInt(e.target.value, 10) })}
                                    className="px-2.5 py-1.5 bg-black/20 border border-panel-border rounded text-xs text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
                                >
                                    {[700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000].map(val => (
                                        <option key={val} value={val} className="bg-panel-bg">{val} mm</option>
                                    ))}
                                </select>
                            </div>

                            {/* Door Toggle & Options */}
                            <div className="flex flex-col gap-2 p-2.5 bg-black/10 rounded-lg border border-panel-border/30">
                                <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none py-0.5 hover:text-text-primary transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={selectedEdge.hasDoor || false}
                                        onChange={(e) => onUpdateEdgeProperties(selectedEdge.id, { hasDoor: e.target.checked })}
                                        className="w-4 h-4 rounded border-panel-border bg-black/25 text-primary focus:ring-primary focus:ring-offset-0 focus:ring-1"
                                    />
                                    <span>Inkludera dörr i väggen</span>
                                </label>

                                {(selectedEdge.hasDoor || false) && (
                                    <div className="flex flex-col gap-1.5 pl-6 border-l border-panel-border/40 mt-1 animate-slide-in">
                                        <label className="text-[11px] text-text-secondary">Dörrstorlek</label>
                                        <select
                                            value={selectedEdge.doorSize || 1000}
                                            onChange={(e) => onUpdateEdgeProperties(selectedEdge.id, { doorSize: parseInt(e.target.value, 10) })}
                                            className="px-2 py-1 bg-black/20 border border-panel-border rounded text-[11px] text-text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
                                        >
                                            <option value="700" className="bg-panel-bg">700 mm</option>
                                            <option value="1000" className="bg-panel-bg">1000 mm (Standard)</option>
                                            <option value="1100" className="bg-panel-bg">1100 mm</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Edge section lengths visualization */}
                        <div className="mt-2 border-t border-panel-border/40 pt-3">
                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Sektionsuppdelning</span>
                            <h4 className="text-xs font-semibold text-text-primary m-0 mt-0.5 mb-2">Beräknade Glassektioner</h4>
                            {edgeSections.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                    {edgeSections.map((sec, idx) => {
                                        const parsed = parseSection(sec);
                                        const isDoor = parsed.kind === 'door';
                                        return (
                                            <span
                                                key={idx}
                                                className={`px-2 py-1 text-xs font-bold rounded-lg border shadow-sm ${
                                                    isDoor
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                        : 'bg-primary/10 text-primary border-primary/20'
                                                }`}
                                            >
                                                {isDoor ? `🚪 Dörr ${parsed.length} mm` : `${parsed.length} mm`}
                                            </span>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-red-400 mt-1">
                                    ⚠️ Längden är för kort för sektionsdelning (minst 1000 mm).
                                </p>
                            )}
                        </div>

                        <div className="text-[11px] text-text-secondary flex flex-col gap-1 border-t border-panel-border/40 pt-3">
                            <div className="flex justify-between">
                                <span>Start:</span>
                                <span className="font-mono">{Math.round(startNode.x * scale)}, {Math.round(startNode.y * scale)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Slut:</span>
                                <span className="font-mono">{Math.round(endNode.x * scale)}, {Math.round(endNode.y * scale)}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 mt-2">
                            <button
                                onClick={() => onSplitEdge(selectedEdge.id)}
                                className="w-full py-1.5 border border-primary/30 hover:border-primary hover:bg-primary/10 text-primary hover:text-primary-hover text-xs font-semibold rounded transition-all"
                            >
                                Dela vägg (Lägg till brytpunkt)
                            </button>
                            <button
                                onClick={() => onDeleteEdge(selectedEdge.id)}
                                className="w-full py-1.5 border border-red-500/30 hover:border-red-500 hover:bg-red-500/10 text-red-400 hover:text-red-300 text-xs font-semibold rounded transition-all"
                            >
                                Ta bort vägg
                            </button>
                        </div>
                    </div>
                )}

                {/* Selected Node Inspector */}
                {selectedNode && !selectedEdge && (
                    <div className="flex flex-col gap-4 p-4 bg-panel-hover rounded-xl border border-panel-border border-l-4 border-l-secondary animate-slide-in">
                        <div>
                            <span className="text-[10px] font-bold text-secondary uppercase tracking-widest text-[#64b5f6]">Vald Punkt</span>
                            <h4 className="text-sm font-semibold text-text-primary m-0 mt-0.5">Hörnkoordinater</h4>
                        </div>

                        <form onSubmit={handleNodeSubmit} className="flex flex-col gap-3">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-text-secondary">X (mm)</label>
                                    <input
                                        type="number"
                                        value={nodeXInput}
                                        onChange={(e) => setNodeXInput(e.target.value)}
                                        className="w-full px-2 py-1 bg-black/20 border border-panel-border rounded text-sm text-text-primary focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-text-secondary">Y (mm)</label>
                                    <input
                                        type="number"
                                        value={nodeYInput}
                                        onChange={(e) => setNodeYInput(e.target.value)}
                                        className="w-full px-2 py-1 bg-black/20 border border-panel-border rounded text-sm text-text-primary focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="w-full py-1.5 bg-secondary hover:bg-opacity-90 text-black text-xs font-bold rounded transition-colors bg-[#64b5f6]"
                            >
                                Spara koordinater
                            </button>
                        </form>

                        <button
                            onClick={() => onDeleteNode(selectedNode.id)}
                            className="mt-1 w-full py-1.5 border border-red-500/30 hover:border-red-500 hover:bg-red-500/10 text-red-400 hover:text-red-300 text-xs font-semibold rounded transition-all"
                        >
                            Ta bort hörn
                        </button>
                    </div>
                )}

                {/* No Selection: Help, Walls list & BOM summary */}
                {!selectedNode && !selectedEdge && (
                    <div className="flex flex-col gap-6 animate-slide-in">
                        {/* Klickbar Vägglista */}
                        {edges.length > 0 && (
                            <div className="flex flex-col gap-2 p-4 bg-panel-hover rounded-xl border border-panel-border">
                                <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-2">
                                    Väggar i ritningen ({edges.length} st)
                                </h4>
                                <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                                    {edges.map((edge, idx) => {
                                        const start = nodes.find(n => n.id === edge.startNodeId);
                                        const end = nodes.find(n => n.id === edge.endNodeId);
                                        let len = 0;
                                        if (start && end) {
                                            len = Math.round(Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2) * scale);
                                        }
                                        const isWarning = len < 1000;
                                        return (
                                            <button
                                                key={edge.id}
                                                onClick={() => onSelectEdge(edge.id)}
                                                className={`flex justify-between items-center px-3 py-2 bg-black/20 hover:bg-white/5 border rounded-lg text-left text-xs transition-all hover:scale-[1.01] ${
                                                    isWarning
                                                        ? 'border-red-500/40 hover:border-red-500 text-red-200'
                                                        : 'border-panel-border/60 hover:border-panel-border'
                                                }`}
                                            >
                                                <span className="font-medium flex items-center gap-1">
                                                    {isWarning && <span>⚠️</span>}
                                                    <span className={isWarning ? 'text-red-400 font-bold' : 'text-text-secondary'}>Vägg {idx + 1}</span>
                                                </span>
                                                <span className={`font-mono font-semibold ${isWarning ? 'text-red-400' : 'text-primary'}`}>{len} mm</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* BOM Summary Card */}
                        {edges.length > 0 && (
                            <div className="flex flex-col gap-4 p-4 bg-panel-hover rounded-xl border border-panel-border border-l-4 border-l-secondary">
                                <div>
                                    <span className="text-[10px] font-bold text-secondary uppercase tracking-widest text-[#64b5f6]">Materiallista (BOM)</span>
                                    <h4 className="text-xs font-semibold text-text-primary m-0 mt-0.5">Sammanlagd Uppdelning</h4>
                                </div>

                                {hasTooShortEdges && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2 animate-pulse">
                                        <span className="text-xs leading-none">⚠️</span>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[11px] font-bold text-red-400">För korta väggar</span>
                                            <p className="text-[10px] text-text-secondary leading-relaxed m-0">
                                                Vissa väggar är under 1000 mm och kan inte delas upp i glassektioner. Justera deras längd för att inkludera dem i kalkylen.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col gap-2 pt-2 border-t border-panel-border/40">
                                    {Object.keys(bomCounts).length > 0 ? (
                                        Object.entries(bomCounts)
                                            .sort((a, b) => Number(b[0]) - Number(a[0]))
                                            .map(([size, count]) => (
                                                <div key={size} className="flex justify-between items-center text-xs py-0.5">
                                                    <span className="text-text-secondary">ClickitUp Sektion {size} mm</span>
                                                    <span className="px-2 py-0.5 bg-secondary/15 text-secondary font-bold rounded text-[11px] border border-secondary/20">
                                                        {count} st
                                                    </span>
                                                </div>
                                            ))
                                    ) : (
                                        <div className="text-xs text-text-muted italic py-1">Inga giltiga sektionslängder hittades.</div>
                                    )}

                                    {Object.keys(bomDoorCounts).length > 0 && (
                                        Object.entries(bomDoorCounts)
                                            .sort((a, b) => Number(b[0]) - Number(a[0]))
                                            .map(([size, count]) => (
                                                <div key={`door-${size}`} className="flex justify-between items-center text-xs py-0.5 border-t border-panel-border/20 pt-2 mt-1">
                                                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                                                        <span>🚪</span> ClickitUp Dörr {size} mm
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 font-bold rounded text-[11px] border border-emerald-500/20">
                                                        {count} st
                                                    </span>
                                                </div>
                                            ))
                                    )}

                                    {totalSlimlineCount > 0 && (
                                        <div className="flex justify-between items-center text-xs border-t border-panel-border/20 pt-2 mt-1">
                                            <span className="text-text-secondary flex items-center gap-1">
                                                Slimline-stolpe <span className="text-[10px] text-text-muted">(dörrmontering)</span>
                                            </span>
                                            <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 font-bold rounded text-[11px] border border-emerald-500/20">
                                                {totalSlimlineCount} st
                                            </span>
                                        </div>
                                    )}

                                    {stodbenCount > 0 && (
                                        <div className="flex justify-between items-center text-xs border-t border-panel-border/20 pt-2 mt-1">
                                            <span className="text-text-secondary flex items-center gap-1">
                                                Stödben 45° <span className="text-[10px] text-text-muted">(fria ändar)</span>
                                            </span>
                                            <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 font-bold rounded text-[11px] border border-emerald-500/20">
                                                {stodbenCount} st
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center text-xs border-t border-panel-border/40 pt-2 mt-2 font-semibold">
                                        <span className="text-text-primary">Total glaslängd:</span>
                                        <span className="text-text-primary font-mono">{(totalGlassLengthMm / 1000).toFixed(1)} m</span>
                                    </div>
                                </div>

                                {/* Export to Quote Button */}
                                <button
                                    onClick={onExportToQuote}
                                    className="mt-3 w-full py-2.5 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-xl shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="0" />
                                        <path d="M12 9v12m0 0l-3-3m3 3l3-3m-9-6h12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <span>Exportera till offert</span>
                                </button>
                            </div>
                        )}

                        {/* Blank slate description */}
                        {edges.length === 0 && (
                            <div className="bg-panel-hover p-4 rounded-lg border border-panel-border border-dashed flex flex-col items-center justify-center min-h-[100px] text-center">
                                <span className="text-xs text-text-muted">Inget ritat ännu</span>
                                <span className="text-[10px] text-text-secondary mt-1 max-w-[200px]">
                                    Välj Pekare och börja rita väggar eller klicka på en av snabbmallarna nedan.
                                </span>
                            </div>
                        )}

                        {/* Templates section */}
                        <div className="flex flex-col gap-3">
                            <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                                Snabbmallar (Templates)
                            </h4>
                            <p className="text-[11px] text-text-secondary leading-relaxed">
                                Skapa snabbt en grundritning med standardformer och anpassa sedan efter behov.
                            </p>

                            <div className="flex flex-col gap-2 mt-1">
                                <button
                                    onClick={() => onApplyTemplate('rect')}
                                    className="flex items-center gap-3 p-3 bg-panel-hover hover:bg-white/5 border border-panel-border rounded-xl transition-all hover:scale-[1.02] text-left group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                                        <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <rect x="4" y="6" width="16" height="12" rx="1.5" strokeWidth="2" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h5 className="text-xs font-semibold text-text-primary truncate">Rektangulär Form</h5>
                                        <p className="text-[10px] text-text-secondary truncate">Standard 4.0m x 3.0m yta</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => onApplyTemplate('lshape')}
                                    className="flex items-center gap-3 p-3 bg-panel-hover hover:bg-white/5 border border-panel-border rounded-xl transition-all hover:scale-[1.02] text-left group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/25 transition-colors">
                                        <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M5 5v14h14v-6H11V5H5z" strokeWidth="2" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h5 className="text-xs font-semibold text-text-primary truncate">L-Formad Yta</h5>
                                        <p className="text-[10px] text-text-secondary truncate">Hörnlösning för uteplatser</p>
                                    </div>
                                </button>

                                <button
                                    onClick={() => onApplyTemplate('ushape')}
                                    className="flex items-center gap-3 p-3 bg-panel-hover hover:bg-white/5 border border-panel-border rounded-xl transition-all hover:scale-[1.02] text-left group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-[#64b5f6]/10 border border-[#64b5f6]/20 flex items-center justify-center group-hover:bg-[#64b5f6]/25 transition-colors">
                                        <svg className="w-6 h-6 text-[#64b5f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path d="M5 5v14h14V5h-4v8H9V5H5z" strokeWidth="2" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h5 className="text-xs font-semibold text-text-primary truncate">U-Formad Yta</h5>
                                        <p className="text-[10px] text-text-secondary truncate">Innergård eller öppen vik</p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Reset / Actions */}
                        <div className="border-t border-panel-border pt-4 flex flex-col gap-2">
                            <button
                                onClick={onClearAll}
                                className="w-full py-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 text-xs font-semibold rounded-xl transition-all"
                            >
                                Rensa Hela Ritningen
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
