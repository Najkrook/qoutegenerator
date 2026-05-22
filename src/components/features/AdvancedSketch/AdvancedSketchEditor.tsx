import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Circle, Line } from 'react-konva';
import type { SketchToolProps } from '../../../types/contracts';
import { AdvancedSketchSidebar } from './AdvancedSketchSidebar';

export function AdvancedSketchEditor({ onBack, modeToggleNode }: SketchToolProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [nodes, setNodes] = useState([{ x: 200, y: 200, id: '1' }, { x: 600, y: 200, id: '2' }]);

    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            if (!entries[0]) return;
            const { width, height } = entries[0].contentRect;
            setDimensions({ width, height });
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    const handleDragMove = (e: any, id: string) => {
        const { x, y } = e.target.position();
        setNodes(nodes.map(n => n.id === id ? { ...n, x, y } : n));
    };

    return (
        <div className="animate-slide-in flex flex-col w-full h-[calc(100vh-100px)] min-h-[700px] bg-panel-bg rounded-xl overflow-hidden border border-panel-border shadow-2xl">
            {/* Header */}
            <header className="flex-none flex flex-wrap items-center justify-between px-6 py-3 border-b border-panel-border bg-panel-bg/95 backdrop-blur-sm z-20">
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl md:text-2xl font-semibold text-text-primary m-0 tracking-tight">Rita Uteservering</h2>
                        {modeToggleNode}
                    </div>
                    <p className="text-text-secondary text-xs m-0">
                        Skissa fritt med det nya avancerade verktyget.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onBack}
                        className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors border border-panel-border text-text-secondary hover:text-text-primary hover:bg-white/5"
                    >
                        Tillbaka
                    </button>
                </div>
            </header>

            {/* Main Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Canvas Area */}
                <div ref={containerRef} className="flex-1 bg-[#0f111a] relative overflow-hidden">
                    {/* CSS Grid Background pattern can go here */}
                    <div 
                        className="absolute inset-0 pointer-events-none opacity-20" 
                        style={{
                            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                            backgroundSize: '40px 40px'
                        }}
                    />
                    
                    <Stage width={dimensions.width} height={dimensions.height}>
                        <Layer>
                            {/* Example Edge connecting the nodes */}
                            <Line
                                points={[nodes[0].x, nodes[0].y, nodes[1].x, nodes[1].y]}
                                stroke="#4a90e2"
                                strokeWidth={4}
                            />
                            {nodes.map(node => (
                                <Circle
                                    key={node.id}
                                    x={node.x}
                                    y={node.y}
                                    radius={8}
                                    fill="#64b5f6"
                                    draggable
                                    onDragMove={(e) => handleDragMove(e, node.id)}
                                    onMouseEnter={(e) => {
                                        const container = e.target.getStage()?.container();
                                        if (container) container.style.cursor = 'grab';
                                    }}
                                    onMouseLeave={(e) => {
                                        const container = e.target.getStage()?.container();
                                        if (container) container.style.cursor = 'default';
                                    }}
                                />
                            ))}
                        </Layer>
                    </Stage>
                </div>

                {/* Sidebar */}
                <AdvancedSketchSidebar />
            </div>
        </div>
    );
}
