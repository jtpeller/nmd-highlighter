import * as vscode from 'vscode';

// Helper to create data URIs for our gutter SVGs
function createSvgUri(svgString: string) {
    return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`);
}

// Define the SVG icons.
const icons = {
    // Red Exclamation
    issue: createSvgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#FF5252" d="M8 1A7 7 0 1 0 8 15A7 7 0 0 0 8 1zm-.5 3h1v5h-1V4zm.5 8.25a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z"/></svg>`),
    // Amber Lightning Bolt
    task: createSvgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#FFB300" d="M9.5 1.5L4.5 9h3.5l-1.5 5.5L12.5 7H9l.5-5.5z"/></svg>`),
    // Orange Bug
    bug: createSvgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#FF9800" d="M8 2a2 2 0 0 0-2 2v1H4v1h2v3H4v1h2v2h4v-2h2v-1h-2V7h2V6h-2V4a2 2 0 0 0-2-2z"/></svg>`),
    // Green Filled Star
    star: createSvgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#4CAF50" d="M8 .25a.75.75 0 0 1 .67.42l2.05 4.15 4.58.67a.75.75 0 0 1 .41 1.28l-3.32 3.23.78 4.56a.75.75 0 0 1-1.09.79L8 13.18l-4.1 2.15a.75.75 0 0 1-1.09-.79l.78-4.56-3.32-3.23a.75.75 0 0 1 .41-1.28l4.58-.67L7.33.67A.75.75 0 0 1 8 .25z"/></svg>`),
    // Blue Checkmark
    fix: createSvgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#448AFF" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>`),
    // Green Checkmark
    done: createSvgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="#4CAF50" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>`)
};

// Initialize Decoration Types
let issueDecorationType: vscode.TextEditorDecorationType;
let taskDecorationType: vscode.TextEditorDecorationType;
let bugDecorationType: vscode.TextEditorDecorationType;
let fixDecorationType: vscode.TextEditorDecorationType;
let doneDecorationType: vscode.TextEditorDecorationType;
let verifiedDecorationType: vscode.TextEditorDecorationType;

export function activate(context: vscode.ExtensionContext) {
    // Configure how each should look.
    issueDecorationType = vscode.window.createTextEditorDecorationType({
        color: '#FF5252',
        gutterIconPath: icons.issue,
        gutterIconSize: 'contain'
    });
    taskDecorationType = vscode.window.createTextEditorDecorationType({
        color: '#FFB300',
        gutterIconPath: icons.task,
        gutterIconSize: 'contain'
    });
    bugDecorationType = vscode.window.createTextEditorDecorationType({
        color: '#ff7b00',
        gutterIconPath: icons.bug,
        gutterIconSize: 'contain'
    })
    fixDecorationType = vscode.window.createTextEditorDecorationType({
        color: '#448AFF',
        gutterIconPath: icons.fix,
        gutterIconSize: 'contain'
    });
    doneDecorationType = vscode.window.createTextEditorDecorationType({
        color: '#4CAF50',
        gutterIconPath: icons.done,
        gutterIconSize: 'contain'
    });
    verifiedDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: '#006803',
        color: 'white',
        gutterIconPath: icons.star,
        gutterIconSize: 'contain'
    });


    // Trigger decoration updates when editor changes or text changes
    let timeout: NodeJS.Timeout | undefined = undefined;
    function triggerUpdateDecorations(editor: vscode.TextEditor | undefined) {
        if (timeout) { clearTimeout(timeout); }
        timeout = setTimeout(() => updateDecorations(editor), 100);
    }

    vscode.window.onDidChangeActiveTextEditor((editor: any) => {
        triggerUpdateDecorations(editor);
    }, null, context.subscriptions);

    vscode.workspace.onDidChangeTextDocument((event: { document: any; }) => {
        if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
            triggerUpdateDecorations(vscode.window.activeTextEditor);
        }
    }, null, context.subscriptions);

    // Initial run
    if (vscode.window.activeTextEditor) {
        triggerUpdateDecorations(vscode.window.activeTextEditor);
    }
}

function updateDecorations(editor: vscode.TextEditor | undefined) {
    if (!editor) { return; }

    // ONLY apply this to .nmd files
    if (!editor.document.fileName.toLowerCase().endsWith('.nmd')) {
        return;
    }

    const issueRanges: vscode.DecorationOptions[] = [];
    const taskRanges: vscode.DecorationOptions[] = [];
    const fixRanges: vscode.DecorationOptions[] = [];
    const doneRanges: vscode.DecorationOptions[] = [];
    const bugRanges: vscode.DecorationOptions[] = [];
    const verifiedRanges: vscode.DecorationOptions[] = [];

    // Read the file line-by-line to check for keywords
    for (let i = 0; i < editor.document.lineCount; i++) {
        const line = editor.document.lineAt(i);
        const text = line.text.trim();

        if (text.startsWith('ISSUE') || text.startsWith('- ISSUE')) {
            issueRanges.push({ range: line.range });
        } else if (text.startsWith('TASK') || text.startsWith('- TASK')) {
            taskRanges.push({ range: line.range });
        } else if (text.startsWith('FIX') || text.startsWith('- FIX')) {
            fixRanges.push({ range: line.range });
        } else if (text.startsWith('DONE') || text.startsWith('- DONE')) {
            doneRanges.push({ range: line.range });
        } else if (text.startsWith('BUG') || text.startsWith('- BUG')) {
            bugRanges.push({ range: line.range });
        } else if (text.startsWith('VERIFIED') || text.startsWith('- VERIFIED')) {
            verifiedRanges.push({ range: line.range });
        }
    }

    // Apply the formatting.
    editor.setDecorations(issueDecorationType, issueRanges);
    editor.setDecorations(bugDecorationType, bugRanges);
    editor.setDecorations(taskDecorationType, taskRanges);
    editor.setDecorations(fixDecorationType, fixRanges);
    editor.setDecorations(doneDecorationType, doneRanges);
    editor.setDecorations(verifiedDecorationType, verifiedRanges);
}

export function deactivate() { }