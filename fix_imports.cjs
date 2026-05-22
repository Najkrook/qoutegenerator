const fs = require('fs');
const file = 'src/components/features/SimpleSketch/SimpleSketchEditor.tsx';
let content = fs.readFileSync(file, 'utf8');

// The file was in src/views, so '../' meant 'src/'
// Now it's in src/components/features/SimpleSketch/, so 'src/' is '../../../'
content = content.replace(/from '\.\.\//g, "from '../../../");

// It had imports from '../components/features/...' which became '../../../components/features/...'
// We can simplify that to '../...' since we are in src/components/features/SimpleSketch
content = content.replace(/from '\.\.\/\.\.\/\.\.\/components\/features\//g, "from '../");

// It had imports from '../features/...' which became '../../../features/...'
// Which is correct, no change needed for that.

// Rename the component
content = content.replace(/export function SketchTool/g, 'export function SimpleSketchEditor');

fs.writeFileSync(file, content);
console.log('Fixed imports in SimpleSketchEditor.tsx');
