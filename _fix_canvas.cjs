const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/features/SketchCanvas.tsx');
let c = fs.readFileSync(file, 'utf8');
const lines = c.split(/\r\n|\n/);

// Current layout (1-indexed):
// 1130:  </button>           (end of Fiesta button)
// 1131:  </div>              (end of mode buttons group)
// 1132: </div>               (end of left section)
// 1133: (empty)
// 1134: <div ...gap-4>       (middle section with reset + aktiv kant)
// 1135-1142: reset button
// 1143-1145: aktiv kant
// 1146: </div>               (end of middle section)

// Goal: Move reset button after Fiesta (line 1130), keep aktiv kant in its own section
const replacement = [
  '                        </button>',  // end Fiesta
  '                        {onReset && (',
  '                            <button',
  '                                onClick={onReset}',
  '                                className="h-8 px-3.5 rounded-md border text-xs font-semibold tracking-wide border-red-900/50 bg-red-950/20 text-red-300 hover:text-white hover:border-red-500/60 hover:bg-red-800/40 transition-all"',
  '                            >',
  '                                Återställ ritning',
  '                            </button>',
  '                        )}',
  '                    </div>',          // end mode buttons group
  '                </div>',              // end left section
  '',
  '                <div className="flex items-center gap-4">',
  '                    <div className="text-text-secondary">',
  '                        Aktiv kant: <b className="text-text-primary">{selectedEdge || \'Ingen\'}</b>',
  '                    </div>',
  '                </div>',
];

// Replace lines 1130-1146 (indices 1129-1145)
const newLines = [
  ...lines.slice(0, 1129),
  ...replacement,
  ...lines.slice(1146),
];

fs.writeFileSync(file, newLines.join('\r\n'), 'utf8');
console.log('Moved reset button into mode buttons group. Lines: ' + newLines.length);
