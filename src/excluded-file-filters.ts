import { App, EventRef, Notice, Plugin } from 'obsidian';

type UnknownRecord = Record<string, unknown>;
type UnknownMethod = (this: unknown, ...args: unknown[]) => unknown;

function asRecord(value: unknown): UnknownRecord | null {
    return value !== null && typeof value === 'object'
        ? (value as UnknownRecord)
        : null;
}

function getFilePath(candidate: unknown): string | null {
    const record = asRecord(candidate);
    if (!record) return null;

    const file = asRecord(record.file);
    if (file && typeof file.path === 'string') return file.path;

    const item = asRecord(record.item);
    if (item?.type === 'file' && typeof item.path === 'string') {
        return item.path;
    }

    if (
        typeof record.path === 'string' &&
        (record.type === 'file' || typeof record.extension === 'string')
    ) {
        return record.path;
    }

    return null;
}

function filterResult(
    result: unknown,
    isUserIgnored: (path: string) => boolean,
): unknown {
    const filter = (items: unknown[]) =>
        items.filter((item) => {
            const path = getFilePath(item);
            return path === null || !isUserIgnored(path);
        });

    if (Array.isArray(result)) return filter(result);
    if (result !== null && typeof result === 'object' && 'then' in result) {
        return Promise.resolve(result).then((items: unknown) =>
            Array.isArray(items) ? filter(items) : items,
        );
    }
    return result;
}

function patchArrayMethod(
    target: UnknownRecord,
    methodName: string,
    isUserIgnored: (path: string) => boolean,
    restores: (() => void)[],
): boolean {
    const original = target[methodName];
    if (typeof original !== 'function') return false;

    const wrapped: UnknownMethod = function (
        this: unknown,
        ...args: unknown[]
    ) {
        const result = (original as UnknownMethod).apply(this, args);
        return filterResult(result, isUserIgnored);
    };

    try {
        target[methodName] = wrapped;
    } catch {
        return false;
    }

    restores.push(() => {
        if (target[methodName] === wrapped) target[methodName] = original;
    });
    return true;
}

function findLinkSuggest(app: App): UnknownRecord | null {
    const workspace = app.workspace as unknown as UnknownRecord;
    const editorSuggest = asRecord(workspace.editorSuggest);
    const suggests = editorSuggest?.suggests;
    if (!Array.isArray(suggests)) return null;

    return (
        suggests.find((suggest) => {
            const manager = asRecord(asRecord(suggest)?.suggestManager);
            return typeof manager?.getSuggestionsAsync === 'function';
        }) as UnknownRecord | undefined
    ) ?? null;
}

export function registerExcludedFileFilters(app: App, plugin: Plugin): void {
    const metadataCache = app.metadataCache as unknown as UnknownRecord;
    const isUserIgnoredMethod = metadataCache.isUserIgnored;
    if (typeof isUserIgnoredMethod !== 'function') {
        new Notice('Could not read Obsidian exclusion settings.');
        return;
    }

    const isUserIgnored = (path: string) =>
        (isUserIgnoredMethod as (path: string) => boolean).call(
            metadataCache,
            path,
        );
    const restores: (() => void)[] = [];

    const internalPlugins = asRecord(
        (app as unknown as UnknownRecord).internalPlugins,
    );
    const getEnabledPluginById = internalPlugins?.getEnabledPluginById;
    let quickSwitcherPatched = false;
    if (typeof getEnabledPluginById === 'function') {
        const switcher = asRecord(
            (getEnabledPluginById as UnknownMethod).call(
                internalPlugins,
                'switcher',
            ),
        );
        const quickSwitcherModal = switcher?.QuickSwitcherModal;
        const prototype =
            typeof quickSwitcherModal === 'function'
                ? asRecord(
                    (quickSwitcherModal as { prototype?: unknown }).prototype,
                )
                : null;
        if (prototype) {
            quickSwitcherPatched = patchArrayMethod(
                prototype,
                'getSuggestions',
                isUserIgnored,
                restores,
            );
        }
    }

    const linkSuggest = findLinkSuggest(app);
    const suggestManager = asRecord(linkSuggest?.suggestManager);
    let linkSuggestPatched = false;
    if (linkSuggest && suggestManager) {
        suggestManager.fileSuggestions = null;
        linkSuggestPatched = patchArrayMethod(
            linkSuggest,
            'getSuggestions',
            isUserIgnored,
            restores,
        );
        plugin.registerEvent(
            (
                app.vault.on as unknown as (
                    name: 'config-changed',
                    callback: (key: string) => void,
                ) => EventRef
            ).call(app.vault, 'config-changed', (key) => {
                if (key === 'userIgnoreFilters') {
                    suggestManager.fileSuggestions = null;
                }
            }),
        );
        plugin.register(() => {
            suggestManager.fileSuggestions = null;
        });
    }

    const linkSuggestionIndexPatched = patchArrayMethod(
        metadataCache,
        'getLinkSuggestions',
        isUserIgnored,
        restores,
    );
    if (
        !quickSwitcherPatched ||
        !linkSuggestPatched ||
        !linkSuggestionIndexPatched
    ) {
        new Notice(
            'Could not connect to all suggestion providers. Obsidian may have changed its internals.',
        );
    }

    plugin.register(() => {
        for (const restore of restores.reverse()) restore();
    });
}