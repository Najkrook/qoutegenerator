import { IconArrowLeft, IconInfoCircle } from '@tabler/icons-react';

const PROTOTYPE_SCENE_URL = '/src/prototypes/composite-3d-scene-prototype/index.html?variant=environment';

interface Sketch3dPrototypeProps {
    onBack: () => void;
}

export function Sketch3dPrototype({ onBack }: Sketch3dPrototypeProps) {
    return (
        <div
            data-surface="sketch-3d-prototype"
            className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border border-panel-border bg-panel-bg"
        >
            <header className="flex min-h-14 flex-none items-center justify-between gap-3 border-b border-panel-border bg-panel-bg px-3 py-2 sm:px-4">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex min-h-10 items-center gap-2 rounded-control border border-control-border bg-surface-raised px-3 text-sm font-semibold text-text transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                    <IconArrowLeft aria-hidden="true" size={18} stroke={1.8} />
                    Till skissen
                </button>

                <div className="flex min-w-0 items-center gap-2 text-right text-xs text-text-muted sm:text-sm">
                    <IconInfoCircle aria-hidden="true" className="shrink-0" size={17} stroke={1.8} />
                    <span className="truncate">Prototyp med representativ testdata</span>
                </div>
            </header>

            <iframe
                className="min-h-0 w-full flex-1 border-0 bg-[#071018]"
                src={PROTOTYPE_SCENE_URL}
                title="Sammansatt 3D-scen – prototyp"
            />
        </div>
    );
}
