import { Plugin } from 'obsidian';
import { registerExcludedFileFilters } from './excluded-file-filters';

export default class HideExcludedFilesMorePlugin extends Plugin {
	onload(): void {
		registerExcludedFileFilters(this.app, this);
	}
}