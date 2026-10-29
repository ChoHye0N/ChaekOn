// 페이지 URL 목록을 천천히 받아온다. 동시성 제한, 요청 간격, 429·403 백오프,
// 연속 실패 시 중단, 취소(AbortSignal), 이어받기(cache)를 지원한다.
const THROTTLE_STATUS = new Set([429, 403]);
const RETRYABLE_STATUS = new Set([408, 425, 500, 502, 503, 504]);

const defaultSleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason);
  const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
  const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
  signal?.addEventListener('abort', onAbort, { once: true });
});

// Retry-After: 초 단위 숫자 또는 HTTP 날짜. 없거나 읽을 수 없으면 null.
function retryAfterMs(res, now) {
  const v = res.headers?.get('retry-after');
  if (!v) return null;
  if (/^\d+$/.test(v.trim())) return Number(v) * 1000;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : Math.max(0, t - now());
}

/**
 * @param {string[]} urls
 * @param {object}   [opts]
 * @param {number}   [opts.concurrency=2]
 * @param {number}   [opts.intervalMs=400]       요청 시작 사이 최소 간격
 * @param {number}   [opts.maxRetries=3]         페이지당 재시도 횟수
 * @param {number}   [opts.backoffMs=1000]       재시도 대기 기준(2배씩 증가)
 * @param {number}   [opts.maxConsecutiveFailures=3]
 * @param {number}   [opts.maxBytes=Infinity]    받은 용량(cache에 있던 것 포함)이 이를 넘으면 중단한다. 큰 책으로 메모리가 부족해지는 것을 막는다.
 * @param {AbortSignal} [opts.signal]
 * @param {Map<number, Uint8Array>} [opts.cache] 이미 받은 페이지(0부터). 같은 cache로 다시 호출하면 이어받는다.
 * @param {(p: {done:number,total:number,bytes:number}) => void} [opts.onProgress]
 * @param {typeof fetch} [opts.fetch]
 * @param {(ms:number, signal?:AbortSignal) => Promise<void>} [opts.sleep] 테스트용
 * @param {() => number} [opts.now] 테스트용
 * @returns {Promise<{results: (Uint8Array|undefined)[], failed: number[], stopped: null|'consecutive-failures'|'too-large'}>}
 *   failed는 1부터 센 페이지 번호. 취소되면 signal.reason으로 reject한다(받은 페이지는 cache에 남는다).
 *   'too-large'로 멈추면 failed는 비어 있고, 아직 받지 않은 페이지는 results에서 undefined다.
 */
export async function fetchPages(urls, opts = {}) {
  const {
    concurrency = 2, intervalMs = 400, maxRetries = 3, backoffMs = 1000,
    maxConsecutiveFailures = 3, maxBytes = Infinity, signal, cache = new Map(), onProgress,
    fetch: doFetch = globalThis.fetch, sleep = defaultSleep, now = Date.now,
  } = opts;
  const total = urls.length;

  let limit = concurrency;       // 429·403이면 줄어든다. 번호가 limit 이상인 워커는 현재 작업 후 빠진다.
  let nextStart = 0, pauseUntil = 0;
  let consecutive = 0, stopped = null;
  let cursor = 0, done = 0, bytes = 0;
  const failed = [];

  for (const u of cache.values()) { done++; bytes += u.length; }
  onProgress?.({ done, total, bytes });

  // 시작 시각을 간격만큼 띄우고, 전역 대기(pauseUntil) 중에는 시작하지 않는다.
  async function gate() {
    for (;;) {
      const t = Math.max(now(), nextStart, pauseUntil);
      if (t <= now()) { nextStart = now() + intervalMs; return; }
      nextStart = t + intervalMs;
      await sleep(t - now(), signal);
      if (pauseUntil <= now()) return;
    }
  }

  async function download(i) {
    for (let a = 0; ; a++) {
      await gate();
      signal?.throwIfAborted();
      let res = null, wait = backoffMs * 2 ** a;
      try {
        res = await doFetch(urls[i], { signal });
      } catch (e) {
        if (signal?.aborted) throw e;
      }
      if (res?.ok) return new Uint8Array(await res.arrayBuffer());
      if (res && THROTTLE_STATUS.has(res.status)) {
        limit = Math.max(1, limit - 1);
        pauseUntil = Math.max(pauseUntil, now() + (retryAfterMs(res, now) ?? wait));
        wait = 0;
      } else if (res && !RETRYABLE_STATUS.has(res.status)) {
        return null;
      }
      if (a >= maxRetries) return null;
      if (wait) await sleep(wait, signal);
    }
  }

  async function worker(id) {
    while (!stopped && id < limit) {
      while (cursor < total && cache.has(cursor)) cursor++;
      if (cursor >= total) return;
      const i = cursor++;
      const data = await download(i);
      if (data) {
        cache.set(i, data);
        consecutive = 0; done++; bytes += data.length;
        onProgress?.({ done, total, bytes });
        if (bytes > maxBytes && done < total) stopped ??= 'too-large';
      } else {
        failed.push(i + 1);
        if (++consecutive >= maxConsecutiveFailures) stopped = 'consecutive-failures';
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, id) => worker(id)));
  failed.sort((a, b) => a - b);
  return { results: urls.map((_, i) => cache.get(i)), failed, stopped };
}
