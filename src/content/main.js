// 확장 아이콘을 눌렀을 때 loader.js가 불러와 toggle()을 호출한다. 패널이 이미 떠 있으면 닫는다.
import { pickAdapter } from '../adapters/index.js';
import { convertPages } from '../core/convert.js';
import { loadSettings, toFetchOptions } from '../core/settings.js';
import { createPanel } from '../ui/panel.js';
import { pdfFilename } from './filename.js';

const fmtMB = b => (b / 1048576).toFixed(1) + 'MB';
const fmtT = s => (s >= 60 ? Math.floor(s / 60) + '분 ' + Math.round(s % 60) + '초' : Math.round(s) + '초');

let panel = null;

export async function toggle(doc = document) {
  if (panel) { panel.destroy(); panel.onClose?.(); return; }

  const mine = panel = createPanel(doc);
  let ctrl = null, blob = null, closed = false;
  const cache = new Map();   // 취소하거나 실패해도 받은 페이지는 남겨 이어받는다
  mine.onClose = () => { closed = true; ctrl?.abort(); if (panel === mine) panel = null; };

  // 설정 버튼은 뷰어를 찾지 못했거나 불러오기에 실패한 상태에서도 동작해야 하므로 비동기 작업 전에 연결한다.
  // 콘텐츠 스크립트는 설정 페이지를 직접 열 수 없어 background에 부탁한다.
  mine.onSettings = async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'open-options' });
    } catch {
      mine.setMessage('설정을 열지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.', true);
    }
  };
  mine.setMessage('뷰어를 확인하는 중…');

  const adapter = await pickAdapter(doc);
  if (closed) return;
  if (!adapter) { mine.setTitle('지원하지 않는 페이지'); mine.setMessage('이 페이지에서 지원하는 전자책 뷰어를 찾지 못했습니다.', true); return; }

  let urls, title;
  try {
    urls = (await adapter.listPages(doc)).map(p => p.url);
    title = await adapter.title(doc);
  } catch (e) {
    if (!closed) { mine.setTitle('불러오기 실패'); mine.setMessage(e.message, true); }
    return;
  }
  if (closed) return;
  const total = urls.length;
  mine.setTitle(title);
  mine.setProgress(0, total);
  mine.setMessage('총 ' + total + '페이지 · [PDF 만들기]를 누르세요.');
  mine.setButtons({ start: true });

  mine.onCancel = () => ctrl?.abort();

  mine.onStart = async () => {
    blob = null;
    ctrl = new AbortController();
    mine.setButtons({ cancel: true });
    mine.setMessage('이미지 받는 중…');
    const t0 = performance.now(), startDone = cache.size;
    try {
      const speed = toFetchOptions(await loadSettings());   // 시작할 때마다 읽어, 설정을 바꾸면 바로 반영된다
      blob = await convertPages(urls, {
        ...speed,
        cache,
        signal: ctrl.signal,
        onProgress: ({ done, bytes }) => {
          if (closed) return;
          mine.setProgress(done, total);
          const el = (performance.now() - t0) / 1000;
          const eta = done < total && done > startDone ? ' · 남은 시간 약 ' + fmtT(el / (done - startDone) * (total - done)) : '';
          mine.setMessage(done < total ? '받는 중 ' + fmtMB(bytes) + eta : 'PDF 조립 중…');
        },
      });
      if (closed) return;
      mine.setProgress(total, total, 'done');
      mine.setMessage('완료 · ' + total + '페이지 · ' + fmtMB(blob.size) + ' · ' + fmtT((performance.now() - t0) / 1000));
      mine.setButtons({ save: true });
    } catch (e) {
      if (closed) return;
      const cancelled = ctrl.signal.aborted;
      mine.setProgress(cache.size, total, cancelled ? '' : 'err');
      mine.setMessage(cancelled ? '취소했습니다. 받은 ' + cache.size + '장은 보관 중입니다.' : e.message, !cancelled);
      mine.setButtons({ start: true, startLabel: cancelled ? '이어서 받기' : '다시 시도' });
    }
  };

  mine.onSave = () => {
    if (!blob) return;
    const a = doc.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = pdfFilename(title);
    doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    mine.setMessage('저장을 시작했습니다. 다운로드 폴더를 확인하세요.');
  };
}
