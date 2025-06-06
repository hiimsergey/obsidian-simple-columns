import { MarkdownView, Platform, Plugin, PluginSettingTab, Setting } from "obsidian"

interface SimpleColumnsSettings {
	rtlByDefault: boolean,
	wrapByDefault: boolean,
	renderOnMobile: boolean
}

const DEFAULT_SETTINGS: SimpleColumnsSettings = {
	rtlByDefault: false,
	wrapByDefault: false,
	renderOnMobile: true
}

// See `SimpleColumns.getElementAction()`
enum ElementAction {
	Move,	// = merge this element with the next one
	Render,	// = alter this element to display the text side-by-side
	Skip	// = move to the next element because this one has invalid block column syntax
}

export default class SimpleColumns extends Plugin {
	settings: SimpleColumnsSettings

	/**
	 * Create the HTML string of the column block
	 * @param el to-be-processed column block element
	 * @param config the string of text written behind the `[end]` tag by the user
	 */
	getBlockColumns (el: HTMLElement, config: string) {
		// Remove line breaks in paragraph text to faciliate further manipulations
        this.removeBreaks(el)
		const widths = this.getBlockWidths(el.innerText)

        let blocks: HTMLElement[] = [document.createDiv()]
        blocks[0].style.flex = widths[0]

        let prevP: Element|null = null
        for (const child of Array.from(el.children)) {
            if (child.tagName === "P") {
                if (child.textContent?.match(/^\n?\[(begin|end)\]/)) {
                    child.remove()
                    continue
                }

                if (child.textContent?.match(/^\n?\[col\]/)) {
                    blocks.push(document.createDiv())
                    blocks[blocks.length - 1].style.flex = widths[blocks.length - 1]
                    continue
                }

                if (prevP) {
                    prevP.append(
                        document.createElement("br"),
                        ...Array.from(child.children)
                    )
                    child.remove()
                    continue
                }

                prevP = child
                continue
            }

            prevP = null
            blocks[blocks.length - 1].appendChild(child)
        }

		// Apply wrap setting by adding the `column-wrap` class
		if ((Platform.isDesktop || this.settings.renderOnMobile) &&
            (this.settings.wrapByDefault || config.contains("wrap")))
            blocks.forEach(block => block.classList.add("osc-wrap"))

        while (el.children.length > 0) el.firstChild?.remove()
        el.append(...blocks)
	}

	/**
	 * Return the block settings (`rtl`/`ltr` and/or `wrap`) set by the user
	 * @param html to-be-processed column block
	 * @returns string of text written behind the `[end]` tag by the user
	 */
	getBlockConfig(html: string): string {
		const endTagMatch = html.match(/\[end\](.*?)$/)
		return endTagMatch ? endTagMatch[1] : ""
	}

	/**
	 * Extract the widths of the columns of a given block element
	 * @param html innerText of the to-be-processed column block element
	 * @returns list with the width ratio of the respective columns
	 */
	getBlockWidths(html: string): string[] {
		const regex = /\[(begin|col)\](.*?)$/g
		const result: string[] = []
		let match: RegExpExecArray | null

		while ((match = regex.exec(html)) !== null)
			result.push(parseInt(match[2]) ? match[2] : " 1")

		return result
	}

	/**
	 * Decide how to manipulate the current element based on its content
	 * @param text the innerText of the current element
	 * @returns enum member telling how to process this element
	 */
	getElementAction(text: string): ElementAction {
		let hasBeginTag = false, hasEndTag = false

		text.split("\n").forEach(line => {
			if (line.startsWith("[begin]")) {
				// Element has two `[begin]` tags -> syntax error
				if (hasBeginTag) return ElementAction.Skip
				hasBeginTag = true
			}
			if (line.startsWith("[end]")) {
				// Element has two `[end]` tags -> syntax error
				if (hasEndTag) return ElementAction.Skip
				hasEndTag = true
			}
		})

		if (hasBeginTag) {
			// Element has one `[begin]` tag and one `[end]` tag -> valid column block
			if (hasEndTag) return ElementAction.Render
			// Element lacks the corresponding `[end]` tag
			return ElementAction.Move
		}

		return ElementAction.Skip
	}

	/**
	 * Split up paragraph children line-by-line by removing `<br>` elements.
     * Consider it like turning `<p>foo<br>bar</p>` into `<p>foo</p><p>bar</p>`.
	 * @param el original element of a document snippet
	 */
	removeBreaks(el: HTMLElement) {
        for (const p of Array.from(el.querySelectorAll("p"))) {
            const parts: Node[][] = []
            let cur: Node[] = []

            for (const child of Array.from(p.childNodes)) {
                if (child.nodeName == "BR") {
                    parts.push(cur)
                    cur = []
                } else {
                    cur.push(child)
                }
            }
            parts.push(cur)

            if (parts.length === 1) continue // Nothing to split

            const newParagraphs = parts.map(nodes => {
                const newP = document.createElement("p")
                for (const node of nodes) newP.prepend(node)
                return newP
            })

            for (const newP of newParagraphs) p.prepend(newP)
            p.remove()
        }
    }

	async onload() {
		await this.loadSettings()

		this.addSettingTab(new SimpleColumnsSettingTab(this))

		// Variable storing the content of previously processed element
        let prevEls: HTMLElement[] = []

		// Rerender reading view each time you change the view
		this.registerEvent(this.app.workspace.on("layout-change", () => {
			this.app.workspace
				.getActiveViewOfType(MarkdownView)?.previewMode
				.rerender(true)
		}))

		// The Markdown post processor divides the rendered text into fragments of the
		// same Markdown syntax element type, e.g. headings, lists, tables, etc. In that
		// callback, `el` refers to the HTMLElement object of one fragment. Thus, the
		// callback runs multiple times for every fragment of the note.
		this.registerMarkdownPostProcessor(el => {
			// Merge the content of the previous element with the current one
            for (const pel of prevEls) el.prepend(pel)
			prevEls = []

			switch (this.getElementAction(el.innerText)) {
				case ElementAction.Move:
                    prevEls.push(el)
					break
				case ElementAction.Render:
					const config = this.getBlockConfig(el.innerText)

					if (Platform.isDesktop || this.settings.renderOnMobile) {
						el.addClass("osc-parent")

						// Apply rtl setting
						if (!config.contains("ltr") &&
                            (this.settings.rtlByDefault || config.contains("rtl")))
                            el.addClass("osc-parent-rtl")
					}

					// Part where the rendered document gets changed
					this.getBlockColumns(el, config)
					break
				case ElementAction.Skip:
					break
			}
		})
	}
	
	// Rerender reading view again after disabling plugin
	onunload() {
		this.app.workspace
			.getActiveViewOfType(MarkdownView)?.previewMode
			.rerender(true)
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}
}

class SimpleColumnsSettingTab extends PluginSettingTab {
	plugin: SimpleColumns

	constructor(plugin: SimpleColumns) {
		super(plugin.app, plugin)
		this.plugin = plugin
	}

	display() {
		const { containerEl } = this

		containerEl.empty()
	
		new Setting(containerEl)
			.setName("RTL by default")
			.setDesc("Arrange the blocks right-to-left even without specifying it")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.rtlByDefault)
				.onChange(async () => {
					this.plugin.settings.rtlByDefault =
						!this.plugin.settings.rtlByDefault
					await this.plugin.saveSettings()
				}))
	
		new Setting(containerEl)
			.setName("Wrap blocks by default")
			.setDesc("Make the blocks wrap to the next line if necessary by default")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.wrapByDefault)
				.onChange(async () => {
					this.plugin.settings.wrapByDefault =
						!this.plugin.settings.wrapByDefault
					await this.plugin.saveSettings()
				}))
	
		new Setting(containerEl)
			.setName("Render blocks on mobile")
			.setDesc("Also put the blocks side-by-side on mobile")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.renderOnMobile)
				.onChange(async () => {
					this.plugin.settings.renderOnMobile =
						!this.plugin.settings.renderOnMobile
					await this.plugin.saveSettings()
				}))
	}
}
