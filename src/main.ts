// TODO
// CHECK whether the plugin is truly desktop_only
// CHECK if PDF export looks good
// CHECK if setting works
// CHECK if large files have decent performance
// if not: https://docs.obsidian.md/Plugins/Editor/Viewport
// END check imports

// TODO PLAN
// SETTING Default block alignment: Dropdown [Left-to-Right, Right-to-Left]
// EDIT existing comments
import { Editor, MarkdownView, Plugin } from 'obsidian'
import { DEFAULT_SETTINGS, OscSettings } from './settings'
import OscSettingTab from './settingtab'

export default class Osc extends Plugin {
	settings: OscSettings

	async onload() {
		await this.loadSettings()
		this.addSettingTab(new OscSettingTab(this.app, this))

		// TODO: When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000))
	}

	// TODO idk if i need to keep it or not
	onunload() {}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}
}