export const MODULE_NAME = 'share-your-quotes';
export const EXTENSION_TEMPLATE_PATH = `third-party/${MODULE_NAME}`;
export const BACKGROUND_ASSET_PATH = `/scripts/extensions/${EXTENSION_TEMPLATE_PATH}/assets/`;
export const FILE_UPLOAD_ENDPOINT = '/api/files/upload';
export const SAVED_QUOTES_FILE_NAME = `${MODULE_NAME}.json`;
export const MSG_ID_FIELD = 'msg_id';
export const MSG_ID_BACKFILLED_FLAG = 'msg_id_backfilled';

export const CUSTOM_CHAT_ID = 'custom';
export const CUSTOM_CHAT_LABEL = '직접 입력';
export const CUSTOM_THEME = 'custom';
export const DEFAULT_CHAT_TITLE = 'Chat';
export const DEFAULT_PERSONA_NAME = 'User';
export const DATE_LOCALE = 'ko-KR';
export const SOURCE_SEPARATOR = ' | ';
export const ELLIPSIS = '...';
export const QUOTE_PLACEHOLDER_TEXT = '문장을 선택해서 이미지를 만들어보세요.';
export const FILE_READER_EMPTY_JSON = '{}';
export const EMPTY_OPTION_HTML = '<option value="">전체 보기</option>';
export const ACTIVE_CLASS = 'is-active';

export const LIBRARY_TABS = Object.freeze({
    quotes: 'quotes',
    bookmarks: 'bookmarks',
});

export const FONT_FAMILIES = Object.freeze({
    pretendard: '"Pretendard", sans-serif',
    wonbatang: '"WonBatang", serif',
    nanum: '"Nanum Myeongjo", serif',
    nexon: '"NEXON Lv2 Gothic", sans-serif',
});

export const FONT_LOAD_SPECS = Object.freeze([
    '400 16px "Pretendard"',
    '700 16px "Pretendard"',
    '400 16px "WonBatang"',
    '400 16px "Nanum Myeongjo"',
    '700 16px "Nanum Myeongjo"',
    '300 16px "NEXON Lv2 Gothic"',
    '400 16px "NEXON Lv2 Gothic"',
]);

export const BACKGROUND_PRESET_KEYS = Object.freeze({
    night: 'night',
    black: 'black',
    white: 'white',
    blueMist: 'blue-mist',
    aquaGlow: 'aqua-glow',
    softPink: 'soft-pink',
    violetRoom: 'violet-room',
});

export const BACKGROUND_ASSETS = Object.freeze({
    night: 'night.svg',
    blueMist: 'blue-mist.svg',
    aquaGlow: 'aqua-glow.svg',
});
