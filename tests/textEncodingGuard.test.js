import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = path.resolve(process.cwd());
const SRC_DIR = path.join(ROOT_DIR, 'src');
const README_PATH = path.join(ROOT_DIR, 'README.md');

const SUSPICIOUS_TOKENS = [
    'Ã¤',
    'Ã¶',
    'Ã¥',
    'Ã„',
    'Ã–',
    'Ã…',
    'Â·',
    'â€¢',
    'â†',
    'âœ',
    'ðŸ',
    '�'
];

function collectFiles(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = [];

    entries.forEach((entry) => {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath));
            return;
        }

        if (!/\.(js|jsx)$/.test(entry.name)) {
            return;
        }

        files.push(fullPath);
    });

    return files;
}

function findSuspiciousMatches(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const matches = [];

    lines.forEach((line, index) => {
        SUSPICIOUS_TOKENS.forEach((token) => {
            if (!line.includes(token)) {
                return;
            }

            matches.push({
                token,
                lineNumber: index + 1,
                line: line.trim()
            });
        });
    });

    return matches;
}

describe('text encoding guard', () => {
    it('does not contain known mojibake patterns in app-owned source files', () => {
        const filesToCheck = [...collectFiles(SRC_DIR), README_PATH];
        const failures = [];

        filesToCheck.forEach((filePath) => {
            const matches = findSuspiciousMatches(filePath);
            if (matches.length === 0) {
                return;
            }

            matches.forEach((match) => {
                failures.push(
                    `${path.relative(ROOT_DIR, filePath)}:${match.lineNumber} token "${match.token}" -> ${match.line}`
                );
            });
        });

        expect(
            failures,
            failures.length > 0
                ? `Found suspicious mojibake markers:\n${failures.join('\n')}`
                : 'No suspicious mojibake markers found.'
        ).toEqual([]);
    });
});
