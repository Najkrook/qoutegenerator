import { calculateSectionsForEdge } from './src/utils/sectionCalculator.js';

const result = calculateSectionsForEdge(5900, false, { prioMode: 'symmetrical', targetLength: 1500 });
console.log("Calculated:", result);
