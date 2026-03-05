import { resolveEdgeWithPins, calculateSectionsForEdge } from './src/utils/sectionCalculator.js';

const totalLength = 8000;
const needsDoor = false;
const options = { prioMode: 'symmetrical', targetLength: 1500 };

const existingSections = calculateSectionsForEdge(totalLength, needsDoor, options);
console.log('Original sections:', existingSections);

const pins = [{ index: 4, size: 1200 }]; // Corresponds to Sektion 4 (0-indexed 3 or 4) -> Section 5 in UI is index 4.
const overridden = resolveEdgeWithPins(totalLength, existingSections, pins, options);
console.log('Overridden sections:', overridden);
