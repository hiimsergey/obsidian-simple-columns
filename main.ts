import { App, MarkdownView, Platform, Plugin, PluginSettingTab, Setting } from "obsidian"

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
	Render,	// = change the innerHTML of this element to display the text side-by-side
	Skip	// = move to the next element because this one has invalid block column syntax
}

export default class SimpleColumns extends Plugin {
	settings: SimpleColumnsSettings

	/**
	 * Creates the HTML string of the column block
	 * @param html the innerHTML of the to-be-processed column block element
	 * @param config the string of text written behind the `[end]` tag by the user
	 * @returns a HTML string of the column block
	 */
	getBlockColumns (html: string, config: string): string {
		// Removes line breaks in paragraph text to faciliate further manipulations
		html = html.replace(/<br>/g, "</p><p>")

		const widths = this.getBlockWidths(html)

		let blocks = html
			// Removes the `[begin]` and `[end]` tags
			.replace(/<p>\n?\[(begin|end)\].*?<\/p>/g, "")
			// Splits columns by their `[col]` tags
			.split(/<p>\n?\[col\].*?<\/p>/)
			.map((block, i) =>
				// Readds the line breaks that were removed at the start of the function
				`<div style="flex:${widths[i]}">${block.replace(/<\/p><p>/g, "<br>")}</div>`
			)
		
		// Applies wrap setting by adding the `column-wrap` class
		if (
			(Platform.isDesktop || this.settings.renderOnMobile)
			&& (this.settings.wrapByDefault || config.contains("wrap"))
		) blocks = blocks.map(block =>
			block.replace(/div/, "div class=\"osc-wrap\""))

		return blocks.join("")
	}

	/**
	 * Returns the block settings (`rtl`/`ltr` and/or `wrap`) set by the user
	 * @param html the innerHTML of the to-be-processed column block
	 * @returns the string of text written behind the `[end]` tag by the user
	 */
	getBlockConfig(html: string): string {
		const endTagMatch = html.match(/\[end\](.*?)<\/p>/)
		return endTagMatch ? endTagMatch[1] : ""
	}

	/**
	 * Extracts the widths of the columns of a given block element
	 * @param html the innerHTMl of the to-be-processed column block element
	 * @returns a list with the width ratio of the respective columns
	 */
	getBlockWidths(html: string): string[] {
		const regex = /<p>\[(begin|col)\](.*?)<\/p>/g
		const result: string[] = []
		let match: RegExpExecArray | null

		while ((match = regex.exec(html)) !== null)
			result.push(parseInt(match[2]) ? match[2] : " 1")

		return result
	}

	/**
	 * Decides how to manipulate the current element based on its content
	 * @param text the innerText of the current element
	 * @returns an enum member telling how to process this element
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

	async onload() {
		await this.loadSettings()

		this.addSettingTab(new SimpleColumnsSettingTab(this.app, this))

		// A variable storing the content of previously processed element
		let prevEl = { innerHTML: "" } as HTMLElement

		// Rerenders the Reading View each time you change the view
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
			// Merges the content of the previous element with the current one
			el.innerHTML = `${prevEl.innerHTML}\n${el.innerHTML}`
			prevEl.innerHTML = ""

			switch (this.getElementAction(el.innerText)) {
				case ElementAction.Move:
					prevEl = el
					break
				case ElementAction.Render:
					const config = this.getBlockConfig(el.innerHTML)

					if (Platform.isDesktop || this.settings.renderOnMobile) {
						el.addClass("osc-parent")

						// Applies rtl setting
						if (
							!config.contains("ltr")
							&& (this.settings.rtlByDefault || config.contains("rtl"))
						) el.addClass("osc-parent-rtl")
					}

					// Part where the rendered document gets changed
					el.innerHTML = this.getBlockColumns(el.innerHTML, config)
					break
				case ElementAction.Skip:
					break
			}
		})
	}
	
	// Rerenders the Reading View again after disabling plugin
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

	constructor(app: App, plugin: SimpleColumns) {
		super(app, plugin)
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