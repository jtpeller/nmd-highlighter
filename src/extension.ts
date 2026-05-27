import * as vscode from 'vscode';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';

const icons: { [key: string]: string } = {};

const logger = vscode.window.createOutputChannel("NMD Highlighter", { log: true });

export let handler: NMDExtensionDirector;

class NMDConfig {
    name: string;
    enabled: boolean;
    iconName: string;
    keywords: string[];
    fgColor: string;
    bgColor: string;
    iconColor: string;
    svg?: string;
    svgUri?: vscode.Uri;
    decorationType: vscode.TextEditorDecorationType;
    decorationOptions: vscode.DecorationOptions[];

    constructor(name: string = "", keywords: string[] = [], iconName: string, fgColor: string = "#FFFFFF",
        bgColor: string = "#00000000", enabled: boolean = true, iconColor: string = fgColor) {
        this.name = name;
        this.enabled = enabled;
        this.keywords = keywords;
        this.iconName = iconName;
        this.fgColor = fgColor;
        this.bgColor = bgColor;
        this.iconColor = iconColor;
        const rawSvg = icons[iconName] || '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"></svg>';
        this.svg = this.createSvgString(rawSvg.replace(/currentColor/g, this.iconColor));
        this.svgUri = this.fetchIconUri(iconName);
        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: this.bgColor,
            color: this.fgColor,
            gutterIconPath: this.svgUri,
            gutterIconSize: 'contain'
        });
        this.decorationOptions = [];
    }

    // Helper to create data URIs for our gutter SVGs
    createSvgUri(svgString: string) {
        return vscode.Uri.parse(this.createSvgString(svgString));
    }

    // Helper to create the raw SVG string.
    createSvgString(svgData: string) {
        return `data:image/svg+xml;utf8,${encodeURIComponent(svgData)}`;
    }

    // Creates the SVG URI value with the appropriate color.
    fetchIconUri(svgName: string) {
        let svg = icons[svgName] || '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"></svg>';
        return this.createSvgUri(svg.replace(/currentColor/g, this.iconColor));
    }

    // Checks whether provided line contains required keyword.
    checkLine(line: string) {
        for (var keyword of this.keywords) {
            if (line.includes(keyword)) {
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
    #lastCss = "";


    constructor(context: vscode.ExtensionContext) {
        // Save the context.
        this.#context = context;

        this.#context.subscriptions.push(
            // Set up text editor listener.
            vscode.window.onDidChangeActiveTextEditor((editor: any) => {
                this.triggerUpdateDecorations(editor);
            }),
            // Set up text document listener.
            vscode.workspace.onDidChangeTextDocument((event: { document: any; }) => {
                if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
                    this.triggerUpdateDecorations(vscode.window.activeTextEditor);
                }
            })
        )

        // Initial run
        if (vscode.window.activeTextEditor) {
            this.triggerUpdateDecorations(vscode.window.activeTextEditor);
        }
    }

    // New dispose method to be called on deactivation
    public dispose() {
        if (this.#timeout) {
            clearTimeout(this.#timeout);
        }
        this.rules.forEach(rule => rule.decorationType.dispose());
        this.rules = [];
    }

    async loadIcons() {
        const iconFolder = path.join(this.#context.extensionPath, 'assets', 'icons');

        // Access the manifest (package.json) to get the master list of all available icons
        const packageJSON = this.#context.extension.packageJSON;
        
        // Handle cases where configuration might be an array or a single object
        const configContainer = Array.isArray(packageJSON?.contributes?.configuration) 
            ? packageJSON.contributes.configuration[0] 
            : packageJSON?.contributes?.configuration;

        const iconEnum = configContainer?.properties?.["NMDHighlighter.icons"]?.additionalProperties?.enum;

        if (!iconEnum || !Array.isArray(iconEnum)) {
            logger.error("Initialization Error: Unable to find the 'NMDHighlighter.icons' enum list in package.json.");
            return;
        }

        const iconNames = iconEnum as string[];

        for (const name of iconNames) {
            const iconPath = path.join(iconFolder, `${name}.svg`);
            try {
                const data = await fsPromises.readFile(iconPath, 'utf8');
                icons[name] = data;
            } catch (err) {
                // This performs the runtime verification requested
                logger.error(`Asset Validation Failed: Icon "${name}" is listed in package.json but is missing from assets at: ${iconPath}`);
                icons[name] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"></svg>';
            }
        }
    }

    async loadSettings() {
        // Clean up old decorations
        this.rules.forEach(rule => rule.decorationType.dispose());
        this.rules = []; 

        // Ensure icons are loaded from the bundle
        if (Object.keys(icons).length === 0) {
            await this.loadIcons();
        }

        // Extract settings as plain objects (WorkspaceConfiguration doesn't work with Object.keys directly)
        const config = vscode.workspace.getConfiguration('NMDHighlighter');
        const enabledObj = config.get<Record<string, boolean>>('enabled') || {};
        const keywordsObj = config.get<Record<string, string[]>>('keywords') || {};
        const iconsObj = config.get<Record<string, string>>('icons') || {};
        const bgColorsObj = config.get<Record<string, string>>('bgColors') || {};
        const fgColorsObj = config.get<Record<string, string>>('fgColors') || {};

        // Collect all unique rule keys
        const ruleNames = new Set([
            ...Object.keys(enabledObj),
            ...Object.keys(keywordsObj),
            ...Object.keys(iconsObj),
            ...Object.keys(bgColorsObj),
            ...Object.keys(fgColorsObj)
        ]);

        // Rebuild the rule set
        for (let k of ruleNames) {
            const enabled = enabledObj[k] ?? true;
            const words = keywordsObj[k] ?? [];
            const icon = iconsObj[k] ?? "exclaim";
            const bgColor = bgColorsObj[k] ?? "#00000000";
            const fgColor = fgColorsObj[k] ?? "#FFFFFF";

            let iconColor = fgColor;
            if (bgColor !== "#00000000" && bgColor !== "transparent") {
                iconColor = bgColor;
            }

            this.rules.push(new NMDConfig(k, words, icon, fgColor, bgColor, enabled, iconColor));
        }

        // Write the CSS to the physical file VS Code is watching
        const cssContent = this.generateCSS();
        const stylePath = path.join(this.#context.extensionPath, './styles/nmd-styles.css');

        // Only write to the CSS file if something has changed.
        if (cssContent !== this.#lastCss) {
            try {
                await fsPromises.writeFile(stylePath, cssContent);
                logger.debug("NMD Extension successfully updated dynamic CSS!");
            } catch (err) {
                logger.error("Failed to write dynamic CSS file: " + err);
            }
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
            editor.setDecorations(rule.decorationType, rule.enabled ? rule.decorationOptions : []);
        }
    }

    generateCSS(): string {
        // Starting point.
        let css =
            `
/* Standalone NMD elements block wrapper (non-list-items) */
.nmd-block-wrapper {
    display: block;
    margin: 0; /* Remove extra margin to match normal line spacing */
    padding: 0;
}

/* Hide the default bullet for list items */
li:has(.nmd-line-inline) {
    list-style: none !important;
    margin-left: -1.6em;
}

/* The actual NMD Line class, which holds a single NMD Line. */
.nmd-line-inline {
    display: inline;
    line-height: inherit;
}

/* The icon - Uses vertical-align to stay level with text without flexbox */
.nmd-icon-inline {
    display: inline-block;
    width: 1em;
    height: 1em;
    margin-right: 6px;
    vertical-align: -0.15em; /* Adjusts icon to sit on the text baseline */
    flex-shrink: 0;
}

/* The SVG itself should just fill the area */
.nmd-icon-inline svg {
    width: 100%;
    height: 100%;
    display: block;
}

/* Ensure bold/italics/code inside NMD lines inherit the custom color */
.nmd-line-inline * {
    color: inherit !important;
}

/* Code blocks need to keep their own background */
.nmd-line-inline code {
    background-color: var(--vscode-editor-inactiveSelectionBackground);
    padding: 0 3px;
    border-radius: 3px;
}
`;

        this.rules.forEach(key => {
            const bg = key.bgColor || "#00000000";
            const fg = key.fgColor || "#ffffff";
            const isTransparent = bg === "#00000000" || bg === "transparent";
            css +=
                `
.nmd-preview-${key.name.toLowerCase()} {
    color: ${fg} !important;
    background-color: ${isTransparent ? 'var(--vscode-editor-selectionHighlightBackground)' : bg} !important;
    border-left: 4px solid ${fg};
}
`;
        });

        return css;
    }

    showIconGallery() {
        const panel = vscode.window.createWebviewPanel(
            'nmdIconGallery',
            'NMD Icon Gallery',
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );

        panel.webview.html = this.getIconGalleryHtml();

        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.command === 'reload') {
                await this.loadSettings();
                panel.webview.html = this.getIconGalleryHtml();
            }
        }, undefined, this.#context.subscriptions);
    }

    private getIconGalleryHtml(): string {
        const activeRulesHtml = this.rules.map(rule => {
            const rawSvg = icons[rule.iconName] || '';
            if (!rawSvg) {
                return '';
            }
            const coloredSvg = rawSvg.replace(/currentColor/g, rule.iconColor);
            return `
                <div class="card">
                    <div class="preview">
                        <div class="icon-wrapper">${coloredSvg}</div>
                    </div>
                    <div class="info">
                        <div class="rule-key">${rule.name}</div>
                        <div class="rule-details"><b>Enabled</b>: ${rule.enabled}</div>
                        <div class="rule-details"><b>Keywords</b>: ${rule.keywords.join(', ')}</div>
                        <div class="rule-details"><b>Icon</b>: ${rule.iconName}</div>
                        <div class="rule-details"><b>Icon Color</b>: ${rule.iconColor}</div>
                        <div class="rule-details"><b>Background</b>: ${rule.bgColor}</div>
                        <div class="rule-details"><b>Foreground</b>: ${rule.fgColor}</div>
                    </div>
                </div>`;
        }).join('');

        const allIconsHtml = Object.keys(icons).sort().map(name => {
            if (!icons[name]) {
                return '';
            }
            const rawSvg = icons[name].replace(/currentColor/g, 'var(--vscode-descriptionForeground)');
            return `
                <div class="lib-card">
                    <div class="lib-icon">${rawSvg}</div>
                    <div class="lib-name">${name}</div>
                </div>`;
        }).join('');

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <style>
                    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 20px; }
                    .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--vscode-settings-headerForeground); padding-bottom: 5px; margin-bottom: 15px; }
                    h2 { border-bottom: none; margin: 0; }
                    h2.lib-header { border-bottom: 1px solid var(--vscode-settings-headerForeground); padding-bottom: 5px; margin-top: 40px; margin-bottom: 15px; }
                    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; margin-bottom: 40px; }
                    .card { border: 1px solid var(--vscode-widget-border); border-radius: 4px; overflow: hidden; background: var(--vscode-editor-background); }
                    .preview { height: 60px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid var(--vscode-widget-border); }
                    .icon-wrapper { width: 32px; height: 32px; }
                    .icon-wrapper svg { width: 100%; height: 100%; display: block; }
                    .info { padding: 8px; }
                    .rule-key { font-weight: bold; font-size: 1.1em; margin-bottom: 4px; color: var(--vscode-symbolIcon-keywordForeground); }
                    .rule-details { font-size: 0.85em; color: var(--vscode-descriptionForeground); }
                    
                    .lib-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; }
                    .lib-card { display: flex; flex-direction: column; align-items: center; padding: 10px; border: 1px transparent solid; }
                    .lib-card:hover { background: var(--vscode-list-hoverBackground); border-radius: 4px; }
                    .lib-icon { width: 24px; height: 24px; margin-bottom: 8px; }
                    .lib-icon svg { width: 100%; height: 100%; display: block; }
                    .lib-name { font-size: 0.8em; text-align: center; }
                    
                    .reload-button { 
                        background-color: var(--vscode-button-background); 
                        color: var(--vscode-button-foreground); 
                        border: none; 
                        padding: 6px 14px; 
                        cursor: pointer; 
                        border-radius: 2px;
                        font-size: 13px;
                    }
                    .reload-button:hover { background-color: var(--vscode-button-hoverBackground); }
                </style>
            </head>
            <body>
                <div class="header-container">
                    <h2>Active Configuration</h2>
                    <button class="reload-button" onclick="reload()">Reload Settings</button>
                </div>
                <div class="grid">${activeRulesHtml}</div>
                <h2 class="lib-header">Available Icon Library</h2>
                <div class="lib-grid">${allIconsHtml}</div>

                <script>
                    const vscode = acquireVsCodeApi();
                    function reload() {
                        vscode.postMessage({ command: 'reload' });
                    }
                </script>
            </body>
            </html>`;
    }
}

// Necessary activate function.
export function activate(context: vscode.ExtensionContext) {
    logger.debug("NMD Highlighter: Activating...!");
    handler = new NMDExtensionDirector(context);

    // Listen for settings changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async e => {
        if (e.affectsConfiguration('NMDHighlighter.enabled')
            || e.affectsConfiguration('NMDHighlighter.bgColors')
            || e.affectsConfiguration('NMDHighlighter.fgColors')
            || e.affectsConfiguration('NMDHighlighter.keywords')
            || e.affectsConfiguration('NMDHighlighter.icons')) {
            handler.loadSettings();
        }
    }));

    // Initial load
    handler.loadSettings().catch(err => logger.error(err));

    // Register the Timestamp Command
    let timestampCommand = vscode.commands.registerCommand('nmdHighlighter.insertTimestamp', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        // Pull custom categories from settings
        const config = vscode.workspace.getConfiguration('NMDHighlighter');
        const keywordsMap: { [key: string]: string[] } = config.get('keywords') || {};
        const categories = Object.keys(keywordsMap);

        // Show the Quick Pick menu to the user
        const selection = await vscode.window.showQuickPick(categories, {
            placeHolder: 'Select a log category',
            canPickMany: false
        });

        // Prepare the text (Timestamp + Keyword)
        const now = new Date();
        const timeStr = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}]`;

        // If user escapes the menu, just insert the timestamp. 
        // If they pick one, insert "Timestamp KEYWORD "
        const textToInsert = selection ? `${timeStr} ${selection}: ` : `${timeStr} `;

        editor.edit(editBuilder => {
            editBuilder.insert(editor.selection.active, textToInsert.toUpperCase());
        });
    });

    let monthlyTemplateCommand = vscode.commands.registerCommand('nmdHighlighter.generateMonthlyTemplate', async () => {
        // Determine current month & year
        const now = new Date();
        const nextMonth = String(now.getMonth() + 2).padStart(2, '0');
        const currentYear = String(now.getFullYear() + (now.getMonth() == 11 ? 1 : 0));

        // 1. Ask for MM/YYYY
        const dateInput = await vscode.window.showInputBox({
            prompt: "Enter Month and Year (MM/YYYY)",
            placeHolder: `${nextMonth}/${currentYear}`,
            validateInput: (value) => {
                return /^(0[1-9]|1[0-2])\/\d{4}$/.test(value) ? null : "Please use MM/YYYY format";
            }
        });
        if (!dateInput) return;

        // 2. Ask about weekends
        const includeWeekends = await vscode.window.showQuickPick(["No", "Yes"], {
            placeHolder: "Include weekends?"
        });
        const skipWeekends = includeWeekends === "No";

        // 3. Sort Order (Reverse Chronological toggle)
        const sortOrder = await vscode.window.showQuickPick(["Newest First (31 to 1)", "Oldest First (1 to 31)"], {
            placeHolder: "Select date order"
        });
        const isReverse = sortOrder === "Newest First (31 to 1)";

        // 4. First day of the week
        const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const firstDayName = await vscode.window.showQuickPick(daysOfWeek, {
            placeHolder: "Which day starts the week? (Default: Monday)"
        }) || "Monday";

        // Map day name to JS Date index (0=Sun, 1=Mon... 6=Sat)
        const firstDayIndex = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(firstDayName);

        // 5. Setup Date Logic
        const [month, year] = dateInput.split('/').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const monthName = startDate.toLocaleString('default', { month: 'long' });
        const lastDay = new Date(year, month, 0).getDate();

        // 6. Generate the Array of Days
        let daysArray: number[] = [];
        for (let i = 1; i <= lastDay; i++) {
            daysArray.push(i);
        }
        if (isReverse) {
            daysArray.reverse();
        }

        // 7. Build Content
        let content = `# ${monthName} ${year}\n\n## Notes\n\n`;

        daysArray.forEach((d) => {
            const current = new Date(year, month - 1, d);
            const dayOfWeek = current.getDay();

            // Skip weekends logic
            if (skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
                return;
            }

            const dateStr = `${month.toString().padStart(2, '0')}/${d.toString().padStart(2, '0')}`;
            content += `### ${dateStr}\n\n\n`;

            // 8. Dynamic Weekly Separator
            // If the *next* day in the sequence marks the start of a new week, add separator
            // For reverse: if current day is the "firstDayIndex", the one above it was a new week
            // For standard: if current day is the day BEFORE "firstDayIndex", the next is a new week
            const isEndOfWeek = isReverse ? (dayOfWeek === firstDayIndex) : (dayOfWeek === (firstDayIndex + 6) % 7);

            if (isEndOfWeek) {
                content += `---\n\n---\n\n`;
            }
        });

        const doc = await vscode.workspace.openTextDocument({ content: content, language: 'markdown' });
        vscode.window.showTextDocument(doc);
    });

    // Add a command to insert a LaTeX right arrow.
    let insertRightArrowCommand = vscode.commands.registerCommand('nmdHighlighter.insertRightArrow', async () => {
        const editor = vscode.window.activeTextEditor as vscode.TextEditor;
        if (!editor) return;

        editor.edit((editBuilder: { insert: (arg0: any, arg1: string) => void; }) => {
            editBuilder.insert(editor.selection.active, "$\\rightarrow$");
        });
    });

    // Add a command to insert a definition
    let insertDefinitionCommand = vscode.commands.registerCommand('nmdHighlighter.insertDefinitionTemplate', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        // 1. Fetch your new configuration item (defaulting to "red" or a hex color if not found)
        const config = vscode.workspace.getConfiguration('NMDHighlighter');
        const defaultColor = config.get<string>('definitionColor') || "red";

        // 2. Build the Snippet String
        // $1 is the first stop (the word itself). 
        // $0 is the final stop when they finish tab-navigating (the end of the phrase).
        // Note: Backslashes must be escaped (\\) in TypeScript strings.
        const snippetText = `$\\\\textcolor{${defaultColor}}{\\\\textnormal{\${1:WORD}}} \\\\rightarrow\$ $0`;

        const snippet = new vscode.SnippetString(snippetText);

        // 3. Insert the snippet at the active cursor position
        await editor.insertSnippet(snippet);
    });

    let iconGalleryCommand = vscode.commands.registerCommand('nmdHighlighter.showIconGallery', () => {
        handler.showIconGallery();
    });

    context.subscriptions.push(timestampCommand);
    context.subscriptions.push(monthlyTemplateCommand);
    context.subscriptions.push(insertRightArrowCommand);
    context.subscriptions.push(insertDefinitionCommand);
    context.subscriptions.push(iconGalleryCommand);

    // Must return the plugin to VS Code.
    return {
        extendMarkdownIt(md: any) {
            return extendMarkdownItInternal(md);
        }
    };
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

/**
 * Responsible for applying a class to the Markdown Preview, which
 * means that these settings will now apply to the necessary previews.
 */
function extendMarkdownItInternal(md: any) {
    const defaultParagraphOpen = md.renderer.rules.paragraph_open || function (tokens: any, idx: any, options: any, env: any, self: any) {
        return self.renderToken(tokens, idx, options);
    };

    md.renderer.rules.paragraph_open = function (tokens: any, idx: any, options: any, env: any, self: any) {
        const nextToken = tokens[idx + 1];

        if (handler && nextToken && nextToken.type === 'inline') {
            const content = nextToken.content.trim();

            for (const rule of handler.rules) {
                if (rule.checkLine(content)) {
                    let isListItem = false;
                    let currentContent = nextToken.content;

                    // Only strip the dash if it's strictly a list item prefix.
                    if (currentContent.startsWith("- ")) {
                        nextToken.content = currentContent.substring(2);
                        isListItem = true;
                    }

                    let rawSvg = icons[rule.iconName] || '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"></svg>';
                    if (rule.iconColor == rule.bgColor) {
                        rawSvg = rawSvg.replace(/currentColor/g, rule.fgColor);
                    } else {
                        rawSvg = rawSvg.replace(/currentColor/g, rule.iconColor);
                    }
                    tokens[idx].nmdCustom = true;

                    // If it's NOT a list item, wrap in a div to preserve line breaks.
                    const wrapper = isListItem ? "" : `<div class="nmd-block-wrapper">`;

                    return `${wrapper}<span class="nmd-line-inline" style="color: ${rule.fgColor} !important; background-color: ${rule.bgColor} !important; border-radius: 4px;">` +
                        `<span class="nmd-icon-inline">${rawSvg}</span>`;
                }
            }
        }
        return defaultParagraphOpen(tokens, idx, options, env, self);
    };

    const defaultParagraphClose = md.renderer.rules.paragraph_close || function (tokens: any, idx: any, options: any, env: any, self: any) {
        return self.renderToken(tokens, idx, options);
    };

    md.renderer.rules.paragraph_close = function (tokens: any, idx: any, options: any, env: any, self: any) {
        if (tokens[idx].nmdCustom || (idx > 1 && tokens[idx - 2].nmdCustom)) {
            // If we opened a block wrapper, close it
            const isListItem = tokens[idx].nmdListItem; // You can set this flag in open
            // Simple check: was the previous open token a list item? 
            // Better yet, just check if we need the closing div:
            const needsClosingDiv = !self.rules.paragraph_open.lastWasListItem;

            // To make this robust, let's use a simpler marker:
            const closeTag = (tokens[idx].nmdIsBlock) ? "</span></div>" : "</span>";
            return closeTag;
        }
        return defaultParagraphClose(tokens, idx, options, env, self);
    };

    return md;
}

export function deactivate(): Thenable<void> | undefined {
    if (handler) {
        handler.dispose();
    }
    logger.info("NMD Highlighter: Deactivated.");
    return undefined;
}