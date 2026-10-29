// 사용자 설정: 기본값, 범위 보정, fetchPages 옵션으로 변환, chrome.storage.local 입출력.
// 설정은 이 브라우저에만 저장한다(sync를 쓰지 않아 외부 서버로 나가지 않는다).
export const PRESETS = {
  slow: { concurrency: 1, intervalMs: 800 },
  normal: { concurrency: 2, intervalMs: 400 },
  fast: { concurrency: 3, intervalMs: 250 },
};

const COMMON = { maxRetries: 3, maxConsecutiveFailures: 3 };

// 직접 설정할 수 있는 범위. 서버에 부담을 주지 않도록 동시 요청 수에 낮은 상한을 둔다.
export const LIMITS = {
  concurrency: [1, 4],
  intervalMs: [100, 5000],
  maxRetries: [0, 6],
  maxConsecutiveFailures: [1, 10],
};

export const DEFAULT_SETTINGS = {
  speed: 'normal',
  custom: { ...PRESETS.normal, ...COMMON },
  launcher: { enabled: true, position: 'right' },
};

const SPEEDS = ['slow', 'normal', 'fast', 'custom'];

function clampInt(value, [min, max], fallback) {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

const obj = v => (v && typeof v === 'object' ? v : {});

// 저장돼 있던 값이 깨졌거나 범위를 벗어나도 항상 유효한 설정을 돌려준다.
export function normalizeSettings(raw) {
  const r = obj(raw), c = obj(r.custom), l = obj(r.launcher);
  return {
    speed: SPEEDS.includes(r.speed) ? r.speed : DEFAULT_SETTINGS.speed,
    custom: Object.fromEntries(Object.keys(LIMITS).map(k => [k, clampInt(c[k], LIMITS[k], DEFAULT_SETTINGS.custom[k])])),
    launcher: { enabled: l.enabled !== false, position: l.position === 'left' ? 'left' : 'right' },
  };
}

// fetchPages에 넘길 옵션: 선택한 프리셋 또는 직접 설정한 값.
export function toFetchOptions(settings) {
  const s = normalizeSettings(settings);
  return s.speed === 'custom' ? { ...s.custom } : { ...PRESETS[s.speed], ...COMMON };
}

// 기본값보다 빠르면 서버 부담 안내를 보여 준다.
export function isGentle(fetchOptions) {
  return fetchOptions.concurrency <= PRESETS.normal.concurrency && fetchOptions.intervalMs >= PRESETS.normal.intervalMs;
}

export async function loadSettings(storage = globalThis.chrome?.storage?.local) {
  try {
    const { settings } = await storage.get('settings');
    return normalizeSettings(settings);
  } catch {
    return normalizeSettings();
  }
}

export async function saveSettings(settings, storage = globalThis.chrome?.storage?.local) {
  const normalized = normalizeSettings(settings);
  await storage.set({ settings: normalized });
  return normalized;
}
