import * as fs from 'fs';

let code = fs.readFileSync('./src/utils/sectionCalculator.js', 'utf-8');
code = code.replace(/export /g, '');

const injectStr = `
    if (remaining === 5900 && startIdx === 0) {
        console.log("TOP LEVEL evaluating candidate:", candidate, "vs best:", best);
        const candM = buildMetrics(candidate, mode, normalizedTarget);
        const bestM = best ? buildMetrics(best, mode, normalizedTarget) : null;
        console.log("  CAND metrics:", candM);
        console.log("  BEST metrics:", bestM);
        if (isBetterCandidate(candidate, best, mode, normalizedTarget)) {
            console.log("  -> CANDIDATE WINS!");
        } else {
            console.log("  -> BEST WINS!");
        }
    }
`;

code = code.replace('if (isBetterCandidate(candidate, best, mode, normalizedTarget)) {', injectStr + 'if (isBetterCandidate(candidate, best, mode, normalizedTarget)) {');

code += `\nconsole.log("Result:", solveExactFill(5900, "symmetrical", 1500));\n`;

fs.writeFileSync('./tester.js', code);
