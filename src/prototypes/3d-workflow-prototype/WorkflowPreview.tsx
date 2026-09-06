// THROWAWAY: review sidebar and presentation drawer around ticket 06's visual proxies.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import type { SketchConfigState } from '../../types/contracts';
import { buildWorkflowPlan } from './plan';
import { downloadBlob } from '../../utils/fileUtils';
import { notifyError, notifyLoading, notifyWarn, updateNotification } from '../../services/notificationService';
import './workflow.css';

type Scene = { fit: (top?: boolean) => void; style: (mode: string) => void; focus: (id: string) => void;
    capture: (label: string, disclosure: boolean) => Promise<Blob>; dispose: () => void };

export function WorkflowPreview({ config, label, onBack }: {
    config?: SketchConfigState; label: string; onBack: () => void;
}) {
    const host = useRef<HTMLDivElement>(null);
    const sceneRef = useRef<Scene | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [scenario, setScenario] = useState('normal');
    const [retry, setRetry] = useState(0);
    const [exporting, setExporting] = useState(false);
    const [exportPreview, setExportPreview] = useState<string | null>(null);
    useEffect(() => () => { if (exportPreview) URL.revokeObjectURL(exportPreview); }, [exportPreview]);
    const [style, setStyle] = useState('environment');
    const styleRef = useRef(style);
    styleRef.current = style;
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const presentation = searchParams.get('workflow') === 'presentation';
    function setPresentation(value: boolean) {
        const next = new URLSearchParams(searchParams);
        next.set('workflow', value ? 'presentation' : 'review');
        setSearchParams(next, { replace: true, state: location.state });
    }
    const result = useMemo(() => {
        if (!config) return { plan: null, error: '' };
        try { return { plan: buildWorkflowPlan(config), error: '' }; }
        catch { return { plan: null, error: 'Skissen kan inte tolkas. Återvänd till skissen för att kontrollera den.' }; }
    }, [config]);
    const plan = result.plan;
    const problems = useMemo(() => [ ...(plan?.problems || []),
        ...(scenario === 'asset' ? [{ id: 'front', text: 'Simulerat modellfel: förenklad modell används.', effect: 'degraded' as const }] : []),
        ...(scenario === 'omitted' ? [{ id: 'front', text: 'Simulerat bortfall: framkanten kunde inte visas. PNG är blockerad.', effect: 'omitted' as const }] : [])
    ], [plan, scenario]);
    const blocked = problems.some(p => p.effect === 'omitted');
    useEffect(() => {
        if (!plan || !host.current) return;
        let cancelled = false;
        let scene: Scene | null = null;
        const element = host.current;
        setStatus('loading');
        if (scenario === 'loading') return;
        if (scenario === 'fatal') { setStatus('error'); return; }
        void import('./scene.js').then(({ createWorkflowScene }) => {
            if (cancelled) return;
            const displayPlan = scenario === 'omitted'
                ? { ...plan, runs: plan.runs.map(run => run.id === 'front' ? { ...run, members: [], leadingPostMm: 0 } : run) }
                : plan;
            scene = createWorkflowScene(element, { ...displayPlan, problems }, () => {
                if (!cancelled) { setStatus('error'); notifyError('3D-visningen avbröts. Försök ladda om scenen.'); }
            });
            sceneRef.current = scene;
            scene.style(styleRef.current);
            setStatus('ready');
            if (scenario === 'asset') notifyWarn('Modellen kunde inte laddas. En förenklad modell visas.');
        }).catch(() => {
            if (!cancelled) { setStatus('error'); notifyError('3D-visualiseringen kunde inte startas.'); }
        });
        return () => { cancelled = true; scene?.dispose(); sceneRef.current = null; };
    }, [plan, scenario, retry, problems]);
    useEffect(() => { sceneRef.current?.style(style); }, [style]);

    async function exportImage() {
        const scene = sceneRef.current;
        if (!scene || status !== 'ready' || blocked || exporting) return;
        setExporting(true);
        const toast = notifyLoading('Skapar PNG…');
        try {
            const blob = await scene.capture(label, problems.length > 0);
            const name = (label || '3D-skiss').replace(/[^a-zA-Z0-9åäöÅÄÖ_-]/g, '-').slice(0,80);
            downloadBlob(blob, name + '-3d-prototyp.png');
            setExportPreview(URL.createObjectURL(blob));
            updateNotification(toast, { type: 'success', message: 'PNG-bilden är klar (2560 × 1440).' });
        } catch {
            updateNotification(toast, { type: 'error', message: 'Kunde inte skapa bild. Försök igen.' });
        } finally { setExporting(false); }
    }

    if (!plan) return <section className="workflow-preview workflow-empty">
        <h1>3D-prototyp</h1><p>{result.error || 'Det finns ingen enkel skiss att visa ännu.'}</p>
        <button onClick={onBack}>Till skissen</button>
    </section>;
    const stateLabel = status === 'loading' ? 'Laddar scenen…' : status === 'error' ? 'Kan inte visas'
        : blocked ? 'Kräver åtgärd' : problems.length ? 'Behöver översyn' : 'Redo';
    return <section className={'workflow-preview ' + (presentation ? 'workflow-presentation' : '')} aria-label="3D-arbetsflöde – prototyp">
        <header className="workflow-header">
            <button onClick={onBack}>← Till skissen</button>
            <div><h1>Skissen i 3D <small>Prototyp</small></h1><p>Skrivskyddad · aktuellt skissutkast</p></div>
            <button className="workflow-export" disabled={status !== 'ready' || blocked || exporting} onClick={() => void exportImage()}>
                {exporting ? 'Skapar PNG…' : 'Ladda ner PNG'}
            </button>
        </header>
        <div className="workflow-body">
            <div className="workflow-canvas">
                <div ref={host} className="workflow-renderer" />
                <div className="workflow-camera" aria-label="Kamerakontroller">
                    <button disabled={status !== 'ready'} onClick={() => sceneRef.current?.fit()}>Återställ kamera</button>
                    <button disabled={status !== 'ready'} onClick={() => sceneRef.current?.fit(true)}>Ovanifrån</button>
                    <button aria-pressed={style === 'technical'} onClick={() => setStyle(s => s === 'technical' ? 'environment' : 'technical')}>Tekniskt läge</button>
                </div>
                {status !== 'ready' ? <div className="workflow-overlay" role="status">
                    <h2>{stateLabel}</h2><p>{status === 'error' ? '3D-visualiseringen kunde inte startas. Skissen finns kvar.' : 'Bygger scenen från skissens mått och placeringar.'}</p>
                    {status === 'error' && <button onClick={() => { setScenario('normal'); setRetry(n => n+1); }}>Försök igen</button>}
                </div> : null}
                <p className="workflow-hint">Dra för att rotera · scrolla eller nyp för att zooma</p>
            </div>
            <aside className="workflow-panel">
                <h2 aria-live="polite">{stateLabel}</h2><p>{label || 'Aktuell skiss'}</p>
                <p>{plan.runs.reduce((n,r) => n+r.members.length, 0)} sektioner/dörrar · {plan.products.length} placerade produkter</p>
                <details open={!presentation}>
                    <summary>Kontrollera scenen ({problems.length})</summary>
                    <div className="workflow-problems">{problems.map((p,i) => <button key={p.id+'-'+i} onClick={() => sceneRef.current?.focus(p.id)}>
                        <span>{p.effect === 'omitted' ? 'Kräver åtgärd' : 'Behöver översyn'}</span>{p.text}<small>Fokusera i scenen</small>
                    </button>)}</div>
                </details>
                <p className="workflow-export-note">{blocked ? 'PNG är blockerad eftersom delar av skissen inte kan återges.'
                    : 'PNG: 2560 × 1440, aktuell kameravy och diskret projektrad. Markerade avvikelser följer med.'}</p>
                {exportPreview && <details className="workflow-export-preview" open><summary>Senast exporterad PNG</summary>
                    <a href={exportPreview} target="_blank" rel="noreferrer"><img src={exportPreview} alt="Senast exporterad 3D-bild" /></a>
                    <p>Bilden uppdateras först vid nästa export.</p>
                </details>}
                <details className="workflow-review"><summary>Prova prototypens tillstånd</summary>
                    <label>Testfall<select value={scenario} onChange={e => setScenario(e.target.value)} disabled={exporting}>
                        <option value="normal">Aktuell skiss</option><option value="loading">Pågående laddning</option>
                        <option value="asset">Modellfel med fallback</option><option value="omitted">Utelämnad del – blockerad PNG</option>
                        <option value="fatal">3D kan inte starta</option>
                    </select></label>
                    <p>Testfallen är simulerade och ändrar inte skissen. Alla 3D-modeller här är prototypmodeller.</p>
                </details>
            </aside>
        </div>
        <nav className="workflow-switcher" aria-label="Prototypens arbetsflöden">
            <button aria-pressed={!presentation} onClick={() => setPresentation(false)}>A · Granska</button>
            <button aria-pressed={presentation} onClick={() => setPresentation(true)}>B · Presentera</button>
        </nav>
    </section>;
}
