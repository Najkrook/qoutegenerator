import { useEffect, useMemo, useRef, useState } from 'react';
import type { QuoteExportLanguage, SketchConfigState } from '../../types/contracts';
import { getVisualizationExportLabels } from '../../services/exportLocalization';
import {
    notifyError,
    notifyLoading,
    notifyWarn,
    updateNotification,
    dismissNotification
} from '../../services/notificationService';
import { downloadBlob } from '../../utils/fileUtils';
import { buildVisualizationPlan } from './buildVisualizationPlan';
import {
    entityKey,
    entityLabel,
    getVisualizationExportPolicy,
    problemKey,
    problemText
} from './visualizationProblems';
import type { VisualizationProblemV1, VisualizationQuality, VisualizationStyle } from './types';
import type { VisualizationScene } from './runtime/scene';
import './visualization.css';

export function VisualizationWorkspace({
    config,
    label,
    language,
    onBack
}: {
    config?: SketchConfigState;
    label: string;
    language?: QuoteExportLanguage;
    onBack: () => void;
}) {
    const host = useRef<HTMLDivElement>(null),
        sceneRef = useRef<VisualizationScene | null>(null);
    const toastRef = useRef<string | null>(null),
        exportLock = useRef(false);
    const [retry, setRetry] = useState(0),
        [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [problems, setProblems] = useState<VisualizationProblemV1[]>([]),
        [focusable, setFocusable] = useState<string[]>([]);
    const [exporting, setExporting] = useState(false),
        [preview, setPreview] = useState<string | null>(null);
    const [style, setStyle] = useState<VisualizationStyle>('environment'),
        [quality, setQuality] = useState<VisualizationQuality>('normal');
    const options = useRef({ style, quality });
    options.current = { style, quality };
    const result = useMemo(() => {
        if (!config) return { plan: null, error: false };
        try {
            return { plan: buildVisualizationPlan(config), error: false };
        } catch {
            return { plan: null, error: true };
        }
    }, [config]);
    const texts = getVisualizationExportLabels(language),
        exportLabel = label || texts.fallbackLabel;
    useEffect(
        () => () => {
            if (preview) URL.revokeObjectURL(preview);
        },
        [preview]
    );
    useEffect(() => {
        const plan = result.plan,
            element = host.current;
        if (!plan || !element) return;
        const controller = new AbortController();
        let current: VisualizationScene | null = null;
        setStatus('loading');
        setProblems(plan.problems);
        setFocusable([]);
        setPreview(null);
        setExporting(false);
        exportLock.current = false;
        void import('./runtime/scene')
            .then(({ createVisualizationScene }) => {
                if (controller.signal.aborted) return null;
                return createVisualizationScene(element, plan, controller.signal, () => {
                    if (!controller.signal.aborted) {
                        setStatus('error');
                        notifyError('3D-visningen avbröts. Försök ladda om scenen.');
                    }
                });
            })
            .then((scene) => {
                if (!scene) return;
                if (controller.signal.aborted) {
                    scene.dispose();
                    return;
                }
                current = scene;
                sceneRef.current = scene;
                scene.style(options.current.style);
                scene.quality(options.current.quality);
                setProblems(scene.problems);
                setFocusable(scene.focusableIds);
                setStatus('ready');
                if (scene.problems.some((p) => p.code === 'VISUAL_MODEL_ASSET_FAILED'))
                    notifyWarn('Modellen kunde inte laddas. En förenklad modell visas.');
                else if (scene.problems.some((p) => p.code === 'TEXTURE_ASSET_FAILED'))
                    notifyWarn('En textur kunde inte laddas. Ett neutralt material används.');
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setStatus('error');
                    notifyError('3D-visualiseringen kunde inte startas.');
                }
            });
        return () => {
            controller.abort();
            current?.dispose();
            sceneRef.current = null;
            if (toastRef.current) {
                dismissNotification(toastRef.current);
                toastRef.current = null;
            }
        };
    }, [result.plan, retry]);
    const policy = getVisualizationExportPolicy(problems, status === 'ready');
    const controlsDisabled = status !== 'ready' || exporting;
    async function capture() {
        const scene = sceneRef.current;
        if (!scene || !policy.allowed || exportLock.current) return;
        exportLock.current = true;
        setExporting(true);
        const toast = notifyLoading('Skapar PNG…');
        toastRef.current = toast;
        try {
            const blob = await scene.capture(exportLabel, texts.disclosure);
            if (sceneRef.current !== scene) return;
            const name = exportLabel.replace(/[^a-zA-Z0-9åäöÅÄÖ_-]/g, '-').slice(0, 80) || '3d-skiss';
            downloadBlob(blob, `${name}-3d.png`);
            setPreview(URL.createObjectURL(blob));
            updateNotification(toast, { type: 'success', message: 'PNG-bilden är klar (2560 × 1440).' });
        } catch {
            if (sceneRef.current === scene)
                updateNotification(toast, { type: 'error', message: 'Kunde inte skapa bild. Försök igen.' });
        } finally {
            if (sceneRef.current === scene) {
                exportLock.current = false;
                setExporting(false);
                toastRef.current = null;
            }
        }
    }
    if (!result.plan)
        return (
            <section className="visualization visualization-empty">
                <h1>Skissen i 3D</h1>
                <p>
                    {result.error
                        ? '3D-visualiseringen kan inte visas från den här skissen.'
                        : 'Det finns ingen enkel skiss att visa ännu.'}
                </p>
                <button onClick={onBack}>Till skissen</button>
            </section>
        );
    const stateLabel =
        status === 'loading'
            ? 'Laddar scenen…'
            : status === 'error'
              ? 'Kan inte visas'
              : policy.blockers.length
                ? 'Kräver åtgärd'
                : problems.length
                  ? 'Behöver översyn'
                  : 'Redo';
    const problemGroups = [
        { title: 'Kräver åtgärd', items: policy.blockers },
        { title: 'Behöver översyn', items: problems.filter((p) => p.effect === 'degraded') }
    ];
    return (
        <section className="visualization" aria-label="3D-visualisering">
            <header className="visualization-header">
                <button onClick={onBack}>← Till skissen</button>
                <div>
                    <h1>Skissen i 3D</h1>
                    <p>Skrivskyddad · aktuellt skissutkast</p>
                </div>
                <button
                    className="visualization-export"
                    disabled={!policy.allowed || exporting}
                    aria-describedby="visualization-export-note"
                    onClick={() => void capture()}
                >
                    {exporting ? 'Skapar PNG…' : 'Ladda ner PNG'}
                </button>
            </header>
            <div className="visualization-body">
                <div className="visualization-canvas">
                    <div ref={host} className="visualization-renderer" />
                    <div className="visualization-camera" role="group" aria-label="Kamerakontroller">
                        <button disabled={controlsDisabled} onClick={() => sceneRef.current?.fit()}>
                            Återställ kamera
                        </button>
                        <button disabled={controlsDisabled} onClick={() => sceneRef.current?.fit(true)}>
                            Ovanifrån
                        </button>
                        <button
                            disabled={controlsDisabled}
                            aria-pressed={style === 'technical'}
                            onClick={() => {
                                const next = style === 'technical' ? 'environment' : 'technical';
                                setStyle(next);
                                sceneRef.current?.style(next);
                            }}
                        >
                            Tekniskt läge
                        </button>
                        <details>
                            <summary>Fler kamerakontroller</summary>
                            <div>
                                <button
                                    disabled={controlsDisabled}
                                    onClick={() => sceneRef.current?.rotate(-1)}
                                >
                                    Rotera vänster
                                </button>
                                <button
                                    disabled={controlsDisabled}
                                    onClick={() => sceneRef.current?.rotate(1)}
                                >
                                    Rotera höger
                                </button>
                                <button
                                    disabled={controlsDisabled}
                                    onClick={() => sceneRef.current?.zoom(0.8)}
                                >
                                    Zooma in
                                </button>
                                <button
                                    disabled={controlsDisabled}
                                    onClick={() => sceneRef.current?.zoom(1.25)}
                                >
                                    Zooma ut
                                </button>
                            </div>
                        </details>
                    </div>
                    {status !== 'ready' ? (
                        <div className="visualization-overlay" role="status">
                            <h2>{stateLabel}</h2>
                            <p>
                                {status === 'error'
                                    ? 'Skissen finns kvar. Återvänd eller försök ladda om scenen.'
                                    : 'Bygger scenen från skissens mått och placeringar.'}
                            </p>
                            {status === 'error' ? (
                                <button onClick={() => setRetry((n) => n + 1)}>Försök igen</button>
                            ) : null}
                        </div>
                    ) : null}
                    <p className="visualization-hint">Dra för att rotera · scrolla eller nyp för att zooma</p>
                </div>
                <aside className="visualization-panel" aria-label="Granska scenen">
                    <h2 aria-live="polite">{stateLabel}</h2>
                    <p>{label || 'Aktuell skiss'}</p>
                    <p>
                        {result.plan.clickitUpRuns.reduce(
                            (n, r) => n + r.members.filter((m) => m.kind === 'section').length,
                            0
                        )}{' '}
                        sektioner ·{' '}
                        {result.plan.clickitUpRuns.reduce(
                            (n, r) => n + r.members.filter((m) => m.kind === 'door').length,
                            0
                        )}{' '}
                        dörrar · {result.plan.placedProducts.length} placerade produkter
                    </p>
                    {problemGroups.map((group) =>
                        group.items.length ? (
                            <section
                                key={group.title}
                                className="visualization-problems"
                                aria-label={group.title}
                            >
                                <h3>{group.title}</h3>
                                {group.items.map((p) => (
                                    <div
                                        key={problemKey(p)}
                                        className={`visualization-problem ${p.severity === 'error' ? 'visualization-problem-error' : ''}`}
                                    >
                                        <strong>
                                            <span aria-hidden="true">
                                                {p.severity === 'error' ? '⛔' : '⚠'}
                                            </span>{' '}
                                            {entityLabel(p.entityRef)}
                                        </strong>
                                        <p>{problemText(p)}</p>
                                        {focusable.includes(entityKey(p.entityRef)) ? (
                                            <button
                                                disabled={controlsDisabled}
                                                onClick={() =>
                                                    sceneRef.current?.focus(entityKey(p.entityRef))
                                                }
                                            >
                                                Fokusera i scenen
                                            </button>
                                        ) : null}
                                    </div>
                                ))}
                            </section>
                        ) : null
                    )}
                    <p id="visualization-export-note">
                        {policy.blockers.length
                            ? 'PNG är blockerad eftersom delar av skissen inte kan återges. Se Kräver åtgärd.'
                            : status === 'error'
                              ? 'PNG kan inte skapas innan scenen fungerar.'
                              : 'PNG: 2560 × 1440, aktuell kameravy och diskret projektrad. Markerade avvikelser följer med.'}
                    </p>
                    <label className="visualization-quality">
                        Visuell kvalitet
                        <select
                            value={quality}
                            disabled={controlsDisabled}
                            onChange={(e) => {
                                const next = e.target.value as VisualizationQuality;
                                setQuality(next);
                                sceneRef.current?.quality(next);
                            }}
                        >
                            <option value="normal">Normal</option>
                            <option value="simple">Enklare</option>
                        </select>
                    </label>
                    <p>Planeringsvy, inte installations- eller konstruktionsunderlag.</p>
                    {preview ? (
                        <details open>
                            <summary>Senast exporterad PNG</summary>
                            <a href={preview} target="_blank" rel="noreferrer">
                                <img src={preview} alt="Senast exporterad 3D-bild" />
                            </a>
                        </details>
                    ) : null}
                </aside>
            </div>
        </section>
    );
}
