import * as fs from 'fs';

let code = fs.readFileSync('./src/utils/sectionCalculator.js', 'utf-8');
code = code.replace(/export /g, '');

const newIsBetter = `
function isBetterCandidate(candidate, incumbent, mode, target) {
    if (!incumbent) return true;

    const cand = buildMetrics(candidate, mode, target);
    const best = buildMetrics(incumbent, mode, target);

    if (mode === 'convenient') {
        if (cand.count !== best.count) return cand.count < best.count;
        return isLexicographicallyBetter(candidate, incumbent);
    }

    if (mode === 'symmetrical') {
        if (cand.targetPenalty !== best.targetPenalty) return cand.targetPenalty < best.targetPenalty;
        if (cand.spread !== best.spread) return cand.spread < best.spread;
        if (cand.count !== best.count) return cand.count < best.count;
        return isLexicographicallyBetter(candidate, incumbent);
    }

    if (cand.targetPenalty !== best.targetPenalty) return cand.targetPenalty < best.targetPenalty;
    if (cand.count !== best.count) return cand.count < best.count;
    if (cand.spread !== best.spread) return cand.spread < best.spread;
    return isLexicographicallyBetter(candidate, incumbent);
}
`;

code = code.replace(/function isBetterCandidate[\s\S]*?^}/m, newIsBetter);

code += `\nconsole.log("Result:", solveExactFill(5900, "symmetrical", 1500));\n`;

fs.writeFileSync('./tester2.js', code);
