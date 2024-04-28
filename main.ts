import {
	App,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
	WorkspaceLeaf,
	debounce,
} from "obsidian";

interface MyPluginSettings {
	debounceTimeout: number;
	tags: string[];
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	debounceTimeout: 100,
	tags: ["HOC", "MOC"],
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async checkForTag(
		view: MarkdownView,
		allowTags: string[]
	): Promise<boolean> {
		try {
			const fileContent = view.editor.getValue();
			// 파일 내용에서 첫 번째 "---"로 시작하는 블록을 찾음
			const frontMatterBlock = fileContent.match(/^---\n([\s\S]*?)\n---/);
			if (!frontMatterBlock) {
				return false;
			}

			if (frontMatterBlock) {
				// YAML 형태의 문자열에서 "tags:" 이후의 내용을 추출
				const tagsMatch =
					frontMatterBlock[1].match(/tags:\n(.*?)\n(?=\w)/s);
				if (tagsMatch) {
					// "tags" 섹션에서 각 태그를 배열로 변환
					const tags = tagsMatch[1]
						.split("\n")
						.map((tag) => tag.trim().replace(/^- /, ""));
					// new Notice(`tags: ${tags}`, 5000);
					// 태그 중 하나라도 allowTags 배열에 포함되어 있으면 true 반환
					if (tags.some((tag) => allowTags.includes(tag))) {
						return true;
					}
				}
			}
			return false;
		} catch (error) {
			console.error(`Error reading file: ${error}`);
		}
		return false;
	}

	forceReadingView = async (leaf: WorkspaceLeaf) => {
		let view = leaf.view instanceof MarkdownView ? leaf.view : null;
		if (view) {
			const containTags = await this.checkForTag(
				view,
				this.settings.tags
			);
			// new Notice(`containTags: ${containTags}`, 5000);

			// reading view 일때 mode: preview / soruce: false
			// editing view 일때 mode: source / source: false
			let state = leaf.getViewState();
			state.state["mode"] = containTags ? "preview" : "source";
			await leaf.setViewState(state);
		}
	};

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on(
				"active-leaf-change",
				this.settings.debounceTimeout === 0
					? this.forceReadingView
					: debounce(
							this.forceReadingView,
							this.settings.debounceTimeout
					  )
			)
		);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Tags")
			.setDesc(
				"Enter the tags to set the files you want to force to view in reading view, separated by commas. (EX: MOC, HOC)"
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.tags.join(", "))
					.setValue(String(this.plugin.settings.tags.join(", ")))
					.onChange(async (value) => {
						this.plugin.settings.tags = value
							.split(",")
							.map((tag) => tag.replace("#", "").trim());
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("DebounceTimeout")
			.setDesc(
				"Set the debounce timeout for the active leaf change event. (0 for no debounce)"
			)
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.debounceTimeout.toString())
					.setValue(String(this.plugin.settings.debounceTimeout))
					.onChange(async (value) => {
						this.plugin.settings.debounceTimeout = parseInt(value);
						await this.plugin.saveSettings();
					})
			);
	}
}
