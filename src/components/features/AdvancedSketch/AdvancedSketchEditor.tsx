import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Circle, Line, Group, Rect, Text, Arc } from 'react-konva';
import type Konva from 'konva';
import {
    IconArrowBackUp,
    IconArrowForwardUp,
    IconArrowsMaximize,
    IconDownload,
    IconLine,
    IconPointer,
    IconRefresh,
    IconRulerMeasure,
    IconStack2
} from '@tabler/icons-react';
import { useQuote } from '../../../store/QuoteContext';
import { useAuth } from '../../../store/AuthContext';
import type { SketchToolProps, AdvancedNode, AdvancedEdge, SketchCamera } from '../../../types/contracts';
import { AdvancedSketchSidebar } from './AdvancedSketchSidebar';
import { toast } from 'react-hot-toast';
import { calculateSectionsForEdge, parseSection } from '../../../utils/sectionCalculator';
import {
    confirmAction,
    notifyError,
    notifySuccess,
    notifyWarn
} from '../../../services/notificationService';
import { buildAdvancedSketchDraft, buildAdvancedSketchTransfer } from './advancedSketchTransfer';
import { downloadBlob } from '../../../utils/fileUtils';
import {
    SketchResponsivePanel,
    SketchWorkspaceHeader,
    type SketchPanelTab
} from '../SketchWorkspace/SketchWorkspaceChrome';
import { useSketchDraftAutosave } from '../SketchWorkspace/useSketchDraftAutosave';

const SCALE = 10; // 1 pixel = 10 mm
const GRID_SIZE = 40; // 40 pixels = 400 mm grid line spacing

interface GuideLine {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    type: 'ortho' | 'align';
}

export function AdvancedSketchEditor({ onBack, onExportToQuoteComplete, modeToggleNode }: SketchToolProps) {
    const { state, dispatch } = useQuote();
    const { canExportSketchToQuote } = useAuth();
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage>(null);
    const initialNodesRef = useRef<AdvancedNode[]>(
        (state.advancedSketchDraft?.config.nodes || []).map((node) => ({ ...node }))
    );
    const initialEdgesRef = useRef<AdvancedEdge[]>(
        (state.advancedSketchDraft?.config.edges || []).map((edge) => ({ ...edge }))
    );
    const initialCameraRef = useRef<SketchCamera>(
        state.advancedSketchDraft?.workspace.camera
            ? { ...state.advancedSketchDraft.workspace.camera }
            : { zoom: 1, panX: 100, panY: 100 }
    );
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    
    // Core drawing states
    const [nodes, setNodes] = useState<AdvancedNode[]>(() => initialNodesRef.current);
    const [edges, setEdges] = useState<AdvancedEdge[]>(() => initialEdgesRef.current);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
    
    // Editor preferences
    const [drawMode, setDrawMode] = useState<'select' | 'draw'>('select');
    const [gridActive, setGridActive] = useState<boolean>(true);
    const [orthoActive, setOrthoActive] = useState<boolean>(true);
    const [activePanelTab, setActivePanelTab] = useState<SketchPanelTab>('drawing');
    const [panelOpen, setPanelOpen] = useState(true);
    
    // Interactive drawing states
    const [activeDrawNodeId, setActiveDrawNodeId] = useState<string | null>(null);
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
    const [guideLines, setGuideLines] = useState<GuideLine[]>([]);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

    // Zoom and pan state
    const [camera, setCamera] = useState<SketchCamera>(() => initialCameraRef.current);
    const autosaveSnapshot = useMemo(
        () => buildAdvancedSketchDraft(nodes, edges, camera),
        [camera, edges, nodes]
    );
    const commitAutosaveSnapshot = useCallback((snapshot: typeof autosaveSnapshot) => {
        dispatch({
            type: 'UPDATE_STATE',
            payload: {
                advancedSketchDraft: snapshot
            }
        });
    }, [dispatch]);
    const {
        status: autosaveStatus,
        flush: flushAutosave
    } = useSketchDraftAutosave({
        snapshot: autosaveSnapshot,
        onSave: commitAutosaveSnapshot
    });

    // History for Undo/Redo
    const [history, setHistory] = useState<Array<{ nodes: AdvancedNode[]; edges: AdvancedEdge[] }>>(() => [{
        nodes: initialNodesRef.current,
        edges: initialEdgesRef.current
    }]);
    const [historyIndex, setHistoryIndex] = useState(0);

    // Resize observer to keep Stage responsive
    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            if (!entries[0]) return;
            const { width, height } = entries[0].contentRect;
            setDimensions({ width: width || 800, height: height || 600 });
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    // Push standard action to Undo/Redo history
    const pushState = (newNodes: AdvancedNode[], newEdges: AdvancedEdge[]) => {
        const nextHistory = history.slice(0, historyIndex + 1);
        nextHistory.push({ nodes: newNodes, edges: newEdges });
        if (nextHistory.length > 30) {
            nextHistory.shift();
        }
        setHistory(nextHistory);
        setHistoryIndex(nextHistory.length - 1);
    };

    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            const nextIndex = historyIndex - 1;
            setHistoryIndex(nextIndex);
            setNodes(history[nextIndex].nodes);
            setEdges(history[nextIndex].edges);
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
            setActiveDrawNodeId(null);
            toast.success('Ångrade ändring', { duration: 1500 });
        }
    }, [history, historyIndex]);

    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const nextIndex = historyIndex + 1;
            setHistoryIndex(nextIndex);
            setNodes(history[nextIndex].nodes);
            setEdges(history[nextIndex].edges);
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
            setActiveDrawNodeId(null);
            toast.success('Gjorde om ändring', { duration: 1500 });
        }
    }, [history, historyIndex]);

    // Handle ESC key to exit drawing mode or cancel active chain
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (activeDrawNodeId) {
                    cancelDrawingChain();
                } else {
                    setDrawMode('select');
                }
            } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
                if (e.shiftKey) {
                    handleRedo();
                } else {
                    handleUndo();
                }
            } else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
                handleRedo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeDrawNodeId, handleUndo, handleRedo]);

    useEffect(() => {
        if (!selectedNodeId && !selectedEdgeId) return;
        setActivePanelTab('properties');
        setPanelOpen(true);
    }, [selectedEdgeId, selectedNodeId]);

    // Aborts drawing and cleans up the active dangling node if it has no edges
    const cancelDrawingChain = () => {
        if (!activeDrawNodeId) return;
        const connectedEdges = edges.filter(e => e.startNodeId === activeDrawNodeId || e.endNodeId === activeDrawNodeId);
        if (connectedEdges.length === 0) {
            const updatedNodes = nodes.filter(n => n.id !== activeDrawNodeId);
            setNodes(updatedNodes);
            pushState(updatedNodes, edges);
        }
        setActiveDrawNodeId(null);
        setGuideLines([]);
        toast.success('Ritning avbruten');
    };

    // Advanced snapping coordinate solver
    const solveSnapping = (
        x: number,
        y: number,
        excludeId: string | null,
        startNode: AdvancedNode | null
    ) => {
        let snappedX = x;
        let snappedY = y;
        let localGuides: GuideLine[] = [];

        // 1. Grid snapping
        if (gridActive) {
            snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE;
            snappedY = Math.round(y / GRID_SIZE) * GRID_SIZE;
        } else {
            snappedX = Math.round(x / 10) * 10;
            snappedY = Math.round(y / 10) * 10;
        }

        // 2. Ortho snapping (90 degrees to active startNode)
        if (orthoActive && startNode) {
            const dx = Math.abs(snappedX - startNode.x);
            const dy = Math.abs(snappedY - startNode.y);
            const orthoThreshold = 15; // pixels
            if (dx < orthoThreshold) {
                snappedX = startNode.x;
                localGuides.push({
                    x1: startNode.x,
                    y1: startNode.y,
                    x2: startNode.x,
                    y2: snappedY,
                    type: 'ortho'
                });
            }
            if (dy < orthoThreshold) {
                snappedY = startNode.y;
                localGuides.push({
                    x1: startNode.x,
                    y1: startNode.y,
                    x2: snappedX,
                    y2: startNode.y,
                    type: 'ortho'
                });
            }
        }

        // 3. Node alignment snap (if not ortho-snapped to start node)
        if (localGuides.length === 0) {
            const alignmentThreshold = 10; // pixels
            let snapX: number | null = null;
            let snapY: number | null = null;
            let snapXNode: AdvancedNode | null = null;
            let snapYNode: AdvancedNode | null = null;

            for (const node of nodes) {
                if (node.id === excludeId) continue;
                if (Math.abs(snappedX - node.x) < alignmentThreshold && snapX === null) {
                    snapX = node.x;
                    snapXNode = node;
                }
                if (Math.abs(snappedY - node.y) < alignmentThreshold && snapY === null) {
                    snapY = node.y;
                    snapYNode = node;
                }
            }

            if (snapX !== null && snapXNode) {
                snappedX = snapX;
                localGuides.push({
                    x1: snapXNode.x,
                    y1: snapXNode.y,
                    x2: snappedX,
                    y2: snappedY,
                    type: 'align'
                });
            }
            if (snapY !== null && snapYNode) {
                snappedY = snapY;
                localGuides.push({
                    x1: snapYNode.x,
                    y1: snapYNode.y,
                    x2: snappedX,
                    y2: snappedY,
                    type: 'align'
                });
            }
        }

        return { x: snappedX, y: snappedY, guideLines: localGuides };
    };

    // Stage Interaction Functions
    const handleStageClick = (e: any) => {
        const stage = e.target.getStage();
        if (!stage) return;

        // Skip if panning the stage
        if (stage.isDragging()) return;

        // If clicking on a shape, let the shape handle clicks first
        if (e.target !== stage) return;

        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const worldX = (pointer.x - stage.x()) / stage.scaleX();
        const worldY = (pointer.y - stage.y()) / stage.scaleY();

        if (drawMode === 'draw') {
            const startNode = activeDrawNodeId ? nodes.find(n => n.id === activeDrawNodeId) : null;
            const snap = solveSnapping(worldX, worldY, null, startNode || null);

            const newNodeId = `node-${Date.now()}`;
            const newNode: AdvancedNode = { id: newNodeId, x: snap.x, y: snap.y };
            const nextNodes = [...nodes, newNode];
            let nextEdges = [...edges];

            if (activeDrawNodeId) {
                const newEdge: AdvancedEdge = {
                    id: `edge-${Date.now()}`,
                    startNodeId: activeDrawNodeId,
                    endNodeId: newNodeId
                };
                nextEdges.push(newEdge);
            }

            setNodes(nextNodes);
            setEdges(nextEdges);
            pushState(nextNodes, nextEdges);
            setActiveDrawNodeId(newNodeId);
            setSelectedNodeId(newNodeId);
            setSelectedEdgeId(null);
        } else {
            // De-select in select mode
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
        }
    };

    const handleStageMouseMove = (e: any) => {
        const stage = e.target.getStage();
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const worldX = (pointer.x - stage.x()) / stage.scaleX();
        const worldY = (pointer.y - stage.y()) / stage.scaleY();

        if (drawMode === 'draw') {
            const startNode = activeDrawNodeId ? nodes.find(n => n.id === activeDrawNodeId) : null;
            const snap = solveSnapping(worldX, worldY, null, startNode || null);
            setCursorPos({ x: snap.x, y: snap.y });
            setGuideLines(snap.guideLines);
        } else {
            setCursorPos(null);
            setGuideLines([]);
        }
    };

    const handleStageWheel = (e: any) => {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        if (!stage) return;

        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const zoomFactor = 1.15;
        const newScale = e.evt.deltaY < 0 ? oldScale * zoomFactor : oldScale / zoomFactor;
        const clampedScale = Math.max(0.15, Math.min(newScale, 8));

        setCamera({
            zoom: clampedScale,
            panX: pointer.x - mousePointTo.x * clampedScale,
            panY: pointer.y - mousePointTo.y * clampedScale
        });
    };

    const handleStageDragEnd = (e: any) => {
        if (e.target === e.target.getStage()) {
            setCamera({
                zoom: e.target.scaleX(),
                panX: e.target.x(),
                panY: e.target.y()
            });
        }
    };

    // Node Drag Handlers (Select Mode)
    const handleNodeDragStart = (id: string) => {
        setSelectedNodeId(id);
        setSelectedEdgeId(null);
    };

    const handleNodeDragMove = (e: any, id: string) => {
        const { x, y } = e.target.position();
        const snap = solveSnapping(x, y, id, null);

        // Lock actual coordinate on stage
        e.target.x(snap.x);
        e.target.y(snap.y);

        // Update state to stretch lines in real-time
        setNodes(nodes.map(n => n.id === id ? { ...n, x: snap.x, y: snap.y } : n));
        setGuideLines(snap.guideLines);
    };

    const handleNodeDragEnd = (e: any, id: string) => {
        setGuideLines([]);
        pushState(nodes, edges);
    };

    // Node Click Handlers
    const handleNodeClick = (e: any, id: string) => {
        e.cancelBubble = true; // Stop event bubbling to stage

        if (drawMode === 'draw') {
            if (activeDrawNodeId) {
                // If clicking first node of current chain: Close loop!
                const chainNodes = getDrawingChainNodes();
                if (chainNodes.length > 2 && chainNodes[0].id === id) {
                    const newEdge: AdvancedEdge = {
                        id: `edge-${Date.now()}`,
                        startNodeId: activeDrawNodeId,
                        endNodeId: id
                    };
                    const nextEdges = [...edges, newEdge];
                    setEdges(nextEdges);
                    pushState(nodes, nextEdges);
                    setActiveDrawNodeId(null);
                    setGuideLines([]);
                    toast.success('Sluten slinga ritad!');
                    return;
                }

                // Connect to another existing node
                if (activeDrawNodeId !== id) {
                    const newEdge: AdvancedEdge = {
                        id: `edge-${Date.now()}`,
                        startNodeId: activeDrawNodeId,
                        endNodeId: id
                    };
                    const nextEdges = [...edges, newEdge];
                    setEdges(nextEdges);
                    pushState(nodes, nextEdges);
                    setActiveDrawNodeId(id); // Continue chain from this node
                    return;
                }
            } else {
                // Start drawing chain from existing node
                setActiveDrawNodeId(id);
                setSelectedNodeId(id);
                setSelectedEdgeId(null);
            }
        } else {
            setSelectedNodeId(id);
            setSelectedEdgeId(null);
        }
    };

    // Compute all nodes in the current open drawing chain
    const getDrawingChainNodes = (): AdvancedNode[] => {
        if (!activeDrawNodeId) return [];
        
        // Trace back connected nodes of current active segment
        let chain: AdvancedNode[] = [];
        let currentId = activeDrawNodeId;
        let visited = new Set<string>();

        while (currentId) {
            visited.add(currentId);
            const node = nodes.find(n => n.id === currentId);
            if (node) chain.unshift(node); // Keep chronological order

            // Find an edge ending at currentId that is connected in the chain
            const prevEdge = edges.find(e => e.endNodeId === currentId && !visited.has(e.startNodeId));
            if (prevEdge) {
                currentId = prevEdge.startNodeId;
            } else {
                break;
            }
        }
        return chain;
    };

    // Sidebar callback implementations
    const handleUpdateNode = (id: string, x: number, y: number) => {
        const snappedX = Math.round(x / 10) * 10;
        const snappedY = Math.round(y / 10) * 10;
        
        const originalXMm = Math.round(x * SCALE);
        const originalYMm = Math.round(y * SCALE);
        const snappedXMm = Math.round(snappedX * SCALE);
        const snappedYMm = Math.round(snappedY * SCALE);
        
        if (snappedXMm !== originalXMm || snappedYMm !== originalYMm) {
            toast.success(`Hörnkoordinaterna har avrundats till närmaste 100 mm (X: ${snappedXMm} mm, Y: ${snappedYMm} mm).`, { id: 'node-round-info' });
        } else {
            toast.success('Hörn uppdaterat');
        }
        
        const nextNodes = nodes.map(n => n.id === id ? { ...n, x: snappedX, y: snappedY } : n);
        setNodes(nextNodes);
        pushState(nextNodes, edges);
    };

    const handleDeleteNode = (id: string) => {
        const nextNodes = nodes.filter(n => n.id !== id);
        // Clean up connected edges
        const nextEdges = edges.filter(e => e.startNodeId !== id && e.endNodeId !== id);
        setNodes(nextNodes);
        setEdges(nextEdges);
        pushState(nextNodes, nextEdges);
        setSelectedNodeId(null);
        if (activeDrawNodeId === id) setActiveDrawNodeId(null);
        toast.success('Hörn borttaget');
    };

    const handleUpdateEdgeLength = (edgeId: string, newLengthMm: number) => {
        const edge = edges.find(e => e.id === edgeId);
        if (!edge) return;

        let finalLengthMm = Math.round(newLengthMm / 100) * 100;
        if (finalLengthMm < 1000) {
            finalLengthMm = 1000;
            toast('Minsta vägglängd är 1000 mm. Värdet har justerats.', { id: 'min-length-warn' });
        } else if (finalLengthMm !== newLengthMm) {
            toast.success(`Längden har avrundats till närmaste 100 mm (${finalLengthMm} mm).`, { id: 'round-length-info' });
        }

        const start = nodes.find(n => n.id === edge.startNodeId);
        const end = nodes.find(n => n.id === edge.endNodeId);
        if (!start || !end) return;

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) return;

        const newLenPx = finalLengthMm / SCALE;
        const targetEndX = start.x + (dx / len) * newLenPx;
        const targetEndY = start.y + (dy / len) * newLenPx;

        // Snapping shifted end coordinates keeps points perfectly aligned!
        const snappedEndX = Math.round(targetEndX / 10) * 10;
        const snappedEndY = Math.round(targetEndY / 10) * 10;

        const nextNodes = nodes.map(n => n.id === end.id ? { ...n, x: snappedEndX, y: snappedEndY } : n);
        setNodes(nextNodes);
        pushState(nextNodes, edges);

        const actualDx = snappedEndX - start.x;
        const actualDy = snappedEndY - start.y;
        const actualLenMm = Math.round(Math.sqrt(actualDx * actualDx + actualDy * actualDy) * SCALE);

        toast.success(`Vägglängd satt till ${actualLenMm} mm`);
    };

    const handleUpdateEdgeProperties = (edgeId: string, updates: Partial<AdvancedEdge>) => {
        const nextEdges = edges.map(e => e.id === edgeId ? { ...e, ...updates } : e);
        setEdges(nextEdges);
        pushState(nodes, nextEdges);
    };

    const handleDeleteEdge = (edgeId: string) => {
        const nextEdges = edges.filter(e => e.id !== edgeId);
        setEdges(nextEdges);
        pushState(nodes, nextEdges);
        setSelectedEdgeId(null);
        toast.success('Vägg borttagen');
    };

    const handleSplitEdge = (edgeId: string) => {
        const edgeToSplit = edges.find(e => e.id === edgeId);
        if (!edgeToSplit) return;
        
        const startNode = nodes.find(n => n.id === edgeToSplit.startNodeId);
        const endNode = nodes.find(n => n.id === edgeToSplit.endNodeId);
        if (!startNode || !endNode) return;

        const mx = (startNode.x + endNode.x) / 2;
        const my = (startNode.y + endNode.y) / 2;

        const newNodeId = `node-${Date.now()}`;
        const newNode: AdvancedNode = { id: newNodeId, x: mx, y: my };

        const newEdge1: AdvancedEdge = {
            ...edgeToSplit,
            id: `edge-${Date.now()}-1`,
            startNodeId: startNode.id,
            endNodeId: newNode.id
        };

        const newEdge2: AdvancedEdge = {
            ...edgeToSplit,
            id: `edge-${Date.now()}-2`,
            startNodeId: newNode.id,
            endNodeId: endNode.id
        };

        const nextNodes = [...nodes, newNode];
        const nextEdges = edges.filter(e => e.id !== edgeId).concat([newEdge1, newEdge2]);

        setNodes(nextNodes);
        setEdges(nextEdges);
        pushState(nextNodes, nextEdges);
        
        setSelectedEdgeId(null);
        setSelectedNodeId(newNodeId);
        toast.success('Vägg delad på mitten');
    };

    const handleApplyTemplate = (templateType: 'rect' | 'lshape' | 'ushape') => {
        const cx = 400;
        const cy = 300;
        let tNodes: AdvancedNode[] = [];
        let tEdges: AdvancedEdge[] = [];

        if (templateType === 'rect') {
            tNodes = [
                { id: 'n1', x: cx - 200, y: cy - 150 },
                { id: 'n2', x: cx + 200, y: cy - 150 },
                { id: 'n3', x: cx + 200, y: cy + 150 },
                { id: 'n4', x: cx - 200, y: cy + 150 },
            ];
            tEdges = [
                { id: 'e1', startNodeId: 'n1', endNodeId: 'n2' },
                { id: 'e2', startNodeId: 'n2', endNodeId: 'n3' },
                { id: 'e3', startNodeId: 'n3', endNodeId: 'n4' },
                { id: 'e4', startNodeId: 'n4', endNodeId: 'n1' },
            ];
        } else if (templateType === 'lshape') {
            tNodes = [
                { id: 'n1', x: cx - 200, y: cy - 150 },
                { id: 'n2', x: cx + 100, y: cy - 150 },
                { id: 'n3', x: cx + 100, y: cy + 50 },
                { id: 'n4', x: cx + 200, y: cy + 50 },
                { id: 'n5', x: cx + 200, y: cy + 150 },
                { id: 'n6', x: cx - 200, y: cy + 150 },
            ];
            tEdges = [
                { id: 'e1', startNodeId: 'n1', endNodeId: 'n2' },
                { id: 'e2', startNodeId: 'n2', endNodeId: 'n3' },
                { id: 'e3', startNodeId: 'n3', endNodeId: 'n4' },
                { id: 'e4', startNodeId: 'n4', endNodeId: 'n5' },
                { id: 'e5', startNodeId: 'n5', endNodeId: 'n6' },
                { id: 'e6', startNodeId: 'n6', endNodeId: 'n1' },
            ];
        } else if (templateType === 'ushape') {
            tNodes = [
                { id: 'n1', x: cx - 200, y: cy - 150 },
                { id: 'n2', x: cx - 100, y: cy - 150 },
                { id: 'n3', x: cx - 100, y: cy + 50 },
                { id: 'n4', x: cx + 100, y: cy + 50 },
                { id: 'n5', x: cx + 100, y: cy - 150 },
                { id: 'n6', x: cx + 200, y: cy - 150 },
                { id: 'n7', x: cx + 200, y: cy + 150 },
                { id: 'n8', x: cx - 200, y: cy + 150 },
            ];
            tEdges = [
                { id: 'e1', startNodeId: 'n1', endNodeId: 'n2' },
                { id: 'e2', startNodeId: 'n2', endNodeId: 'n3' },
                { id: 'e3', startNodeId: 'n3', endNodeId: 'n4' },
                { id: 'e4', startNodeId: 'n4', endNodeId: 'n5' },
                { id: 'e5', startNodeId: 'n5', endNodeId: 'n6' },
                { id: 'e6', startNodeId: 'n6', endNodeId: 'n7' },
                { id: 'e7', startNodeId: 'n7', endNodeId: 'n8' },
                { id: 'e8', startNodeId: 'n8', endNodeId: 'n1' },
            ];
        }

        setNodes(tNodes);
        setEdges(tEdges);
        pushState(tNodes, tEdges);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setActiveDrawNodeId(null);
        setCamera({ zoom: 1, panX: 100, panY: 100 });
        toast.success('Mallen har applicerats!');
    };

    const handleClearAll = async () => {
        if (nodes.length === 0) return;
        const confirmed = await confirmAction({
            title: 'Börja om med ritningen?',
            message: 'Alla väggar och punkter i den avancerade ritningen tas bort. Det här går inte att ångra.',
            confirmText: 'Börja om',
            cancelText: 'Behåll ritningen',
            tone: 'danger'
        });
        if (!confirmed) return;

        setNodes([]);
        setEdges([]);
        pushState([], []);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setActiveDrawNodeId(null);
        toast.success('Ritningen har rensats');
    };

    const handleExportToQuote = useCallback(() => {
        flushAutosave();
        if (!canExportSketchToQuote) {
            notifyError('Du har inte behörighet att överföra ritningen till en offert.');
            return;
        }

        const result = buildAdvancedSketchTransfer({
            nodes,
            edges,
            camera,
            quoteState: state
        });
        if (result.error === 'empty-sketch') {
            notifyError('Ritningen är tom. Lägg till minst en vägg för att överföra den.');
            return;
        }
        if (result.error === 'no-valid-edges' || !result.patch) {
            notifyError('Ritningen innehåller inga väggar som uppfyller minimilängden på 1000 mm.');
            return;
        }
        if (result.excludedEdgeCount > 0) {
            notifyWarn(`${result.excludedEdgeCount} väggar under 1000 mm har inte tagits med i offerten.`);
        }

        dispatch({ type: 'UPDATE_STATE', payload: result.patch });
        notifySuccess('Ritningen har överförts till offerten.');
        onExportToQuoteComplete?.();
    }, [camera, canExportSketchToQuote, dispatch, edges, flushAutosave, nodes, onExportToQuoteComplete, state]);

    const handleExportImage = useCallback(async () => {
        flushAutosave();
        const stage = stageRef.current;
        if (!stage || edges.length === 0) {
            notifyError('Ritningen är tom. Rita minst en vägg innan du laddar ner bilden.');
            return;
        }

        try {
            const dataUrl = stage.toDataURL({ pixelRatio: 2 });
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            downloadBlob(blob, `Uteservering_Avancerad_${edges.length}_vaggar.png`);
            notifySuccess('Ritningsbilden har laddats ner.');
        } catch (error) {
            console.error('Failed to export advanced sketch image', error);
            notifyError('Kunde inte skapa en bild av ritningen.');
        }
    }, [edges.length, flushAutosave]);

    const handleBackClick = useCallback(() => {
        flushAutosave();
        onBack?.();
    }, [flushAutosave, onBack]);

    // Dynamic grid line rendering
    const renderGridLines = () => {
        if (!gridActive) return null;
        const lines = [];
        const minVal = -1500;
        const maxVal = 2500;

        for (let x = minVal; x <= maxVal; x += GRID_SIZE) {
            lines.push(
                <Line
                    key={`grid-x-${x}`}
                    points={[x, minVal, x, maxVal]}
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth={1}
                    listening={false}
                />
            );
        }
        for (let y = minVal; y <= maxVal; y += GRID_SIZE) {
            lines.push(
                <Line
                    key={`grid-y-${y}`}
                    points={[minVal, y, maxVal, y]}
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth={1}
                    listening={false}
                />
            );
        }
        return lines;
    };

    // Render the active drawing line with length preview
    const renderDrawPreview = () => {
        if (drawMode !== 'draw' || !activeDrawNodeId || !cursorPos) return null;
        
        const start = nodes.find(n => n.id === activeDrawNodeId);
        if (!start) return null;
        
        const dx = cursorPos.x - start.x;
        const dy = cursorPos.y - start.y;
        const distMm = Math.round(Math.sqrt(dx * dx + dy * dy) * SCALE);
        const mx = start.x + dx / 2;
        const my = start.y + dy / 2;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        const textRotation = angle > 90 || angle < -90 ? angle + 180 : angle;

        return (
            <Group listening={false}>
                <Line
                    points={[start.x, start.y, cursorPos.x, cursorPos.y]}
                    stroke="#ef4444"
                    strokeWidth={4}
                    dash={[10, 10]}
                />
                {distMm > 50 && (
                    <Group x={mx} y={my} rotation={textRotation}>
                        <Rect
                            x={-24}
                            y={-12}
                            width={48}
                            height={16}
                            fill="rgba(239, 68, 68, 0.9)"
                            cornerRadius={4}
                        />
                        <Text
                            text={`${distMm} mm`}
                            x={-24}
                            y={-8}
                            width={48}
                            align="center"
                            fontSize={9}
                            fontStyle="bold"
                            fontFamily="Outfit, Inter, sans-serif"
                            fill="white"
                        />
                    </Group>
                )}
            </Group>
        );
    };

    // Render angles for connected edges
    const renderAngles = () => {
        const angleElements: React.ReactNode[] = [];
        
        nodes.forEach(node => {
            const connectedEdges = edges.filter(e => e.startNodeId === node.id || e.endNodeId === node.id);
            if (connectedEdges.length === 2) {
                const edge1 = connectedEdges[0];
                const edge2 = connectedEdges[1];
                
                const otherNode1 = nodes.find(n => n.id === (edge1.startNodeId === node.id ? edge1.endNodeId : edge1.startNodeId));
                const otherNode2 = nodes.find(n => n.id === (edge2.startNodeId === node.id ? edge2.endNodeId : edge2.startNodeId));
                
                if (otherNode1 && otherNode2) {
                    const dx1 = otherNode1.x - node.x;
                    const dy1 = otherNode1.y - node.y;
                    const dx2 = otherNode2.x - node.x;
                    const dy2 = otherNode2.y - node.y;
                    
                    let a1 = Math.atan2(dy1, dx1) * (180 / Math.PI);
                    let a2 = Math.atan2(dy2, dx2) * (180 / Math.PI);
                    
                    if (a1 < 0) a1 += 360;
                    if (a2 < 0) a2 += 360;
                    
                    let angleDiff = Math.abs(a2 - a1);
                    let startAngle = Math.min(a1, a2);
                    
                    if (angleDiff > 180) {
                        angleDiff = 360 - angleDiff;
                        startAngle = Math.max(a1, a2);
                    }
                    
                    const degrees = Math.round(angleDiff);
                    
                    if (degrees > 0 && degrees < 180) {
                        const bisectAngle = startAngle + angleDiff / 2;
                        const bisectRad = bisectAngle * (Math.PI / 180);
                        const radius = 25;
                        
                        angleElements.push(
                            <Group key={`angle-${node.id}`} x={node.x} y={node.y}>
                                <Arc
                                    innerRadius={0}
                                    outerRadius={radius}
                                    angle={angleDiff}
                                    rotation={startAngle}
                                    fill="rgba(56, 189, 248, 0.15)"
                                    stroke="#38bdf8"
                                    strokeWidth={1.5}
                                    listening={false}
                                />
                                <Text
                                    text={`${degrees}°`}
                                    x={Math.cos(bisectRad) * (radius + 12) - 15}
                                    y={Math.sin(bisectRad) * (radius + 12) - 6}
                                    fontSize={10}
                                    fontStyle="bold"
                                    fontFamily="Outfit, Inter, sans-serif"
                                    fill="#7dd3fc"
                                    width={30}
                                    align="center"
                                />
                            </Group>
                        );
                    }
                }
            }
        });
        
        return angleElements;
    };

    // Draw dimension labels
    const renderDimensionLabels = () => {
        return edges.map(edge => {
            const start = nodes.find(n => n.id === edge.startNodeId);
            const end = nodes.find(n => n.id === edge.endNodeId);
            if (!start || !end) return null;

            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const lengthMm = Math.sqrt(dx * dx + dy * dy) * SCALE;

            if (lengthMm < 10) return null;

            // Midpoint
            const mx = (start.x + end.x) / 2;
            const my = (start.y + end.y) / 2;

            // Normal offset
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = -dy / len;
            const ny = dx / len;

            // Rotate text to follow line
            let rotation = Math.atan2(dy, dx) * (180 / Math.PI);
            if (rotation > 90 || rotation < -90) {
                rotation += 180;
            }

            const isSelected = selectedEdgeId === edge.id;
            const isWarning = lengthMm < 1000;
            const pillWidth = isWarning ? 94 : 76;
            const pillX = -pillWidth / 2;
            const labelText = isWarning ? `För kort: ${Math.round(lengthMm)} mm` : `${Math.round(lengthMm)} mm`;

            return (
                <Group key={`dim-${edge.id}`} x={mx + nx * 20} y={my + ny * 20} rotation={rotation}>
                    <Rect
                        x={pillX}
                        y={-9}
                        width={pillWidth}
                        height={18}
                        fill={isSelected ? '#3b82f6' : isWarning ? '#7f1d1d' : '#1e2230'}
                        stroke={isSelected ? '#ffffff' : isWarning ? '#ef4444' : '#4a90e2'}
                        strokeWidth={1}
                        cornerRadius={4}
                        shadowColor="black"
                        shadowBlur={4}
                        shadowOpacity={0.3}
                        shadowOffset={{ x: 1, y: 1 }}
                        opacity={0.9}
                    />
                    <Text
                        text={labelText}
                        fontSize={9.5}
                        fontStyle="bold"
                        fontFamily="Outfit, Inter, sans-serif"
                        fill={isSelected ? '#ffffff' : isWarning ? '#fca5a5' : '#e2e8f0'}
                        width={pillWidth}
                        height={18}
                        align="center"
                        verticalAlign="middle"
                        x={pillX}
                        y={-9}
                    />
                </Group>
            );
        });
    };

    // Currently selected objects helper
    const selectedNode = nodes.find(n => n.id === selectedNodeId) || null;
    const selectedEdge = edges.find(e => e.id === selectedEdgeId) || null;
    let shortEdgeCount = 0;
    let sectionCount = 0;
    edges.forEach((edge) => {
        const startNode = nodes.find((node) => node.id === edge.startNodeId);
        const endNode = nodes.find((node) => node.id === edge.endNodeId);
        if (!startNode || !endNode) return;
        const lengthMm = Math.hypot(endNode.x - startNode.x, endNode.y - startNode.y) * SCALE;
        if (lengthMm < 1000) {
            shortEdgeCount += 1;
            return;
        }
        sectionCount += calculateSectionsForEdge(lengthMm, edge.hasDoor || false, {
            prioMode: edge.prioMode || 'symmetrical',
            targetLength: edge.targetLength || 1500,
            doorSize: edge.doorSize || 1000
        }).length;
    });
    const readinessTone = edges.length === 0
        ? 'danger' as const
        : shortEdgeCount > 0
            ? 'warning' as const
            : 'success' as const;
    const readinessLabel = edges.length === 0
        ? (canExportSketchToQuote ? 'Kan inte överföras' : 'Kan inte laddas ner')
        : shortEdgeCount > 0
            ? `Kontrollera ${shortEdgeCount} problem`
            : (canExportSketchToQuote ? 'Redo att överföra' : 'Redo att ladda ner');
    const openMaterialPanel = () => {
        setActivePanelTab('material');
        setPanelOpen(true);
    };

    return (
        <div
            data-surface="advanced-sketch-editor"
            className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-panel-border bg-panel-bg"
        >
            <SketchWorkspaceHeader
                modeToggleNode={modeToggleNode}
                onBack={handleBackClick}
                saveStatus={autosaveStatus}
                readiness={{
                    label: readinessLabel,
                    tone: readinessTone,
                    onClick: openMaterialPanel
                }}
                primaryAction={canExportSketchToQuote
                    ? {
                        label: 'Överför till offert',
                        onClick: handleExportToQuote,
                        disabled: edges.length === 0
                    }
                    : {
                        label: 'Ladda ner bild',
                        onClick: () => {
                            void handleExportImage();
                        },
                        disabled: edges.length === 0
                    }}
                secondaryAction={canExportSketchToQuote
                    ? {
                        label: 'Ladda ner bild',
                        onClick: () => {
                            void handleExportImage();
                        },
                        disabled: edges.length === 0
                    }
                    : undefined}
                overflowActions={[
                    {
                        label: 'Ladda ner bild',
                        icon: <IconDownload aria-hidden="true" size={17} stroke={1.8} />,
                        onClick: () => {
                            void handleExportImage();
                        },
                        disabled: edges.length === 0
                    },
                    {
                        label: 'Börja om',
                        icon: <IconRefresh aria-hidden="true" size={17} stroke={1.8} />,
                        onClick: () => {
                            void handleClearAll();
                        },
                        disabled: edges.length === 0,
                        tone: 'danger'
                    }
                ]}
            />

            {/* Stage Action Toolbar */}
            <div className="flex min-h-12 flex-none items-center justify-between gap-2 overflow-x-auto border-b border-panel-border bg-panel-bg px-2 py-1.5 sm:px-3">
                <div className="flex shrink-0 items-center gap-1 rounded-control border border-control-border bg-surface p-1">
                    <button
                        type="button"
                        onClick={() => {
                            if (activeDrawNodeId) cancelDrawingChain();
                            setDrawMode('select');
                        }}
                        className={`inline-flex min-h-8 items-center gap-2 rounded-control px-3 text-xs font-semibold transition-colors ${
                            drawMode === 'select'
                                ? 'bg-action-soft text-action-soft-text'
                                : 'text-text-muted hover:bg-surface-hover hover:text-text'
                        }`}
                        title="Välj och flytta hörn (Esc)"
                    >
                        <IconPointer aria-hidden="true" size={17} stroke={1.8} />
                        <span>Pekare</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setDrawMode('draw')}
                        className={`inline-flex min-h-8 items-center gap-2 rounded-control px-3 text-xs font-semibold transition-colors ${
                            drawMode === 'draw'
                                ? 'bg-action-soft text-action-soft-text'
                                : 'text-text-muted hover:bg-surface-hover hover:text-text'
                        }`}
                        title="Rita nya väggar"
                    >
                        <IconLine aria-hidden="true" size={17} stroke={1.8} />
                        <span>Rita väggar</span>
                    </button>
                </div>

                {/* Draw Helper Status Message */}
                <div className="hidden min-w-0 flex-1 truncate text-center text-xs font-medium text-text-muted lg:block">
                    {drawMode === 'draw' ? (
                        activeDrawNodeId ? (
                            <span className="text-action-soft-text">
                                Klicka på startpunkten för att stänga, Esc för att avsluta väggkedjan.
                            </span>
                        ) : (
                            <span>Klicka var som helst på ritytan för att sätta första hörnet.</span>
                        )
                    ) : (
                        <span>Dra i blå punkter för att flytta hörn. Klicka på en vägg för att sätta längd.</span>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    {/* Undo/Redo */}
                    <div className="flex rounded-control border border-control-border bg-surface p-1">
                        <button
                            type="button"
                            aria-label="Ångra"
                            onClick={handleUndo}
                            disabled={historyIndex <= 0}
                            className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-35"
                            title="Ångra (Ctrl+Z)"
                        >
                            <IconArrowBackUp aria-hidden="true" size={17} stroke={1.8} />
                        </button>
                        <button
                            type="button"
                            aria-label="Gör om"
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                            className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-control text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-35"
                            title="Gör om (Ctrl+Y)"
                        >
                            <IconArrowForwardUp aria-hidden="true" size={17} stroke={1.8} />
                        </button>
                    </div>

                    {/* Fit View */}
                    <button
                        type="button"
                        aria-label="Anpassa vy"
                        onClick={() => setCamera({ zoom: 1, panX: 100, panY: 100 })}
                        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-control border border-control-border bg-surface text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
                        title="Återställ vy"
                    >
                        <IconArrowsMaximize aria-hidden="true" size={18} stroke={1.8} />
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div
                data-surface="advanced-sketch-workspace"
                className="relative flex min-h-0 flex-1 basis-0 flex-col overflow-hidden md:flex-row"
            >
                <div
                    className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#090b11]"
                >
                    <div
                        ref={containerRef}
                        id="sketch-workspace-canvas"
                        data-surface="advanced-sketch-canvas"
                        className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
                    >
                        <Stage
                            ref={stageRef}
                            width={dimensions.width}
                            height={dimensions.height}
                            scaleX={camera.zoom}
                            scaleY={camera.zoom}
                            x={camera.panX}
                            y={camera.panY}
                            draggable={drawMode === 'select' && !selectedNodeId}
                            onWheel={handleStageWheel}
                            onClick={handleStageClick}
                            onMouseMove={handleStageMouseMove}
                            onDragEnd={handleStageDragEnd}
                            onContextMenu={(e) => {
                                e.evt.preventDefault();
                                if (activeDrawNodeId) cancelDrawingChain();
                            }}
                        >
                        <Layer>
                            {/* Gridlines */}
                            {renderGridLines()}

                            {/* Snapping Guide lines */}
                            {guideLines.map((guide, idx) => (
                                <Line
                                    key={`guide-${idx}`}
                                    points={[guide.x1, guide.y1, guide.x2, guide.y2]}
                                    stroke={guide.type === 'ortho' ? '#ef4444' : '#06b6d4'}
                                    strokeWidth={1}
                                    dash={[4, 4]}
                                    listening={false}
                                />
                            ))}

                            {/* Drawing active line preview */}
                            {renderDrawPreview()}

                            {/* Drawn Edges (Walls) */}
                            {edges.map(edge => {
                                const start = nodes.find(n => n.id === edge.startNodeId);
                                const end = nodes.find(n => n.id === edge.endNodeId);
                                if (!start || !end) return null;

                                const isSelected = selectedEdgeId === edge.id;
                                const isHovered = hoveredEdgeId === edge.id;

                                const edgeSectionsElements: React.ReactNode[] = [];
                                const edx = end.x - start.x;
                                const edy = end.y - start.y;
                                const elen = Math.sqrt(edx * edx + edy * edy);
                                if (elen > 0) {
                                    const elenMm = elen * SCALE;
                                    const sections = calculateSectionsForEdge(Math.round(elenMm), edge.hasDoor || false, {
                                        prioMode: edge.prioMode || 'symmetrical',
                                        targetLength: edge.targetLength || 1500,
                                        doorSize: edge.doorSize || 1000
                                    });
                                    const totalSecSum = sections.reduce<number>((sum, s) => {
                                        const parsed = parseSection(s);
                                        return sum + parsed.length;
                                    }, 0);
                                    if (totalSecSum > 0) {
                                        let currentDistancePx = 0;
                                        const enx = -edy / elen;
                                        const eny = edx / elen;
                                        let erotation = Math.atan2(edy, edx) * (180 / Math.PI);
                                        if (erotation > 90 || erotation < -90) {
                                            erotation += 180;
                                        }

                                        sections.forEach((sec, idx) => {
                                            const parsed = parseSection(sec);
                                            const size = parsed.length;
                                            const isDoor = parsed.kind === 'door';
                                            if (size > 0) {
                                                const secLenPx = (size / totalSecSum) * elen;
                                                
                                                if (isDoor) {
                                                    const doorStartRatio = currentDistancePx / elen;
                                                    const doorEndRatio = (currentDistancePx + secLenPx) / elen;
                                                    const dsx = start.x + edx * doorStartRatio;
                                                    const dsy = start.y + edy * doorStartRatio;
                                                    const dex = start.x + edx * doorEndRatio;
                                                    const dey = start.y + edy * doorEndRatio;
                                                    edgeSectionsElements.push(
                                                        <Line
                                                            key={`sec-door-line-${edge.id}-${idx}`}
                                                            points={[dsx, dsy, dex, dey]}
                                                            stroke="#10b981"
                                                            strokeWidth={isSelected ? 6 : 4}
                                                            listening={false}
                                                        />
                                                    );
                                                }

                                                const midRatio = (currentDistancePx + secLenPx / 2) / elen;
                                                const mx = start.x + edx * midRatio;
                                                const my = start.y + edy * midRatio;
                                                
                                                edgeSectionsElements.push(
                                                    <Group 
                                                        key={`sec-badge-${edge.id}-${idx}`} 
                                                        x={mx - enx * 12} 
                                                        y={my - eny * 12} 
                                                        rotation={erotation}
                                                    >
                                                        <Rect
                                                            x={isDoor ? -24 : -16}
                                                            y={-6}
                                                            width={isDoor ? 48 : 32}
                                                            height={12}
                                                            fill={isDoor ? 'rgba(16, 185, 129, 0.15)' : (isSelected ? 'rgba(59, 130, 246, 0.15)' : '#0f172a')}
                                                            stroke={isDoor ? '#10b981' : (isSelected ? '#3b82f6' : '#475569')}
                                                            strokeWidth={0.8}
                                                            cornerRadius={3}
                                                            opacity={0.9}
                                                        />
                                                        <Text
                                                            text={isDoor ? `Dörr ${Math.round(size)}` : `${Math.round(size)}`}
                                                            fontSize={isDoor ? 6.5 : 7.5}
                                                            fontStyle="bold"
                                                            fontFamily="Outfit, Inter, sans-serif"
                                                            fill={isDoor ? '#34d399' : (isSelected ? '#60a5fa' : '#94a3b8')}
                                                            width={isDoor ? 48 : 32}
                                                            height={12}
                                                            align="center"
                                                            verticalAlign="middle"
                                                            x={isDoor ? -24 : -16}
                                                            y={-6}
                                                        />
                                                    </Group>
                                                );

                                                if (idx < sections.length - 1) {
                                                    const endRatio = (currentDistancePx + secLenPx) / elen;
                                                    const px = start.x + edx * endRatio;
                                                    const py = start.y + edy * endRatio;
                                                    edgeSectionsElements.push(
                                                        <Circle
                                                            key={`sec-post-${edge.id}-${idx}`}
                                                            x={px}
                                                            y={py}
                                                            radius={3.5}
                                                            fill={isSelected ? '#3b82f6' : '#e2e8f0'}
                                                            stroke="#0f172a"
                                                            strokeWidth={1}
                                                        />
                                                    );
                                                }

                                                currentDistancePx += secLenPx;
                                            }
                                        });
                                    }
                                }

                                return (
                                    <Group key={edge.id}>
                                        <Line
                                            points={[start.x, start.y, end.x, end.y]}
                                            stroke="transparent"
                                            strokeWidth={20}
                                            onClick={(e) => {
                                                e.cancelBubble = true;
                                                setSelectedEdgeId(edge.id);
                                                setSelectedNodeId(null);
                                            }}
                                            onMouseEnter={(e) => {
                                                setHoveredEdgeId(edge.id);
                                                const container = e.target.getStage()?.container();
                                                if (container) container.style.cursor = 'pointer';
                                            }}
                                            onMouseLeave={(e) => {
                                                setHoveredEdgeId(null);
                                                const container = e.target.getStage()?.container();
                                                if (container) container.style.cursor = 'default';
                                            }}
                                        />
                                        {/* Visual rendering line */}
                                        <Line
                                            points={[start.x, start.y, end.x, end.y]}
                                            stroke={
                                                isSelected
                                                    ? '#3b82f6'
                                                    : isHovered
                                                    ? (elen * SCALE < 1000 ? '#f87171' : '#60a5fa')
                                                    : (elen * SCALE < 1000 ? '#ef4444' : '#64748b')
                                            }
                                            strokeWidth={isSelected ? 6 : isHovered ? 5 : 4}
                                            listening={false}
                                        />
                                        {/* Render intermediate posts & sections dimension pills */}
                                        {edgeSectionsElements}
                                    </Group>
                                );
                            })}

                            {/* Angles */}
                            {renderAngles()}

                            {/* Dimension Labels */}
                            {renderDimensionLabels()}

                            {/* Nodes (Corners) */}
                            {nodes.map(node => {
                                const isSelected = selectedNodeId === node.id;
                                const isHovered = hoveredNodeId === node.id;
                                const isActiveDrawingNode = activeDrawNodeId === node.id;

                                return (
                                    <Circle
                                        key={node.id}
                                        x={node.x}
                                        y={node.y}
                                        radius={isSelected ? 9 : isHovered ? 8 : isActiveDrawingNode ? 8 : 6.5}
                                        fill={
                                            isActiveDrawingNode
                                                ? '#ef4444'
                                                : isSelected
                                                ? '#3b82f6'
                                                : isHovered
                                                ? '#60a5fa'
                                                : '#e2e8f0'
                                        }
                                        stroke="#1e293b"
                                        strokeWidth={1.5}
                                        draggable={drawMode === 'select'}
                                        onDragStart={() => handleNodeDragStart(node.id)}
                                        onDragMove={(e) => handleNodeDragMove(e, node.id)}
                                        onDragEnd={(e) => handleNodeDragEnd(e, node.id)}
                                        onClick={(e) => handleNodeClick(e, node.id)}
                                        onMouseEnter={(e) => {
                                            setHoveredNodeId(node.id);
                                            const container = e.target.getStage()?.container();
                                            if (container) {
                                                container.style.cursor = drawMode === 'select' ? 'grab' : 'crosshair';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            setHoveredNodeId(null);
                                            const container = e.target.getStage()?.container();
                                            if (container) container.style.cursor = 'default';
                                        }}
                                    />
                                );
                            })}
                            </Layer>
                        </Stage>
                    </div>

                    <div className="flex min-h-11 flex-none items-center gap-4 overflow-x-auto border-t border-panel-border bg-panel-bg px-3 text-xs text-text-muted sm:gap-6 sm:px-5">
                        <span className="inline-flex shrink-0 items-center gap-2">
                            <IconRulerMeasure aria-hidden="true" size={17} stroke={1.8} />
                            <span className="hidden sm:inline">Väggar</span>
                            <b className="tabular-nums text-text">{edges.length} st</b>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-2">
                            <IconStack2 aria-hidden="true" size={17} stroke={1.8} />
                            <span className="hidden sm:inline">Sektioner</span>
                            <b className="tabular-nums text-text">{sectionCount} st</b>
                        </span>
                        <button
                            type="button"
                            onClick={openMaterialPanel}
                            className={`ml-auto inline-flex min-h-8 shrink-0 items-center rounded-full border px-2.5 font-semibold transition-colors hover:brightness-110 ${readinessTone === 'success'
                                ? 'border-success-border bg-success-bg text-success-text'
                                : readinessTone === 'warning'
                                    ? 'border-warning-border bg-warning-bg text-warning-text'
                                    : 'border-danger-border bg-danger-bg text-danger-text'
                            }`}
                        >
                            {readinessLabel}
                        </button>
                    </div>
                </div>

                <SketchResponsivePanel
                    activeTab={activePanelTab}
                    materialCount={shortEdgeCount}
                    onTabChange={setActivePanelTab}
                    open={panelOpen}
                    onOpenChange={setPanelOpen}
                >
                    <AdvancedSketchSidebar
                        activeTab={activePanelTab}
                        selectedNode={selectedNode}
                        selectedEdge={selectedEdge}
                        nodes={nodes}
                        edges={edges}
                        onUpdateNode={handleUpdateNode}
                        onDeleteNode={handleDeleteNode}
                        onUpdateEdgeLength={handleUpdateEdgeLength}
                        onDeleteEdge={handleDeleteEdge}
                        onApplyTemplate={handleApplyTemplate}
                        onClearAll={() => {
                            void handleClearAll();
                        }}
                        gridActive={gridActive}
                        setGridActive={setGridActive}
                        orthoActive={orthoActive}
                        setOrthoActive={setOrthoActive}
                        scale={SCALE}
                        onSelectEdge={(edgeId) => setSelectedEdgeId(edgeId)}
                        onExportToQuote={handleExportToQuote}
                        canExportToQuote={canExportSketchToQuote}
                        onUpdateEdgeProperties={handleUpdateEdgeProperties}
                        onSplitEdge={handleSplitEdge}
                    />
                </SketchResponsivePanel>
            </div>
        </div>
    );
}
