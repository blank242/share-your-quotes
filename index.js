import {
    ACTIVE_CLASS,
    BACKGROUND_ASSET_PATH,
    BACKGROUND_ASSETS,
    BACKGROUND_PRESET_KEYS,
    CUSTOM_CHAT_ID,
    CUSTOM_CHAT_LABEL,
    CUSTOM_THEME,
    DATE_LOCALE,
    DEFAULT_CHAT_TITLE,
    DEFAULT_PERSONA_NAME,
    ELLIPSIS,
    EXTENSION_TEMPLATE_PATH,
    FILE_READER_EMPTY_JSON,
    FILE_UPLOAD_ENDPOINT,
    FONT_FAMILIES,
    FONT_LOAD_SPECS,
    MODULE_NAME,
    QUOTE_PLACEHOLDER_TEXT,
    SAVED_QUOTES_FILE_NAME,
    SOURCE_SEPARATOR,
} from './constants.js';

const EXPORT_VERSION = 1;
const JSON_INDENT = 2;
const IMAGE_WIDTH = 1080;
const IMAGE_MIME_TYPE = 'image/png';
const DOWNLOAD_NAME_MAX_LENGTH = 48;
const DOWNLOAD_TEXT_FALLBACK_LENGTH = 18;
const LIBRARY_PAGE_SIZE = 10;
const LIBRARY_PAGE_GROUP_SIZE = 10;
const SELECTION_MENU_OFFSET_Y = 12;
const TOUCH_MOUSE_SUPPRESSION_MS = 700;
const WAND_BUTTON_RETRY_DELAYS = Object.freeze([500, 1500]);
const CLIPBOARD_READ_DELAY_MS = 50;
const SELECTION_UPDATE_DELAYS = Object.freeze({
    default: [60],
    mouseup: [30, 90],
    touchend: [120, 260, 420],
    selectionchange: [80, 180],
});
const QUOTE_LAYOUT = Object.freeze({
    sidePaddingRatio: 0.12,
    topPaddingRatio: 0.16,
    bottomPaddingRatio: 0.12,
    sourceLineHeightRatio: 1.4,
    sourceGapRatio: 0.85,
    sourceAlpha: 0.9,
});
const OVERLAY_COLORS = Object.freeze({
    lighten: 'rgba(255, 255, 255, 0.6)',
    darken: 'rgba(0, 0, 0, 0.3)',
});
const FALLBACK_BACKGROUND_COLORS = Object.freeze({
    black: '#000000',
    white: '#ffffff',
    custom: '#202633',
});
const GRADIENT_PRESETS = Object.freeze({
    night: [
        [0, '#070d1f'],
        [0.56, '#101b3b'],
        [1, '#163150'],
    ],
    blueMist: [
        [0, '#021128'],
        [0.62, '#0c1d49'],
        [1, '#23497b'],
    ],
    aquaGlow: [
        [0, '#2c98c1'],
        [1, '#d8f3fa'],
    ],
    softPink: [
        [0, '#ffb6bf'],
        [1, '#ff8cab'],
    ],
    violetRoom: [
        [0, '#8c87f8'],
        [1, '#4d36d6'],
    ],
});
const TEXT_METRICS = Object.freeze({
    small: { quote: 36, title: 36, lineHeight: 1.8 },
    normal: { quote: 42, title: 36, lineHeight: 1.8 },
    large: { quote: 48, title: 36, lineHeight: 1.8 },
});
const defaultSettings = Object.freeze({
    enableSelectionBubble: true,
    defaultTheme: BACKGROUND_PRESET_KEYS.night,
    defaultAspectRatio: '1:1',
    defaultFontFamily: 'pretendard',
    defaultFontSize: 'normal',
    defaultTextColor: 'white',
    defaultTextAlign: 'left',
    defaultDarken: true,
    defaultLighten: false,
    savedQuotes: [],
    savedQuotesJsonPath: '',
});

const popupState = {
    modal: null,
    canvas: null,
    fields: null,
    busy: false,
    selectedText: '',
    customBackgroundUrl: '',
    customBackgroundImage: null,
    initialQuote: null,
    sourceChatId: CUSTOM_CHAT_ID,
    sourceChatName: CUSTOM_CHAT_LABEL,
};

const selectionState = {
    menu: null,
    selectedText: '',
    updateTimers: [],
    lastTouchAt: 0,
};

const libraryState = {
    modal: null,
    list: null,
    items: null,
    pagination: null,
    filterSelect: null,
    importInput: null,
    filterChatId: '',
    fallbackFilterChatId: '',
    currentPage: 1,
};

const editorState = {
    modal: null,
    fields: null,
    quoteId: '',
};

const backgroundAssetCache = new Map();
let fontsLoadedPromise = null;

const FONT_PRESETS = Object.freeze({
    pretendard: { family: FONT_FAMILIES.pretendard, weight: 400 },
    wonbatang: { family: FONT_FAMILIES.wonbatang },
    nanum: { family: FONT_FAMILIES.nanum },
    nexon: { family: FONT_FAMILIES.nexon, weight: 300 },
});

const COLOR_PRESETS = Object.freeze({
    white: { fill: '#f8f8f6' },
    black: { fill: '#111111' },
});

const BACKGROUND_PRESETS = Object.freeze({
    [BACKGROUND_PRESET_KEYS.night]: { draw: drawImageBackground, asset: BACKGROUND_ASSETS.night, fallback: drawNightFallback },
    [BACKGROUND_PRESET_KEYS.black]: { draw: drawBlackBackground },
    [BACKGROUND_PRESET_KEYS.white]: { draw: drawWhiteBackground },
    [BACKGROUND_PRESET_KEYS.blueMist]: { draw: drawImageBackground, asset: BACKGROUND_ASSETS.blueMist, fallback: drawBlueMistFallback },
    [BACKGROUND_PRESET_KEYS.aquaGlow]: { draw: drawImageBackground, asset: BACKGROUND_ASSETS.aquaGlow, fallback: drawAquaGlowFallback },
    [BACKGROUND_PRESET_KEYS.softPink]: { draw: drawSoftPink },
    [BACKGROUND_PRESET_KEYS.violetRoom]: { draw: drawVioletRoom },
});

function getContextSafe() {
    return globalThis.SillyTavern?.getContext?.();
}

function getSettings() {
    const context = getContextSafe();
    if (!context) {
        return structuredClone(defaultSettings);
    }

    const root = context.extensionSettings;
    if (!root[MODULE_NAME]) {
        root[MODULE_NAME] = structuredClone(defaultSettings);
    }

    for (const [key, value] of Object.entries(defaultSettings)) {
        if (root[MODULE_NAME][key] === undefined) {
            root[MODULE_NAME][key] = structuredClone(value);
        }
    }

    return root[MODULE_NAME];
}

function saveSettings() {
    getContextSafe()?.saveSettingsDebounced?.();
}

function renderTemplate(context, templateName) {
    return context.renderExtensionTemplateAsync(EXTENSION_TEMPLATE_PATH, templateName, {});
}

function createModalFromHtml(html, extraClass = '') {
    const modal = document.createElement('div');
    modal.className = ['syq-modal', extraClass].filter(Boolean).join(' ');
    modal.innerHTML = `<div class="syq-modal-backdrop"></div>${html}`;
    document.body.appendChild(modal);
    return modal;
}

function encodeBase64Utf8(value) {
    const bytes = new TextEncoder().encode(value);
    const chunkSize = 0x8000;
    const chunks = [];

    for (let index = 0; index < bytes.length; index += chunkSize) {
        chunks.push(String.fromCharCode(...bytes.subarray(index, index + chunkSize)));
    }

    return btoa(chunks.join(''));
}

async function syncSavedQuotesJsonFile() {
    const context = getContextSafe();
    if (!context?.getRequestHeaders) {
        return;
    }

    try {
        const payload = {
            savedQuotes: getSavedQuotes(),
        };
        const response = await fetch(FILE_UPLOAD_ENDPOINT, {
            method: 'POST',
            headers: context.getRequestHeaders(),
            body: JSON.stringify({
                name: SAVED_QUOTES_FILE_NAME,
                data: encodeBase64Utf8(JSON.stringify(payload, null, JSON_INDENT)),
            }),
            cache: 'no-cache',
        });

        if (!response.ok) {
            throw new Error(`JSON sync failed: ${response.status}`);
        }

        const result = await response.json();
        const settings = getSettings();
        settings.savedQuotesJsonPath = String(result?.path || settings.savedQuotesJsonPath || '');
        saveSettings();
    } catch (error) {
        console.warn('Share Your Quotes: failed to sync saved quote JSON file', error);
    }
}

function createQuoteId() {
    return globalThis.crypto?.randomUUID?.()
        || `syq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSavedQuotes() {
    const settings = getSettings();
    if (!Array.isArray(settings.savedQuotes)) {
        settings.savedQuotes = [];
    }

    return settings.savedQuotes;
}

function persistSavedQuotes(quotes) {
    const settings = getSettings();
    settings.savedQuotes = quotes;
    saveSettings();
    void syncSavedQuotesJsonFile();
}

function normalizeQuoteRecord(input, fallback = {}) {
    return {
        id: String(input?.id || fallback.id || createQuoteId()),
        text: String(input?.text || fallback.text || '').trim(),
        title: String(input?.title || fallback.title || '').trim(),
        author: String(input?.author || fallback.author || '').trim(),
        chatId: String(input?.chatId || fallback.chatId || CUSTOM_CHAT_ID),
        chatName: String(input?.chatName || fallback.chatName || ''),
        savedAt: String(input?.savedAt || fallback.savedAt || new Date().toISOString()),
    };
}

function getCurrentChatInfo() {
    const context = getContextSafe();
    const currentGroup = context?.groups?.find?.(group => String(group.id) === String(context?.groupId));
    const currentCharacter = context?.characters?.[context?.characterId];
    const fileName = (
        context?.chatId ||
        context?.chat_id ||
        currentGroup?.chat_id ||
        currentCharacter?.chat
    );
    const integrityId = context?.chatMetadata?.integrity;
    const chatName = String(fileName || currentGroup?.name || currentCharacter?.name || CUSTOM_CHAT_ID)
        .replace(/\.jsonl$/i, '')
        .replace(/^.*[\\/]/, '');

    if (!fileName && !integrityId) {
        return { id: CUSTOM_CHAT_ID, name: CUSTOM_CHAT_LABEL };
    }

    return {
        id: String(integrityId || fileName),
        name: chatName,
        fileName: fileName ? String(fileName) : '',
    };
}

function saveQuoteRecord(input) {
    const quote = normalizeQuoteRecord(input);
    if (!quote.text) {
        toastr.warning('저장할 문장이 없어요.');
        return null;
    }

    persistSavedQuotes([quote, ...getSavedQuotes()]);
    return quote;
}

function deleteQuoteRecord(id) {
    persistSavedQuotes(getSavedQuotes().filter(quote => quote.id !== id));
}

function updateQuoteRecord(id, input) {
    const savedQuotes = getSavedQuotes();
    const index = savedQuotes.findIndex(quote => quote.id === id);
    if (index === -1) {
        toastr.warning('문장을 찾을 수 없어요.');
        return null;
    }

    const text = String(input.text || '').trim();
    if (!text) {
        toastr.warning('저장할 문장이 없어요.');
        return null;
    }

    const updatedQuote = {
        ...savedQuotes[index],
        text,
        title: String(input.title || '').trim(),
        author: String(input.author || '').trim(),
    };

    persistSavedQuotes([
        ...savedQuotes.slice(0, index),
        updatedQuote,
        ...savedQuotes.slice(index + 1),
    ]);
    return updatedQuote;
}

function getQuoteRecord(id) {
    return getSavedQuotes().find(quote => quote.id === id) || null;
}

function getQuoteChatId(quote) {
    return String(quote?.chatId || CUSTOM_CHAT_ID);
}

function getQuoteChatLabel(quote) {
    const chatId = getQuoteChatId(quote);
    if (chatId === CUSTOM_CHAT_ID) {
        return CUSTOM_CHAT_LABEL;
    }

    const currentChat = getCurrentChatInfo();
    if (currentChat.id === chatId) {
        return currentChat.name;
    }

    return String(quote?.chatName || chatId)
        .replace(/\.jsonl$/i, '')
        .replace(/^.*[\\/]/, '');
}

function getLibraryChatOptions(quotes) {
    const options = new Map();
    for (const quote of quotes) {
        const chatId = getQuoteChatId(quote);
        if (!options.has(chatId)) {
            options.set(chatId, getQuoteChatLabel(quote));
        }
    }

    if (!options.has(CUSTOM_CHAT_ID)) {
        options.set(CUSTOM_CHAT_ID, CUSTOM_CHAT_LABEL);
    }

    return Array.from(options, ([value, label]) => ({ value, label }))
        .sort((a, b) => {
            if (a.value === CUSTOM_CHAT_ID) {
                return 1;
            }
            if (b.value === CUSTOM_CHAT_ID) {
                return -1;
            }

            return a.label.localeCompare(b.label);
        });
}

function renderLibraryChatFilter(quotes) {
    if (!libraryState.filterSelect) {
        return;
    }

    const options = getLibraryChatOptions(quotes);
    if (libraryState.filterChatId && !options.some(option => option.value === libraryState.filterChatId)) {
        libraryState.filterChatId = options.some(option => option.value === libraryState.fallbackFilterChatId)
            ? libraryState.fallbackFilterChatId
            : '';
    }

    libraryState.filterSelect.html([
        '<option value="">전체 보기</option>',
        ...options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`),
    ].join(''));
    libraryState.filterSelect.val(libraryState.filterChatId);
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatSavedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleDateString(DATE_LOCALE, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).replace(/\.$/, '');
}

function getExportPayload() {
    return {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        savedQuotes: getSavedQuotes(),
    };
}

function downloadJsonFile(fileName, data) {
    const blob = new Blob([JSON.stringify(data, null, JSON_INDENT)], { type: 'application/json' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
}

function readJsonFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                resolve(JSON.parse(String(reader.result || FILE_READER_EMPTY_JSON)));
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

function getImportedQuotes(payload) {
    const rawQuotes = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.savedQuotes)
            ? payload.savedQuotes
            : [];

    return rawQuotes
        .map(quote => normalizeQuoteRecord(quote))
        .filter(quote => quote.text);
}

function exportSavedQuotes() {
    downloadJsonFile(SAVED_QUOTES_FILE_NAME, getExportPayload());
}

async function importSavedQuotes(file) {
    if (!file) {
        return;
    }

    try {
        const importedQuotes = getImportedQuotes(await readJsonFile(file));
        if (!importedQuotes.length) {
            toastr.warning('불러올 문장이 없어요.');
            return;
        }

        const merged = new Map(getSavedQuotes().map(quote => [String(quote.id), quote]));
        for (const quote of importedQuotes) {
            merged.set(String(quote.id), quote);
        }

        persistSavedQuotes(Array.from(merged.values())
            .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()));
        libraryState.currentPage = 1;
        renderLibraryList();
        toastr.success('문장 목록을 불러왔어요.');
    } catch (error) {
        console.error('Share Your Quotes: failed to import quote JSON', error);
        toastr.error('JSON 파일을 불러오지 못했어요.');
    }
}

function getCurrentSourceValues() {
    const context = getContextSafe();
    const currentGroup = context?.groups?.find?.(group => String(group.id) === String(context?.groupId));
    const currentCharacter = context?.characters?.[context?.characterId];
    const chatName = (
        context?.chatId ||
        context?.chat_id ||
        currentGroup?.chat_id ||
        currentGroup?.name ||
        currentCharacter?.chat ||
        currentCharacter?.name ||
        context?.name2 ||
        DEFAULT_CHAT_TITLE
    );
    const personaName = context?.name1 || DEFAULT_PERSONA_NAME;

    return {
        title: String(chatName).replace(/\.jsonl$/i, ''),
        author: String(personaName),
    };
}

function getPopupInput() {
    const settings = getSettings();

    return {
        text: popupState.fields.text.val().toString().trim(),
        title: popupState.fields.title.val().toString().trim(),
        author: popupState.fields.author.val().toString().trim(),
        theme: getActiveValue(popupState.fields.theme, settings.defaultTheme),
        ratio: getActiveValue(popupState.fields.ratio, settings.defaultAspectRatio),
        fontFamily: getActiveValue(popupState.fields.fontFamily, settings.defaultFontFamily),
        fontSize: getActiveValue(popupState.fields.fontSize, settings.defaultFontSize),
        textColor: getActiveValue(popupState.fields.textColor, settings.defaultTextColor),
        textAlign: getActiveValue(popupState.fields.textAlign, settings.defaultTextAlign),
        darken: popupState.fields.darken.prop('checked'),
        lighten: popupState.fields.lighten.prop('checked'),
        chatId: popupState.sourceChatId || CUSTOM_CHAT_ID,
        chatName: popupState.sourceChatName || '',
        customBackgroundUrl: popupState.customBackgroundUrl,
        customBackgroundImage: popupState.customBackgroundImage,
    };
}

function persistCurrentSettings(input) {
    const settings = getSettings();
    settings.defaultTheme = input.theme;
    settings.defaultAspectRatio = input.ratio;
    settings.defaultFontFamily = input.fontFamily;
    settings.defaultFontSize = input.fontSize;
    settings.defaultTextColor = input.textColor;
    settings.defaultTextAlign = input.textAlign;
    settings.defaultDarken = input.darken;
    settings.defaultLighten = input.lighten;
    saveSettings();
}

function getDimensionsFromRatio(ratio, width = IMAGE_WIDTH) {
    switch (ratio) {
        case '2:3':
            return { width, height: Math.round(width * 1.5) };
        case '3:4':
            return { width, height: Math.round(width * 4 / 3) };
        case '1:1':
        default:
            return { width, height: width };
    }
}

function getTextMetrics(fontSize) {
    return TEXT_METRICS[fontSize] || TEXT_METRICS.normal;
}

function measureWrappedLines(ctx, text, maxWidth) {
    const cleanText = String(text || '').replace(/\r\n/g, '\n').trim();
    const paragraphs = cleanText.split('\n');
    const lines = [];

    for (const paragraph of paragraphs) {
        if (!paragraph.trim()) {
            lines.push('');
            continue;
        }

        let current = '';

        for (const char of Array.from(paragraph.replace(/\s+/g, ' '))) {
            const next = current + char;
            if (!current || ctx.measureText(next).width <= maxWidth) {
                current = next;
                continue;
            }

            lines.push(current.trimEnd());
            current = char === ' ' ? '' : char;
        }

        if (current) {
            lines.push(current.trimEnd());
        }
    }

    return lines;
}

function trimToWidth(ctx, text, maxWidth) {
    const value = String(text || '').trim();
    if (!value) {
        return '';
    }

    if (ctx.measureText(value).width <= maxWidth) {
        return value;
    }

    let trimmed = value;
    while (trimmed.length > 1 && ctx.measureText(`${trimmed}${ELLIPSIS}`).width > maxWidth) {
        trimmed = trimmed.slice(0, -1);
    }

    return `${trimmed}${ELLIPSIS}`;
}

function getAlignedX(width, sidePadding, align) {
    if (align === 'left') {
        return sidePadding;
    }

    if (align === 'right') {
        return width - sidePadding;
    }

    return width / 2;
}

async function ensureFontsLoaded() {
    if (!document.fonts?.load) {
        return;
    }

    fontsLoadedPromise ||= Promise.allSettled(FONT_LOAD_SPECS.map(spec => document.fonts.load(spec)));
    await fontsLoadedPromise;
}

function renderQuoteCard(canvas, input) {
    const preset = BACKGROUND_PRESETS[input.theme] || BACKGROUND_PRESETS.night;
    const fontPreset = FONT_PRESETS[input.fontFamily] || FONT_PRESETS.pretendard;
    const colorPreset = COLOR_PRESETS[input.textColor] || COLOR_PRESETS.white;
    const { width, height } = getDimensionsFromRatio(input.ratio);
    const metrics = getTextMetrics(input.fontSize);
    const ctx = canvas.getContext('2d');
    const sidePadding = Math.round(width * QUOTE_LAYOUT.sidePaddingRatio);
    const topPadding = Math.round(width * QUOTE_LAYOUT.topPaddingRatio);
    const bottomPadding = Math.round(width * QUOTE_LAYOUT.bottomPaddingRatio);
    const contentWidth = width - sidePadding * 2;
    const sourceLineHeight = Math.round(metrics.title * QUOTE_LAYOUT.sourceLineHeightRatio);
    const sourceGap = Math.round(metrics.quote * QUOTE_LAYOUT.sourceGapRatio);
    const sourceMaxTop = height - bottomPadding - sourceLineHeight;
    const quoteBottom = sourceMaxTop - sourceGap;

    canvas.width = width;
    canvas.height = height;

    if (input.theme === CUSTOM_THEME && (input.customBackgroundImage || input.customBackgroundUrl)) {
        drawCustomBackground(ctx, width, height, input.customBackgroundImage, input.customBackgroundUrl);
    } else {
        preset.draw(ctx, width, height, preset);
    }

    if (input.lighten) {
        drawOverlay(ctx, width, height, OVERLAY_COLORS.lighten);
    } else if (input.darken) {
        drawOverlay(ctx, width, height, OVERLAY_COLORS.darken);
    }

    ctx.textBaseline = 'top';
    ctx.fillStyle = colorPreset.fill;
    ctx.font = `${fontPreset.weight || 400} ${metrics.quote}px ${fontPreset.family}`;
    ctx.textAlign = input.textAlign || 'center';

    const lines = measureWrappedLines(ctx, input.text || QUOTE_PLACEHOLDER_TEXT, contentWidth);
    const lineHeightPx = Math.round(metrics.quote * metrics.lineHeight);
    const quoteX = getAlignedX(width, sidePadding, input.textAlign);
    const maxQuoteLines = Math.max(0, Math.floor((quoteBottom - topPadding) / lineHeightPx));
    const visibleLines = lines.slice(0, maxQuoteLines);
    const quoteHeight = visibleLines.length * lineHeightPx;
    const blockHeight = quoteHeight + sourceGap + sourceLineHeight;
    const contentAreaHeight = height - topPadding - bottomPadding;
    const centeredY = topPadding + Math.max(0, Math.floor((contentAreaHeight - blockHeight) / 2));

    let y = blockHeight < contentAreaHeight ? centeredY : topPadding;
    for (const line of visibleLines) {
        if (line) {
            ctx.fillText(line, quoteX, y);
        }

        y += lineHeightPx;
    }

    ctx.fillStyle = colorPreset.fill;
    ctx.globalAlpha = QUOTE_LAYOUT.sourceAlpha;
    ctx.font = `400 ${metrics.title}px "Pretendard", sans-serif`;
    const sourceText = [input.title, input.author].filter(Boolean).join(SOURCE_SEPARATOR);
    const sourceTop = Math.min(y + sourceGap, sourceMaxTop);
    ctx.fillText(trimToWidth(ctx, sourceText, contentWidth), quoteX, sourceTop);
    ctx.globalAlpha = 1;

    ctx.textAlign = 'start';
}

function drawImageBackground(ctx, width, height, preset) {
    const image = getBackgroundAsset(preset.asset);
    if (image.complete && image.naturalWidth && image.naturalHeight) {
        drawCoverImage(ctx, width, height, image);
        return;
    }

    preset.fallback(ctx, width, height);
}

function getBackgroundAsset(fileName) {
    if (backgroundAssetCache.has(fileName)) {
        return backgroundAssetCache.get(fileName);
    }

    const image = new Image();
    image.onload = rerenderPreview;
    image.src = `${BACKGROUND_ASSET_PATH}${fileName}`;
    backgroundAssetCache.set(fileName, image);
    return image;
}

function drawCoverImage(ctx, width, height, image) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const x = (width - drawWidth) / 2;
    const y = (height - drawHeight) / 2;
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

function drawGradientBackground(ctx, width, height, stops) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    for (const [offset, color] of stops) {
        gradient.addColorStop(offset, color);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

function drawNightFallback(ctx, width, height) {
    drawGradientBackground(ctx, width, height, GRADIENT_PRESETS.night);
}

function drawBlackBackground(ctx, width, height) {
    ctx.fillStyle = FALLBACK_BACKGROUND_COLORS.black;
    ctx.fillRect(0, 0, width, height);
}

function drawWhiteBackground(ctx, width, height) {
    ctx.fillStyle = FALLBACK_BACKGROUND_COLORS.white;
    ctx.fillRect(0, 0, width, height);
}

function drawBlueMistFallback(ctx, width, height) {
    drawGradientBackground(ctx, width, height, GRADIENT_PRESETS.blueMist);
}

function drawAquaGlowFallback(ctx, width, height) {
    drawGradientBackground(ctx, width, height, GRADIENT_PRESETS.aquaGlow);
}

function drawSoftPink(ctx, width, height) {
    drawGradientBackground(ctx, width, height, GRADIENT_PRESETS.softPink);
}

function drawVioletRoom(ctx, width, height) {
    drawGradientBackground(ctx, width, height, GRADIENT_PRESETS.violetRoom);
}

function drawCustomBackground(ctx, width, height, image, fallbackUrl) {
    if (!image && fallbackUrl) {
        image = new Image();
        image.src = fallbackUrl;
    }

    if (!image.complete || !image.width || !image.height) {
        ctx.fillStyle = FALLBACK_BACKGROUND_COLORS.custom;
        ctx.fillRect(0, 0, width, height);
        return;
    }

    const scale = Math.max(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const x = (width - drawWidth) / 2;
    const y = (height - drawHeight) / 2;
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

function drawOverlay(ctx, width, height, fill) {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, width, height);
}

function rerenderPreview() {
    if (!popupState.canvas || !popupState.fields) {
        return;
    }

    renderQuoteCard(popupState.canvas, getPopupInput());
}

function setActiveButton($set, value) {
    $set.removeClass(ACTIVE_CLASS);
    $set.filter(`[data-value="${value}"]`).addClass(ACTIVE_CLASS);
}

function getActiveValue($set, fallback) {
    return $set.filter(`.${ACTIVE_CLASS}`).data('value') || fallback;
}

async function readClipboardIntoPopup() {
    try {
        if (!popupState.fields?.text) {
            return;
        }

        const text = await navigator.clipboard.readText();
        if (!text?.trim()) {
            toastr.warning('클립보드가 비어 있어요.');
            return;
        }

        popupState.fields.text.val(text.trim()).trigger('input');
    } catch (error) {
        console.error('Share Your Quotes: failed to read clipboard', error);
        toastr.error('클립보드 접근 권한이 필요해요.');
    }
}

function escapeFileName(value) {
    return String(value || 'quote')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '')
        .replace(/\s+/g, '-')
        .slice(0, DOWNLOAD_NAME_MAX_LENGTH) || 'quote';
}

async function downloadCurrentImage() {
    if (popupState.busy || !popupState.canvas) {
        return;
    }

    popupState.busy = true;
    try {
        const input = getPopupInput();
        if (!input.text) {
            toastr.warning('선택된 문장이 없어요.');
            return;
        }

        persistCurrentSettings(input);
        await ensureFontsLoaded();
        renderQuoteCard(popupState.canvas, input);

        const blob = await new Promise(resolve => popupState.canvas.toBlob(resolve, IMAGE_MIME_TYPE));
        if (!blob) {
            throw new Error('Canvas export failed');
        }

        const anchor = document.createElement('a');
        anchor.href = URL.createObjectURL(blob);
        anchor.download = `${escapeFileName(input.title || input.text.slice(0, DOWNLOAD_TEXT_FALLBACK_LENGTH))}.png`;
        anchor.click();
        URL.revokeObjectURL(anchor.href);
        toastr.success('이미지를 저장했어요.');
    } catch (error) {
        console.error('Share Your Quotes: failed to save image', error);
        toastr.error('이미지 저장에 실패했어요.');
    } finally {
        popupState.busy = false;
    }
}

function saveCurrentQuote() {
    if (!popupState.fields) {
        return;
    }

    const input = getPopupInput();
    const quote = saveQuoteRecord(input);
    if (!quote) {
        return;
    }

    toastr.success('문장을 저장했어요.');
    renderLibraryList();
}

function bindPopupControls($dialog) {
    const settings = getSettings();
    const defaults = getCurrentSourceValues();
    const initial = popupState.initialQuote;
    const defaultLighten = Boolean(settings.defaultLighten);
    const defaultDarken = !defaultLighten && Boolean(settings.defaultDarken);

    popupState.fields = {
        text: $dialog.find('#syq-quote-text'),
        title: $dialog.find('#syq-quote-title'),
        author: $dialog.find('#syq-quote-author'),
        theme: $dialog.find('.syq-bg-thumb[data-group="theme"]'),
        ratio: $dialog.find('.syq-option-chip[data-group="ratio"]'),
        fontFamily: $dialog.find('.syq-pill[data-group="font"]'),
        fontSize: $dialog.find('.syq-pill[data-group="size"]'),
        textAlign: $dialog.find('.syq-pill[data-group="align"]'),
        textColor: $dialog.find('.syq-color-chip'),
        darken: $dialog.find('#syq-darken'),
        darkenButton: $dialog.find('#syq-darken-toggle'),
        lighten: $dialog.find('#syq-lighten'),
        lightenButton: $dialog.find('#syq-lighten-toggle'),
        backgroundInput: $dialog.find('#syq-custom-background-input'),
        customTheme: $dialog.find('.syq-bg-thumb[data-group="theme"][data-value="custom"]'),
    };
    popupState.canvas = $dialog.find('#syq-preview-canvas').get(0);

    popupState.fields.text.val(initial?.text || popupState.selectedText || '');
    popupState.fields.title.val(initial?.title || defaults.title);
    popupState.fields.author.val(initial?.author || defaults.author);
    popupState.fields.darken.prop('checked', defaultDarken);
    popupState.fields.lighten.prop('checked', defaultLighten);
    popupState.customBackgroundUrl = '';
    popupState.customBackgroundImage = null;

    setActiveButton(popupState.fields.theme, settings.defaultTheme);
    setActiveButton(popupState.fields.ratio, settings.defaultAspectRatio);
    setActiveButton(popupState.fields.fontFamily, settings.defaultFontFamily);
    setActiveButton(popupState.fields.fontSize, settings.defaultFontSize);
    setActiveButton(popupState.fields.textAlign, settings.defaultTextAlign);
    setActiveButton(popupState.fields.textColor, settings.defaultTextColor);
    popupState.fields.darkenButton.toggleClass(ACTIVE_CLASS, defaultDarken);
    popupState.fields.lightenButton.toggleClass(ACTIVE_CLASS, defaultLighten);

    $dialog.find('#syq-custom-background-button').on('click', () => {
        popupState.fields.backgroundInput.trigger('click');
    });
    popupState.fields.backgroundInput.on('change', function () {
        const file = this.files?.[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            popupState.customBackgroundUrl = String(reader.result || '');
            const image = new Image();
            image.onload = () => {
                popupState.customBackgroundImage = image;
                popupState.fields.customTheme
                    .css('background-image', `url("${popupState.customBackgroundUrl}")`)
                    .addClass('syq-bg-custom-loaded');
                setActiveButton(popupState.fields.theme, CUSTOM_THEME);
                rerenderPreview();
            };
            image.src = popupState.customBackgroundUrl;
        };
        reader.readAsDataURL(file);
    });
    $dialog.find('#syq-copy-text').on('click', async () => {
        const text = popupState.fields.text.val().toString().trim();
        if (!text) {
            toastr.warning('복사할 문장이 없어요.');
            return;
        }

        await navigator.clipboard.writeText(text);
        toastr.success('문장을 복사했어요.');
    });
    $dialog.find('#syq-close-composer').on('click', closeComposer);
    $dialog.find('#syq-save-quote').on('click', saveCurrentQuote);
    $dialog.find('#syq-download-image').on('click', () => void downloadCurrentImage());
    popupState.fields.darkenButton.on('click', function () {
        const next = !popupState.fields.darken.prop('checked');
        popupState.fields.darken.prop('checked', next);
        $(this).toggleClass(ACTIVE_CLASS, next);
        if (next) {
            popupState.fields.lighten.prop('checked', false);
            popupState.fields.lightenButton.removeClass(ACTIVE_CLASS);
        }
        rerenderPreview();
    });
    popupState.fields.lightenButton.on('click', function () {
        const next = !popupState.fields.lighten.prop('checked');
        popupState.fields.lighten.prop('checked', next);
        $(this).toggleClass(ACTIVE_CLASS, next);
        if (next) {
            popupState.fields.darken.prop('checked', false);
            popupState.fields.darkenButton.removeClass(ACTIVE_CLASS);
        }
        rerenderPreview();
    });

    $dialog.find('.syq-bg-thumb, .syq-option-chip, .syq-pill[data-group], .syq-color-chip').on('click', function () {
        const $button = $(this);
        const group = $button.data('group');
        const value = $button.data('value');

        if (group === 'theme') {
            setActiveButton(popupState.fields.theme, value);
        } else if (group === 'ratio') {
            setActiveButton(popupState.fields.ratio, value);
        } else if (group === 'font') {
            setActiveButton(popupState.fields.fontFamily, value);
        } else if (group === 'size') {
            setActiveButton(popupState.fields.fontSize, value);
        } else if (group === 'align') {
            setActiveButton(popupState.fields.textAlign, value);
        } else if ($button.hasClass('syq-color-chip')) {
            setActiveButton(popupState.fields.textColor, value);
        }

        rerenderPreview();
    });

    $dialog.find('textarea, input[type="text"]').on('input change', rerenderPreview);
    void ensureFontsLoaded().then(() => rerenderPreview());
}

async function openComposer(text = '', quote = null, sourceChat = { id: CUSTOM_CHAT_ID, name: CUSTOM_CHAT_LABEL }) {
    const context = getContextSafe();
    if (!context) {
        return;
    }

    closeComposer();
    popupState.initialQuote = quote ? {
        text: String(quote.text || ''),
        title: String(quote.title || ''),
        author: String(quote.author || ''),
        chatId: String(quote.chatId || CUSTOM_CHAT_ID),
        chatName: String(quote.chatName || ''),
    } : null;
    popupState.sourceChatId = popupState.initialQuote?.chatId || sourceChat?.id || CUSTOM_CHAT_ID;
    popupState.sourceChatName = popupState.initialQuote?.chatName || sourceChat?.name || CUSTOM_CHAT_LABEL;
    popupState.selectedText = popupState.initialQuote?.text || text || popupState.selectedText;
    const modal = createModalFromHtml(await renderTemplate(context, 'popup'));
    popupState.modal = modal;

    const $dialog = $(modal).find('.syq-popup').first();
    bindPopupControls($dialog);
    $(modal).find('.syq-modal-backdrop').on('click', closeComposer);
    $(document).off('keydown.syqmodal').on('keydown.syqmodal', (event) => {
        if (event.key === 'Escape') {
            closeComposer();
        }
    });

    return undefined;
}

function closeComposer() {
    if (popupState.modal) {
        popupState.modal.remove();
        popupState.modal = null;
    }

    popupState.canvas = null;
    popupState.fields = null;
    popupState.customBackgroundUrl = '';
    popupState.customBackgroundImage = null;
    popupState.initialQuote = null;
    popupState.sourceChatId = CUSTOM_CHAT_ID;
    popupState.sourceChatName = CUSTOM_CHAT_LABEL;
    $(document).off('keydown.syqmodal');
}

function getEditorInput() {
    return {
        text: editorState.fields.text.val().toString().trim(),
        title: editorState.fields.title.val().toString().trim(),
        author: editorState.fields.author.val().toString().trim(),
    };
}

function saveEditedQuote() {
    if (!editorState.fields || !editorState.quoteId) {
        return;
    }

    const quote = updateQuoteRecord(editorState.quoteId, getEditorInput());
    if (!quote) {
        return;
    }

    toastr.success('문장을 수정했어요.');
    renderLibraryList();
    closeEditor();
}

function bindEditorControls($dialog, quote) {
    editorState.fields = {
        text: $dialog.find('#syq-edit-quote-text'),
        title: $dialog.find('#syq-edit-quote-title'),
        author: $dialog.find('#syq-edit-quote-author'),
    };

    editorState.fields.text.val(String(quote.text || ''));
    editorState.fields.title.val(String(quote.title || ''));
    editorState.fields.author.val(String(quote.author || ''));

    $dialog.find('#syq-close-editor, #syq-cancel-edit').on('click', closeEditor);
    $dialog.find('#syq-save-edit').on('click', saveEditedQuote);
}

async function openEditor(quoteId) {
    const context = getContextSafe();
    const quote = getQuoteRecord(quoteId);
    if (!context || !quote) {
        toastr.warning('문장을 찾을 수 없어요.');
        renderLibraryList();
        return;
    }

    closeEditor();
    editorState.quoteId = quoteId;
    const modal = createModalFromHtml(await renderTemplate(context, 'editor'), 'syq-editor-modal');
    editorState.modal = modal;

    const $dialog = $(modal).find('.syq-editor-popup').first();
    bindEditorControls($dialog, quote);
    $(modal).find('.syq-modal-backdrop').on('click', closeEditor);
    $(document).off('keydown.syqeditor').on('keydown.syqeditor', (event) => {
        if (event.key === 'Escape') {
            closeEditor();
        }
    });
}

function closeEditor() {
    if (editorState.modal) {
        editorState.modal.remove();
        editorState.modal = null;
    }

    editorState.fields = null;
    editorState.quoteId = '';
    $(document).off('keydown.syqeditor');
}

function renderLibraryList() {
    if (!libraryState.items) {
        return;
    }

    const allQuotes = getSavedQuotes();
    renderLibraryChatFilter(allQuotes);

    const quotes = libraryState.filterChatId
        ? allQuotes.filter(quote => getQuoteChatId(quote) === libraryState.filterChatId)
        : allQuotes;
    const totalPages = Math.max(1, Math.ceil(quotes.length / LIBRARY_PAGE_SIZE));
    libraryState.currentPage = Math.min(Math.max(1, libraryState.currentPage), totalPages);

    if (!allQuotes.length) {
        libraryState.items.html(`
            <div class="syq-library-empty">
                <strong>저장한 문장이 아직 없어요.</strong>
                <span>공유 팝업에서 저장하기를 누르면 여기에 모아둘게요.</span>
            </div>
        `);
        libraryState.pagination?.empty();
        return;
    }

    if (!quotes.length) {
        libraryState.items.html(`
            <div class="syq-library-empty">
                <strong>선택한 채팅에 저장된 문장이 없어요.</strong>
                <span>다른 채팅을 선택해 문장 목록을 확인해보세요.</span>
            </div>
        `);
        libraryState.pagination?.empty();
        return;
    }

    const start = (libraryState.currentPage - 1) * LIBRARY_PAGE_SIZE;
    const pageQuotes = quotes.slice(start, start + LIBRARY_PAGE_SIZE);

    libraryState.items.html(pageQuotes.map(quote => `
        <article class="syq-library-item" data-id="${escapeHtml(quote.id)}">
            <div class="syq-library-actions">
                <div class="syq-library-meta">
                    <span class="syq-library-meta-title">${escapeHtml(quote.title || getQuoteChatLabel(quote) || '제목 없음')}</span>
                    <span class="syq-library-meta-date">| ${escapeHtml(formatSavedAt(quote.savedAt))}</span>
                </div>
                <div class="syq-library-action-buttons">
                    <button type="button" class="syq-library-share" data-id="${escapeHtml(quote.id)}" aria-label="share"><i class="fa-solid fa-image"></i></button>
                    <button type="button" class="syq-library-delete" data-id="${escapeHtml(quote.id)}" aria-label="delete"><i class="fa-solid fa-x"></i></button>
                </div>
            </div>
            <p>${escapeHtml(quote.text)}</p>
        </article>
    `).join(''));

    renderLibraryPagination(totalPages);
}

function renderLibraryPagination(totalPages) {
    if (!libraryState.pagination) {
        return;
    }

    const groupStart = Math.floor((libraryState.currentPage - 1) / LIBRARY_PAGE_GROUP_SIZE) * LIBRARY_PAGE_GROUP_SIZE + 1;
    const groupEnd = Math.min(totalPages, groupStart + LIBRARY_PAGE_GROUP_SIZE - 1);
    const previousPage = Math.max(1, groupStart - LIBRARY_PAGE_GROUP_SIZE);
    const nextPage = Math.min(totalPages, groupStart + LIBRARY_PAGE_GROUP_SIZE);
    const buttons = [];

    buttons.push(`
        <button type="button" class="syq-page-arrow" data-page="${previousPage}" ${groupStart === 1 ? 'disabled' : ''} aria-label="previous pages">&lt;</button>
    `);

    for (let page = groupStart; page <= groupEnd; page += 1) {
        buttons.push(`
            <button type="button" class="syq-page-button ${page === libraryState.currentPage ? ACTIVE_CLASS : ''}" data-page="${page}">${page}</button>
        `);
    }

    buttons.push(`
        <button type="button" class="syq-page-arrow" data-page="${nextPage}" ${groupEnd === totalPages ? 'disabled' : ''} aria-label="next pages">&gt;</button>
    `);

    libraryState.pagination.html(buttons.join(''));
}

function bindLibraryControls($dialog) {
    libraryState.list = $dialog.find('#syq-library-list');
    libraryState.items = $dialog.find('#syq-library-items');
    libraryState.pagination = $dialog.find('#syq-library-pagination');
    libraryState.filterSelect = $dialog.find('#syq-library-chat-filter');
    libraryState.importInput = $dialog.find('#syq-import-quotes-input');
    $dialog.find('#syq-close-library').on('click', closeLibrary);
    $dialog.find('#syq-export-quotes').on('click', exportSavedQuotes);
    $dialog.find('#syq-import-quotes').on('click', () => {
        libraryState.importInput.val('');
        libraryState.importInput.trigger('click');
    });
    libraryState.importInput.on('change', function () {
        void importSavedQuotes(this.files?.[0]);
    });
    libraryState.filterSelect.on('change', function () {
        libraryState.filterChatId = String($(this).val() || '');
        libraryState.currentPage = 1;
        renderLibraryList();
    });
    $dialog.on('click', '.syq-library-delete', function () {
        const id = String($(this).data('id') || '');
        if (!id || !confirm('이 문장을 삭제할까요?')) {
            return;
        }

        deleteQuoteRecord(id);
        renderLibraryList();
        toastr.success('삭제했어요.');
    });
    $dialog.on('click', '.syq-library-share', function () {
        const quote = getQuoteRecord(String($(this).data('id') || ''));
        if (!quote) {
            toastr.warning('문장을 찾을 수 없어요.');
            renderLibraryList();
            return;
        }

        void openComposer('', quote);
    });
    $dialog.on('click', '.syq-library-item', function (event) {
        if ($(event.target).closest('button').length) {
            return;
        }

        void openEditor(String($(this).data('id') || ''));
    });
    $dialog.on('click', '.syq-page-button, .syq-page-arrow', function () {
        if ($(this).prop('disabled')) {
            return;
        }

        libraryState.currentPage = Number($(this).data('page')) || 1;
        renderLibraryList();
    });

    renderLibraryList();
}

async function openLibrary(defaultFilterChatId = '', fallbackFilterChatId = '') {
    const context = getContextSafe();
    if (!context) {
        return;
    }

    closeLibrary();
    libraryState.currentPage = 1;
    libraryState.filterChatId = defaultFilterChatId;
    libraryState.fallbackFilterChatId = fallbackFilterChatId;
    const modal = createModalFromHtml(await renderTemplate(context, 'library'));
    libraryState.modal = modal;

    const $dialog = $(modal).find('.syq-library-popup').first();
    bindLibraryControls($dialog);
    $(modal).find('.syq-modal-backdrop').on('click', closeLibrary);
    $(document).off('keydown.syqlibrary').on('keydown.syqlibrary', (event) => {
        if (event.key === 'Escape') {
            if (popupState.modal || editorState.modal) {
                return;
            }

            closeLibrary();
        }
    });
}

function closeLibrary() {
    closeEditor();
    if (libraryState.modal) {
        libraryState.modal.remove();
        libraryState.modal = null;
    }

    libraryState.list = null;
    libraryState.items = null;
    libraryState.pagination = null;
    libraryState.filterSelect = null;
    libraryState.importInput = null;
    libraryState.fallbackFilterChatId = '';
    $(document).off('keydown.syqlibrary');
}

function ensureSelectionMenu() {
    if (selectionState.menu) {
        return selectionState.menu;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'syq-selection-menu';
    button.textContent = '이미지로 공유';
    button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const text = selectionState.selectedText;
        hideSelectionMenu();
        if (!text) {
            return;
        }

        popupState.selectedText = text;
        await openComposer(text, null, getCurrentChatInfo());
        globalThis.getSelection?.()?.removeAllRanges?.();
    });

    document.body.appendChild(button);
    selectionState.menu = button;
    return button;
}

function hideSelectionMenu(clearTimers = true) {
    if (clearTimers) {
        clearSelectionBubbleTimers();
    }

    selectionState.menu?.classList.remove('is-visible');
}

function clearSelectionBubbleTimers() {
    for (const timer of selectionState.updateTimers) {
        clearTimeout(timer);
    }

    selectionState.updateTimers = [];
}

function findSelectionRect(selection) {
    if (!selection || selection.rangeCount === 0) {
        return null;
    }

    const range = selection.getRangeAt(0);
    const rects = Array.from(range.getClientRects()).filter(rect => rect.width || rect.height);
    return rects[0] || range.getBoundingClientRect();
}

function isSelectionInsideMessage(selection) {
    if (!selection?.anchorNode) {
        return false;
    }

    const node = selection.anchorNode.nodeType === Node.TEXT_NODE
        ? selection.anchorNode.parentElement
        : selection.anchorNode;

    return !!node?.closest?.('.mes');
}

function updateSelectionBubble() {
    const settings = getSettings();
    if (!settings.enableSelectionBubble) {
        hideSelectionMenu();
        return;
    }

    const selection = globalThis.getSelection?.();
    const text = selection?.toString?.().trim() || '';
    if (!text || !isSelectionInsideMessage(selection)) {
        selectionState.selectedText = '';
        hideSelectionMenu(false);
        return;
    }

    const rect = findSelectionRect(selection);
    if (!rect) {
        hideSelectionMenu(false);
        return;
    }

    const menu = ensureSelectionMenu();
    selectionState.selectedText = text;
    menu.style.left = `${window.scrollX + rect.left + rect.width / 2}px`;
    menu.style.top = `${window.scrollY + rect.bottom + SELECTION_MENU_OFFSET_Y}px`;
    menu.classList.add('is-visible');
}

function scheduleSelectionBubbleUpdate(delays = SELECTION_UPDATE_DELAYS.default) {
    clearSelectionBubbleTimers();
    selectionState.updateTimers = delays.map(delay => setTimeout(() => {
        updateSelectionBubble();
    }, delay));
}

function bindSelectionEvents() {
    $(document)
        .off('selectstart.syq')
        .on('selectstart.syq', '.mes', () => {
            hideSelectionMenu();
        });

    $(document)
        .off('mouseup.syq')
        .on('mouseup.syq', () => {
            scheduleSelectionBubbleUpdate(SELECTION_UPDATE_DELAYS.mouseup);
        });

    $(document)
        .off('touchend.syq')
        .on('touchend.syq', () => {
            selectionState.lastTouchAt = Date.now();
            scheduleSelectionBubbleUpdate(SELECTION_UPDATE_DELAYS.touchend);
        });

    $(document)
        .off('selectionchange.syq')
        .on('selectionchange.syq', () => {
            scheduleSelectionBubbleUpdate(SELECTION_UPDATE_DELAYS.selectionchange);
        });

    $(document).off('mousedown.syq').on('mousedown.syq', (event) => {
        if (Date.now() - selectionState.lastTouchAt < TOUCH_MOUSE_SUPPRESSION_MS) {
            return;
        }

        if (!$(event.target).closest('.syq-selection-menu').length) {
            hideSelectionMenu();
        }
    });

    $(window).off('scroll.syq resize.syq').on('scroll.syq resize.syq', hideSelectionMenu);
}

function addWandMenuButton() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu || document.getElementById('syq_wand_button')) {
        return;
    }

    let container = document.getElementById('syq_wand_container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'syq_wand_container';
        container.className = 'extension_container';
        menu.appendChild(container);
    }

    const button = document.createElement('div');
    button.id = 'syq_wand_button';
    button.className = 'list-group-item flex-container flexGap5';
    button.innerHTML = `
        <div class="fa-regular fa-bookmark extensionsMenuExtensionButton"></div>
        <span>문장 공유하기</span>
    `;
    button.addEventListener('click', () => {
        const currentChat = getCurrentChatInfo();
        void openLibrary(currentChat.id, currentChat.fileName);
    });
    container.appendChild(button);
}

function scheduleWandMenuButton() {
    addWandMenuButton();
    WAND_BUTTON_RETRY_DELAYS.forEach(delay => setTimeout(addWandMenuButton, delay));
}

async function renderSettingsPanel() {
    const context = getContextSafe();
    const settings = getSettings();
    const settingsHtml = await renderTemplate(context, 'settings');
    const $root = $(settingsHtml);

    $('#extensions_settings2').append($root);
    $root.find('#syq-enable-selection-bubble').prop('checked', settings.enableSelectionBubble).on('input', function () {
        settings.enableSelectionBubble = !!$(this).prop('checked');
        saveSettings();
        hideSelectionMenu();
    });
    $root.find('#syq-open-empty').on('click', () => void openComposer(''));
    $root.find('#syq-open-from-clipboard').on('click', () => {
        popupState.selectedText = '';
        void openComposer('');
        setTimeout(() => {
            void readClipboardIntoPopup();
        }, CLIPBOARD_READ_DELAY_MS);
    });
    $root.find('#syq-open-library').on('click', () => void openLibrary());
}

export async function onActivate() {
    const context = getContextSafe();
    if (!context) {
        return;
    }

    bindSelectionEvents();
    scheduleWandMenuButton();

    const eventTypes = context.eventTypes || context.event_types;
    if (!eventTypes) {
        return;
    }

    context.eventSource?.on?.(eventTypes.APP_INITIALIZED, () => {
        scheduleWandMenuButton();
        if (!$('#extensions_settings2 .syq-settings').length) {
            void renderSettingsPanel();
        }
    });
}
