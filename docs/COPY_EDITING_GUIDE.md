# Copy Editing Workflow & Encoding Guardrails

Editing copy in the QuoteGenerator requires awareness of how text files are encoded. Mixed operating systems and older text editors can accidentally mangle Swedish characters (ä, ö, å) when saving code files. 

Follow this guide to avoid introducing **"mojibake"** (corrupted double-encoded strings like `Ã¤` or `ã¤`).

## Conventions
1. **Repository Format**: All `.js`, `.jsx`, `.md`, and `.json` files MUST be saved as **UTF-8 (without BOM)** with `LF` line endings.
2. **Editor Constraints**: A `.editorconfig` file is located at the repository root. Ensure your code editor (VS Code, WebStorm, etc.) has an EditorConfig plugin enabled so that it naturally obeys the encoding. Do NOT manually change file encodings.
3. **No HTML Entities Required**: You do not need to use standard HTML entities (`&auml;`) in JSX, nor Unicode escaping (`\u00e4`) in JS logic. Normalizing the editor encoding solves the root cause across the system natively. You may safely type `Välkommen`.

## Dealing with Uploaded Data (XLSX/CSV)
Never write static workarounds (like `.replaceAll('ã¤', 'ä')`) inside UI views. Use boundary parsing:
- All external Excel or CSV parsing should pass through `src/utils/csvNormalizer.js` to strip ANSI double-encodings immediately before entering application state.

## Verifying Your Changes
Before merging any translation or copy edits, complete this lightweight verification checklist:
- [ ] If on Windows, confirm your editor's bottom toolbar says `UTF-8` and `LF` for the edited file.
- [ ] Run `npm run test` locally and ensure `tests/textEncodingGuard.test.js` passes. (This test actively scans your branch for corrupted byte artifacts).
- [ ] Spin up the local dev server and visibly check the modified text in your browser to confirm there are no `Ã` artifacts displaying on screen.
