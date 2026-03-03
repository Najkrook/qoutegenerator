import React, { useRef, useCallback, useEffect, useState } from 'react';

/**
 * Interactive SVG canvas for the outdoor seating sketch.
 * Renders glass sections, doors, posts, drag handles, and wall indicators.
 */
export function SketchCanvas({ width, depth, includeBack, leftEdge, rightEdge, frontEdge, backEdge, onResize }) {
    const svgRef = useRef(null);
    const [activeDrag, setActiveDrag] = useState(null);
    const dragRef = useRef({ startX: 0, startY: 0, initialW: 0, initialD: 0 });

    const padding = 1500;
    const viewBox = `${-padding} ${-padding} ${width + padding * 2} ${depth + padding * 2}`;
    const thickness = 100;

    // Drag handling
    const handleMouseDown = useCallback((edgeId, e) => {
        e.preventDefault();
        dragRef.current = { startX: e.clientX, startY: e.clientY, initialW: width, initialD: depth };
        setActiveDrag(edgeId);
    }, [width, depth]);

    useEffect(() => {
        if (!activeDrag) return;

        const handleMove = (e) => {
            const svg = svgRef.current;
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const vb = svg.viewBox.baseVal;
            const ratioX = rect.width ? (vb.width / rect.width) : 10;
            const ratioY = rect.height ? (vb.height / rect.height) : 10;
            const deltaX = (e.clientX - dragRef.current.startX) * ratioX;
            const deltaY = (e.clientY - dragRef.current.startY) * ratioY;

            if (activeDrag === 'front') {
                let newDepth = Math.round((dragRef.current.initialD + deltaY) / 100) * 100;
                if (newDepth >= 1000) onResize({ depth: newDepth });
            } else if (activeDrag === 'right') {
                let newWidth = Math.round((dragRef.current.initialW + deltaX) / 100) * 100;
                if (newWidth >= 1000) onResize({ width: newWidth });
            } else if (activeDrag === 'left') {
                let newWidth = Math.round((dragRef.current.initialW - deltaX) / 100) * 100;
                if (newWidth >= 1000) onResize({ width: newWidth });
            }
        };

        const handleUp = () => setActiveDrag(null);

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
        };
    }, [activeDrag, onResize]);

    // Render edge sections
    const renderEdge = (sections, startX, startY, direction) => {
        const elements = [];
        let cx = startX, cy = startY;

        // Start post
        elements.push(<rect key={`post-start-${startX}-${startY}`} x={cx - thickness} y={cy - thickness} width={thickness * 2} height={thickness * 2} fill="#1e293b" rx="30" />);

        sections.forEach((item, i) => {
            const isDoor = String(item).includes('Dörr');
            const len = isDoor ? parseInt(String(item).replace(/\D/g, '')) || 1000 : parseFloat(item);
            const fill = isDoor ? 'rgba(34, 197, 94, 0.3)' : 'rgba(56, 189, 248, 0.2)';
            const stroke = isDoor ? '#166534' : '#1e293b';
            const label = isDoor ? 'DÖRR' : len;

            let rx, ry, rw, rh, tx, ty;
            if (direction === 'E') {
                rx = cx; ry = cy - thickness / 2; rw = len; rh = thickness;
                tx = cx + len / 2; ty = cy + thickness + 250;
            } else {
                rx = cx - thickness / 2; ry = cy; rw = thickness; rh = len;
                tx = cx - thickness - 250; ty = cy + len / 2;
            }

            const labelWidth = String(label).length * 130 + 80;

            elements.push(
                <g key={`section-${direction}-${i}`} style={{ cursor: 'pointer' }}>
                    <title>{isDoor ? item : `ClickitUP Sektion ${len} mm`}</title>
                    <rect x={rx} y={ry} width={rw} height={rh} fill={fill} stroke={stroke} strokeWidth="20" />
                    <rect x={tx - labelWidth / 2} y={ty - 130} width={labelWidth} height={260} fill="rgba(255,255,255,0.85)" rx="40" />
                    <text x={tx} y={ty} fill="#1a1a2e" fontSize="220" fontFamily="sans-serif" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">{label}</text>
                    {isDoor && (
                        <circle
                            cx={direction === 'E' ? cx + 500 : cx - thickness}
                            cy={direction === 'E' ? cy - thickness : cy + 500}
                            r="80" fill="#ef4444"
                        >
                            <title>Slimline Support</title>
                        </circle>
                    )}
                </g>
            );

            if (direction === 'E') cx += len; else cy += len;

            // End post
            elements.push(<rect key={`post-${direction}-${i}`} x={cx - thickness} y={cy - thickness} width={thickness * 2} height={thickness * 2} fill="#1e293b" rx="30" />);
        });

        return elements;
    };

    // Drag handle component
    const DragHandle = ({ x, y, edgeId, cursor }) => (
        <g
            style={{ cursor, pointerEvents: 'all' }}
            onMouseDown={(e) => handleMouseDown(edgeId, e)}
        >
            <rect x={x - 400} y={y - 400} width={800} height={800} fill="transparent" />
            <circle cx={x} cy={y} r={120} fill={activeDrag === edgeId ? '#2563eb' : '#3b82f6'} stroke="#ffffff" strokeWidth="30" />
        </g>
    );

    return (
        <svg
            ref={svgRef}
            viewBox={viewBox}
            className="w-full h-auto border border-panel-border rounded-lg bg-white/[0.02]"
            style={{ minHeight: '400px', maxHeight: '600px', userSelect: 'none' }}
        >
            {/* Front edge (bottom) */}
            {renderEdge(frontEdge, 0, depth, 'E')}

            {/* Left edge */}
            {renderEdge(leftEdge, 0, 0, 'S')}

            {/* Right edge */}
            {renderEdge(rightEdge, width, 0, 'S')}

            {/* Back edge or wall indicator */}
            {includeBack ? (
                renderEdge(backEdge, 0, 0, 'E')
            ) : (
                <>
                    <line x1={-500} y1={0} x2={width + 500} y2={0} stroke="#cbd5e1" strokeWidth="40" strokeDasharray="200,100" />
                    <text x={width / 2} y={-100} fill="#94a3b8" fontSize="200" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">
                        Befintlig Vägg / Fasad
                    </text>
                </>
            )}

            {/* Drag handles */}
            <DragHandle x={width / 2} y={depth} edgeId="front" cursor="ns-resize" />
            <DragHandle x={0} y={depth / 2} edgeId="left" cursor="ew-resize" />
            <DragHandle x={width} y={depth / 2} edgeId="right" cursor="ew-resize" />
        </svg>
    );
}
