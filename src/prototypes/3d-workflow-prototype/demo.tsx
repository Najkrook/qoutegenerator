// Standalone review fixture: in-memory sample only, no authentication or backend data.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';
import { WorkflowPreview } from './WorkflowPreview';
import { PARASOL_PRESETS } from '../../utils/parasolGeometry';
import type { SketchConfigState } from '../../types/contracts';

const preset = PARASOL_PRESETS.find(p => /kvadrat/i.test(p.shapeCategory)) || PARASOL_PRESETS[0];
const sample: SketchConfigState = {
    width:8000, depth:6000, depthLeft:6000, depthRight:6000, equalDepth:true,
    includeBack:false, prioMode:'symmetrical', targetLength:1500,
    doorSegmentsByEdge:{front:[{index:1,size:1000}]}, manualSectionsByEdge:{}, sectionCountByEdge:{},
    activeMode:'clickitup', selectedParasolId:null, selectedParasolPresetId:preset.id, selectedFiestaId:null,
    parasols:[{...preset, presetId:preset.id, id:'demo-parasol', xMm:2500, yMm:3000, rotationDeg:0}],
    fiestaItems:[{id:'demo-fiesta',diameterMm:700,xMm:6500,yMm:3000,zLayer:'below',exportLine:'Fiesta',exportModel:'Fiesta',exportSize:'Standard'}]
};
function Demo() {
    const [open,setOpen] = useState(true);
    const [config,setConfig] = useState(sample);
    return <><Toaster />{open ? <WorkflowPreview config={config} label="Demoprojekt" onBack={() => setOpen(false)} />
        : <section className="workflow-preview workflow-empty"><h1>Testskiss · prototyp</h1>
            <p>Prova flödet: ändra bredd, öppna 3D, exportera en bild och återvänd. Testskissen finns bara i minnet.</p>
            <label>Bredd i mm <input type="number" min="1000" max="50000" step="100" value={config.width}
                onChange={e => setConfig({...config,width:Number(e.target.value)})} /></label>
            <button onClick={() => setOpen(true)}>Visa 3D-prototyp</button>
        </section>}</>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><Demo /></BrowserRouter>);
