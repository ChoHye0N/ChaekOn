// 설정 화면. 값을 바꾸면 바로 저장한다(저장 버튼 없음).
import { DEFAULT_SETTINGS, LIMITS, isGentle, loadSettings, saveSettings, toFetchOptions } from '../core/settings.js';

const $ = id => document.getElementById(id);
const radios = name => [...document.querySelectorAll(`input[name="${name}"]`)];
const KEYS = Object.keys(LIMITS);

let settings = await loadSettings();
let flashTimer;

function flash(text = '저장됨') {
  $('status').textContent = text;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { $('status').textContent = ''; }, 1800);
}

function render() {
  radios('speed').forEach(r => { r.checked = r.value === settings.speed; });
  // 입력칸에는 지금 적용되는 값을 보여 준다(프리셋을 골라도 숫자를 확인할 수 있다).
  const effective = toFetchOptions(settings);
  KEYS.forEach(k => { $(k).value = effective[k]; });
  $('advanced').open = $('advanced').open || settings.speed === 'custom';
  $('warn').hidden = isGentle(effective);

  $('launcher-enabled').checked = settings.launcher.enabled;
  radios('position').forEach(r => { r.checked = r.value === settings.launcher.position; r.disabled = !settings.launcher.enabled; });
  $('position').setAttribute('aria-disabled', String(!settings.launcher.enabled));
}

async function commit(next, message) {
  settings = await saveSettings(next);
  render();
  flash(message);
}

$('reset').addEventListener('click', () => commit(DEFAULT_SETTINGS, '기본값으로 되돌렸습니다'));

radios('speed').forEach(r => r.addEventListener('change', () => {
  if (r.checked) commit({ ...settings, speed: r.value });
}));

// 고급 입력을 고치면 "직접 설정"으로 바뀐다.
KEYS.forEach(k => $(k).addEventListener('change', () => {
  const custom = Object.fromEntries(KEYS.map(key => [key, $(key).value]));
  commit({ ...settings, speed: 'custom', custom });
}));

$('launcher-enabled').addEventListener('change', e => {
  commit({ ...settings, launcher: { ...settings.launcher, enabled: e.target.checked } });
});
radios('position').forEach(r => r.addEventListener('change', () => {
  if (r.checked) commit({ ...settings, launcher: { ...settings.launcher, position: r.value } });
}));

render();
