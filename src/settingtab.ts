import { App, PluginSettingTab, Setting } from 'obsidian'
import Osc from './main'

export default class OscSettingTab extends PluginSettingTab {
	plugin: Osc

	constructor(app: App, plugin: Osc) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const {containerEl} = this

		containerEl.empty()

		new Setting(containerEl)
			.setName('Default block arrangement')
			.setDesc('Horizontal order in which the blocks are arranged')
			.addDropdown(dd => {
				dd.addOption('ltr', 'Left-to-Right')
				dd.addOption('rtl', 'Right-to-Left')
				dd.setValue(this.plugin.settings.defaultBlockArrangement)
				dd.onChange(async value => {
					this.plugin.settings.defaultBlockArrangement = value
					await this.plugin.saveSettings()
				})
			})
	}
}
