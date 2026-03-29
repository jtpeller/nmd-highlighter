import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const icons: { [key: string]: string } = {
    // Exclamation Point
    "exclaim": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%color" d="M8 1A7 7 0 1 0 8 15A7 7 0 0 0 8 1zm-.5 3h1v5h-1V4zm.5 8.25a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z"/></svg>`,
    // Lightning Bolt
    "lightning": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%color" d="M9.5 1.5L4.5 9h3.5l-1.5 5.5L12.5 7H9l.5-5.5z"/></svg>`,
    // Bug
    "bug": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%color" d="M8 3a2.5 2.5 0 0 0-2.5 2.5V6h5v-.5A2.5 2.5 0 0 0 8 3Zm3 4H5v3.5A3 3 0 0 0 8 13.5a3 3 0 0 0 3-3V7Zm1-1.234V7h1.5a.5.5 0 0 1 0 1H12v1.5h1.5a.5.5 0 0 1 0 1H12v1.5a2.5 2.5 0 0 1-1.373 2.23l.873.873a.5.5 0 0 1-.707.707l-1.025-1.025A3.98 3.98 0 0 1 8 14.5a3.98 3.98 0 0 1-1.768-.415L5.207 15.11a.5.5 0 0 1-.707-.707l.873-.873A2.5 2.5 0 0 1 4 11.266V9.5h-1.5a.5.5 0 0 1 0-1H4V7h-1.5a.5.5 0 0 1 0-1H4v-.234a3.487 3.487 0 0 1-1.121-1.89l-.754-.755a.5.5 0 0 1 .707-.707l.755.754A3.48 3.48 0 0 1 5.5 2.11V1.5a.5.5 0 0 1 1 0v.51a3.514 3.514 0 0 1 3 0V1.5a.5.5 0 0 1 1 0v.61a3.48 3.48 0 0 1 1.663.411l.755-.754a.5.5 0 0 1 .707.707l-.754.755A3.487 3.487 0 0 1 12 5.766Z"/></svg>`,
    // Star
    "star": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%color" d="M8 .25a.75.75 0 0 1 .67.42l2.05 4.15 4.58.67a.75.75 0 0 1 .41 1.28l-3.32 3.23.78 4.56a.75.75 0 0 1-1.09.79L8 13.18l-4.1 2.15a.75.75 0 0 1-1.09-.79l.78-4.56-3.32-3.23a.75.75 0 0 1 .41-1.28l4.58-.67L7.33.67A.75.75 0 0 1 8 .25z"/></svg>`,
    // Checkmark
    "checkmark": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%color" d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>`,
    // Pencil
    "pencil": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path fill="%color" d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25a1.75 1.75 0 0 1 .445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086ZM11.189 6.25l-1.44-1.44L3.515 11.044a.25.25 0 0 0-.064.108l-.437 1.53 1.53-.437a.25.25 0 0 0 .108-.063l6.537-6.537Z"/></svg>`,
};

const logger = vscode.window.createOutputChannel("NMD Highlighter", { log: true });

export let handler: NMDExtensionDirector;

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
        this.svg = this.createSvgString(icons[iconName]);
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
        let svg = icons[svgName];
        return this.createSvgUri(svg.replace("%color", this.iconColor));
    }

    // Checks whether provided line contains required keyword.
    checkLine(line: string) {
        for (var keyword of this.keywords) {
            if (line.startsWith(keyword)
                || line.startsWith(`_${keyword}`)
                || line.startsWith(`*${keyword}`)
                || line.startsWith(`**${keyword}`)
                || line.startsWith(`***${keyword}`)
                || line.startsWith(`**_${keyword}`)
                || line.startsWith(`- ${keyword}`)
                || line.startsWith(`- _${keyword}`)
                || line.startsWith(`- *${keyword}`)
                || line.startsWith(`- **${keyword}`)
                || line.startsWith(`- ***${keyword}`)
                || line.startsWith(`- **_${keyword}`)
            ) {
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

        // Write the CSS to the physical file VS Code is watching
        const cssContent = this.generateCSS();
        const stylePath = path.join(this.#context.extensionPath, './styles/nmd-styles.css');

        try {
            fs.writeFileSync(stylePath, cssContent);
        } catch (err) {
            logger.error("Failed to write dynamic CSS file: " + err);
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
/* Ensure standalone NMD elements stay on their own line */
.nmd-block-wrapper {
    display: block;
    margin: 6px 0;
}

/* Hide the default bullet for list items containing an NMD line */
li:has(.nmd-line-inline) {
    list-style: none !important;
    /* Adjust margin to match where the bullet used to be */
    margin-left: -1.6em;
}

/* Style the inline icon wrapper */
.nmd-line-inline {
    display: inline-flex;
    align-items: center;
    gap: 8px; /* Space between icon and text */
}

.nmd-icon-inline {
    display: inline-block;
    width: 1.1em;
    height: 1.1em;
    flex-shrink: 0;
    /* Vertically center the icon with the text line */
    vertical-align: text-bottom;
}

.nmd-icon-inline svg {
    width: 100%;
    height: 100%;
    display: block;
}

/* Text styling */
.nmd-text-colored {
    font-weight: 500;
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
}

// Necessary activate function.
export function activate(context: vscode.ExtensionContext) {
    logger.debug("NMD Highlighter: Activating...!");
    handler = new NMDExtensionDirector(context);

    // Listen for settings changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('NMDHighlighter.enabled')
            || e.affectsConfiguration('NMDHighlighter.bgColors')
            || e.affectsConfiguration('NMDHighlighter.fgColors')
            || e.affectsConfiguration('NMDHighlighter.keywords')
            || e.affectsConfiguration('NMDHighlighter.icons')) {
            handler.loadSettings();
        }
    }));

    // Initial load
    handler.loadSettings();

    // Register the Timestamp Command
    let timestampCommand = vscode.commands.registerCommand('nmdHighlighter.insertTimestamp', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        // 1. Pull your custom categories from settings
        const config = vscode.workspace.getConfiguration('NMDHighlighter');
        const keywordsMap: { [key: string]: string[] } = config.get('keywords') || {};
        const categories = Object.keys(keywordsMap);

        // 2. Show the Quick Pick menu to the user
        const selection = await vscode.window.showQuickPick(categories, {
            placeHolder: 'Select a log category',
            canPickMany: false
        });

        // 3. Prepare the text (Timestamp + Keyword)
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

    context.subscriptions.push(timestampCommand);
    context.subscriptions.push(monthlyTemplateCommand);

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
                    // 1. Clean the content if it's a list item
                    let isListItem = false;
                    if (nextToken.content.trim().startsWith("- ")) {
                        nextToken.content = nextToken.content.replace("- ", "");
                        isListItem = true;
                    }

                    let rawSvg = icons[rule.iconName];
                    if (rule.iconColor == rule.bgColor) {
                        rawSvg = rawSvg.replace("%color", rule.fgColor);
                    } else {
                        rawSvg = rawSvg.replace("%color", rule.iconColor);
                    }
                    tokens[idx].nmdCustom = true;

                    // 2. Logic: If it's NOT a list item, wrap in a div to preserve line breaks
                    const openTag = isListItem ? "" : `<div class="nmd-block-wrapper">`;

                    return `${openTag}<span class="nmd-line-inline nmd-text-colored" style="color: ${rule.fgColor} !important; background-color: ${rule.bgColor} !important; border-radius: 4px;">` +
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

// Deactivate just stops everything from happening.
export function deactivate() { }