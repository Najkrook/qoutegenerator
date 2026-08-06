import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const simpleEditorSource = readFileSync(
    new URL('../src/components/features/SimpleSketch/SimpleSketchEditor.tsx', import.meta.url),
    'utf8'
);
const simpleCanvasSource = readFileSync(
    new URL('../src/components/features/SketchCanvas.tsx', import.meta.url),
    'utf8'
);
const advancedEditorSource = readFileSync(
    new URL('../src/components/features/AdvancedSketch/AdvancedSketchEditor.tsx', import.meta.url),
    'utf8'
);

describe('sketch viewport layout contract', () => {
    it('fills the simple sketch viewport without a percentage-height chain', () => {
        expect(simpleEditorSource).toContain('data-surface="simple-sketch-workspace"');
        expect(simpleEditorSource).toContain('className="relative flex min-h-0 flex-1 basis-0 flex-col overflow-hidden bg-panel-bg md:flex-row"');
        expect(simpleEditorSource).toContain('data-surface="simple-sketch-viewport"');
        expect(simpleEditorSource).toContain('className="relative min-h-0 w-full flex-1 basis-0"');
        expect(simpleCanvasSource).toContain('data-surface="simple-sketch-canvas"');
        expect(simpleCanvasSource).toContain('className="absolute inset-0 overflow-hidden');
        expect(simpleEditorSource).not.toContain('animate-slide-in flex h-full');
    });

    it('keeps the advanced resize-observer target measurable inside flex layout', () => {
        expect(advancedEditorSource).toContain('data-surface="advanced-sketch-workspace"');
        expect(advancedEditorSource).toContain('className="relative flex min-h-0 flex-1 basis-0 flex-col overflow-hidden md:flex-row"');
        expect(advancedEditorSource).toContain('data-surface="advanced-sketch-canvas"');
        expect(advancedEditorSource).toContain('className="relative min-h-0 min-w-0 flex-1 overflow-hidden"');
        expect(advancedEditorSource).not.toContain('animate-slide-in flex h-full');
    });
});
