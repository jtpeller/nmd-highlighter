import * as vscode from 'vscode';

const icons: { [key: string]: string } = {
    // Exclamation Point
    "exclaim": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%color" d="M8 1A7 7 0 1 0 8 15A7 7 0 0 0 8 1zm-.5 3h1v5h-1V4zm.5 8.25a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z"/></svg>`,
    // Lightning Bolt
    "lightning": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%color" d="M9.5 1.5L4.5 9h3.5l-1.5 5.5L12.5 7H9l.5-5.5z"/></svg>`,
    // Bug
    // TODO: Bug icon needs improvement.
    "bug": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%color" d="M8 2a2 2 0 0 0-2 2v1H4v1h2v3H4v1h2v2h4v-2h2v-1h-2V7h2V6h-2V4a2 2 0 0 0-2-2z"/></svg>`,
    // Filled Star
    "star": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%color" d="M8 .25a.75.75 0 0 1 .67.42l2.05 4.15 4.58.67a.75.75 0 0 1 .41 1.28l-3.32 3.23.78 4.56a.75.75 0 0 1-1.09.79L8 13.18l-4.1 2.15a.75.75 0 0 1-1.09-.79l.78-4.56-3.32-3.23a.75.75 0 0 1 .41-1.28l4.58-.67L7.33.67A.75.75 0 0 1 8 .25z"/></svg>`,
    // checkmark
    "checkmark": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%color" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>`,
};

const logger = vscode.window.createOutputChannel("NMD Highlighter", { log: true });

interface ExtensionSettings {
    enabled: Object;
    keywords: Object;
    icons: Object;
    bgColors: Object;
    fgColors: Object;
}

class NMDConfig {
    name: string;
    enabled: boolean;
    iconName: string;
    keywords: string[];
    fgColor: string;
    bgColor: string;
    iconColor: string;
    svg?: vscode.Uri;
    decorationType: vscode.TextEditorDecorationType;
    decorationOptions: vscode.DecorationOptions[];

    constructor(name: string = "", keywords: string[] = [], iconName: string, fgColor: string = "#FFFFFF",
        bgColor: string = "#00000000", enabled: boolean = true, iconColor: string = fgColor)
    {
        this.name = name;
        this.enabled = enabled;
        this.keywords = keywords;
        this.iconName = iconName;
        this.fgColor = fgColor;
        this.bgColor = bgColor;
        this.iconColor = iconColor;
        this.svg = this.fetchIcon(iconName);
        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: this.bgColor,
            color: this.fgColor,
            gutterIconPath: this.svg,
            gutterIconSize: 'contain'
        });
        this.decorationOptions = [];
    }

    // Helper to create data URIs for our gutter SVGs
    createSvgUri(svgString: string) {
        return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`);
    }

    // Creates the SVG URI value with the appropriate color.
    fetchIcon(svgName: string) {
        let svg = icons[svgName];
        return this.createSvgUri(svg.replace("%color", this.iconColor));
    }

    // Checks whether provided line contains required keyword.
    checkLine(line: string) {
        for (var keyword of this.keywords) {
            if (line.startsWith(keyword) 
                    || line.startsWith(`- ${keyword}`)) {
                return true;
            }
        }
        return false;   // Line does not contain keyword.
    }
}

class NMDExtensionDirector {
    rules: NMDConfig[] = [];
    #timeout: NodeJS.Timeout | undefined = undefined;
    #context: vscode.ExtensionContext

    constructor(context: vscode.ExtensionContext) {
        // Save the context.
        this.#context = context;

        // Set up text editor listener.
        vscode.window.onDidChangeActiveTextEditor((editor: any) => {
            this.triggerUpdateDecorations(editor);
        }, null, this.#context.subscriptions);

        // Set up text document listener.
        vscode.workspace.onDidChangeTextDocument((event: { document: any; }) => {
            if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
                this.triggerUpdateDecorations(vscode.window.activeTextEditor);
            }
        }, null, this.#context.subscriptions);

        // Initial run
        if (vscode.window.activeTextEditor) {
            this.triggerUpdateDecorations(vscode.window.activeTextEditor);
        }

    }

    loadSettings() {
        // Clean up old decorations so they don't "stack"
        this.rules.forEach(rule => rule.decorationType.dispose());
        this.rules.forEach(rule => rule.decorationOptions = [] as vscode.DecorationOptions[]);

        // Load all of the settings from configuration.
        const config = getTypedConfig<ExtensionSettings>('NMDHighlighter');

        // First, collect all the names.
        let ruleNames: Set<string> = new Set([...Object.keys(config.enabled), ...Object.keys(config.keywords), ...Object.keys(config.icons), ...Object.keys(config.bgColors), ...Object.keys(config.fgColors)]);

        // Convert the pieces of config as a map
        let enabledMap: Map<string, boolean> = new Map(Object.entries(config.enabled));
        let keywordsMap: Map<string, string[]> = new Map(Object.entries(config.keywords));
        let iconMap: Map<string, string> = new Map(Object.entries(config.icons));
        let bgColorMap: Map<string, string> = new Map(Object.entries(config.bgColors));
        let fgColorMap: Map<string, string> = new Map(Object.entries(config.fgColors));

        // Then, utilize these names to build the values.
        for (let k of ruleNames) {
            // Extract dictionary values.
            var enabled = enabledMap.get(k);
            var words = keywordsMap.get(k);
            var icon = iconMap.get(k);
            var bgColor = bgColorMap.get(k);
            var fgColor = fgColorMap.get(k);

            // Ensure they exist.
            if (enabled == undefined) { throw Error(`Enabled Flag for ${k} not found. Add it in your settings!`); }
            if (words == undefined) { throw Error(`Keyword for ${k} not found. Add it in your settings!`); }
            if (icon == undefined) { throw Error(`Icon for ${k} not found. Add it in your settings!`); }
            if (bgColor == undefined) { throw Error(`Background Color for ${k} not found. Add it in your settings!`); }
            if (fgColor == undefined) { throw Error(`Foreground Color for ${k} not found. Add it in your settings!`); }

            // Decide whether the iconColor should represent the foreground / background.
            var iconColor = fgColor;
            if (bgColor != "#00000000" && bgColor != "#000000" && bgColor != "#ffffff00" && bgColor != "#ffffff") {
                iconColor = bgColor;
            }

            // Define and save the rule.
            this.rules.push(new NMDConfig(k, words, icon, fgColor, bgColor, enabled, iconColor));
        }

        // Start the decoration update.
        this.triggerUpdateDecorations(vscode.window.activeTextEditor);
    }

    // Applies the rules if the editor is defined and the file is `.nmd`.
    updateDecorations(editor: vscode.TextEditor | undefined) {
        // If the editor is not defined, return (e.g., if no window is open).
        if (!editor) { return; }

        // Only apply this to .nmd files
        if (!editor.document.fileName.toLowerCase().endsWith('.nmd')) {
            return;
        }

        // Apply the rules.
        this.applyRules(editor);
    }

    /// Begins the decoration update on a timeout.
    triggerUpdateDecorations(editor: vscode.TextEditor | undefined) {
        if (this.#timeout) { clearTimeout(this.#timeout); }
        this.#timeout = setTimeout(() => this.updateDecorations(editor), 100);
    }

    // Responsible for actually applying the rules to the editor.
    applyRules(editor: vscode.TextEditor) {
        // CRITICAL: Clear previous ranges before calculating new ones for this pass
        for (let rule of this.rules) {
            rule.decorationOptions = [];
        }

        // Loop through the editor lines.
        for (let i = 0; i < editor.document.lineCount; i++) {
            const line = editor.document.lineAt(i);
            const text = line.text.trim();

            // Aggregate all the ranges per rule.
            for (let rule of this.rules) {
                // Check whether we should check this rule.
                if (!rule.enabled) {
                    continue;
                }

                if (rule.checkLine(text)) {
                    rule.decorationOptions.push({ range: line.range });
                }
            }
        }

        // Apply the formatting.
        for (let rule of this.rules) {
            editor.setDecorations(rule.decorationType, rule.enabled ? rule.decorationOptions : []);        }
    }
}

// Necessary activate function.
export function activate(context: vscode.ExtensionContext) {
    let handler: NMDExtensionDirector = new NMDExtensionDirector(context);

    // Listen for settings changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('NMDHighlighter.enabled')
            || e.affectsConfiguration('NMDHighlighter.bgColors')
            || e.affectsConfiguration('NMDHighlighter.fgColors') 
            || e.affectsConfiguration('NMDHighlighter.keywords') 
            || e.affectsConfiguration('NMDHighlighter.icons'))
        {
            handler.loadSettings();
        }
    }));

    // Initial load
    handler.loadSettings();
}

/**
 * Safely fetches an extension configuration section.
 * @param section The root key defined in package.json
 */
export function getTypedConfig<T>(section: string): T {
    const config = vscode.workspace.getConfiguration(section);

    // Cast to 'unknown' first to satisfy TypeScript's safety checks
    // before casting to our desired interface 'T'
    return (config as unknown) as T;
}

// Deactivate just stops everything from happening.
export function deactivate() { }