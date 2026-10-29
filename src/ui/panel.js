// 진행률 패널. 페이지 위에 Shadow DOM으로 띄워 뷰어의 스타일과 섞이지 않게 한다.
const ID = 'chaekon-panel';

const HTML = `
  <style>
    * { box-sizing: border-box; font-family: -apple-system, "Segoe UI", "Malgun Gothic", sans-serif; }
    .card { width: 320px; background: #fff; color: #1f2937; border: 1px solid #d1d5db; border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,.18); padding: 14px 16px; font-size: 13px; }
    .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .head b { font-size: 14px; }
    .tools { display: flex; align-items: center; gap: 6px; }
    .x { border: 0; background: none; font-size: 18px; line-height: 1; cursor: pointer; color: #6b7280; padding: 2px; display: flex; }
    .x:hover { color: #1f2937; }
    .x svg { width: 16px; height: 16px; display: block; }
    .title { color: #4b5563; margin-bottom: 10px; word-break: break-all; }
    .bar { height: 10px; background: #e5e7eb; border-radius: 999px; overflow: hidden; }
    .fill { height: 100%; width: 0; background: #2563eb; transition: width .15s; }
    .fill.done { background: #16a34a; }
    .fill.err { background: #dc2626; }
    .stat { display: flex; justify-content: space-between; margin: 8px 0 2px; font-variant-numeric: tabular-nums; }
    .msg { color: #6b7280; min-height: 18px; margin-bottom: 10px; }
    .msg.err { color: #dc2626; }
    .row { display: flex; gap: 8px; }
    button.b { flex: 1; padding: 9px 0; border-radius: 8px; border: 1px solid #d1d5db; background: #f9fafb;
               cursor: pointer; font-size: 13px; }
    button.b.p { background: #2563eb; border-color: #2563eb; color: #fff; }
    button.b.g { background: #16a34a; border-color: #16a34a; color: #fff; }
    .hide { display: none !important; }
  </style>
  <div class="card">
    <div class="head"><b>ChaekOn</b>
      <span class="tools">
        <button class="x" id="settings" title="설정" aria-label="설정">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="7.5"/>
            <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>
          </svg>
        </button>
        <button class="x" id="close" title="닫기" aria-label="닫기">×</button>
      </span>
    </div>
    <div class="title" id="title"></div>
    <div class="bar"><div class="fill" id="fill"></div></div>
    <div class="stat"><span id="count">0 / 0</span><span id="pct">0%</span></div>
    <div class="msg" id="msg"></div>
    <div class="row">
      <button class="b p hide" id="start">PDF 만들기</button>
      <button class="b hide" id="cancel">취소</button>
      <button class="b g hide" id="save">PDF 저장</button>
    </div>
  </div>`;

// 버튼 동작은 반환된 객체의 onStart, onCancel, onSave, onClose에 연결한다.
export function createPanel(doc) {
  doc.getElementById(ID)?.remove();
  const host = doc.createElement('div');
  host.id = ID;
  host.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = HTML;
  doc.body.appendChild(host);

  const $ = id => root.getElementById(id);
  const show = (id, on) => $(id).classList.toggle('hide', !on);

  const panel = {
    onStart: null, onCancel: null, onSave: null, onClose: null, onSettings: null,
    setTitle: t => { $('title').textContent = t; },
    setMessage: (t, isError = false) => { $('msg').textContent = t; $('msg').classList.toggle('err', isError); },
    setProgress(done, total, kind = '') {
      const p = total ? Math.round(done / total * 100) : 0;
      $('fill').style.width = p + '%';
      $('fill').className = 'fill' + (kind ? ' ' + kind : '');
      $('count').textContent = done + ' / ' + total;
      $('pct').textContent = p + '%';
    },
    // 보이는 버튼을 정한다. startLabel로 "PDF 만들기", "다시 시도", "이어서 받기"를 바꾼다.
    setButtons({ start = false, cancel = false, save = false, startLabel } = {}) {
      show('start', start); show('cancel', cancel); show('save', save);
      if (startLabel) $('start').textContent = startLabel;
    },
    destroy() { host.remove(); },
  };

  $('start').onclick = () => panel.onStart?.();
  $('cancel').onclick = () => panel.onCancel?.();
  $('save').onclick = () => panel.onSave?.();
  $('settings').onclick = () => panel.onSettings?.();
  $('close').onclick = () => { panel.destroy(); panel.onClose?.(); };
  return panel;
}
