/**
 * src/sandbox/index.ts
 *
 * This page is the ONLY place in the whole extension allowed to eval
 * arbitrary strings — see wxt.config.ts's `content_security_policy`
 * override, which relaxes `script-src` to allow `'unsafe-eval'` for
 * extension pages specifically so a Script/Fórmula block's code can run
 * at all. Nothing else in the extension gets that relaxation.
 *
 * It's loaded in a hidden, detached iframe (see
 * content/engine/ScriptSandbox.ts) from whatever page a shortcut is being
 * expanded on — but being its OWN chrome-extension://.../sandbox.html
 * document means it has no relationship to that page at all: no shared
 * `document`/`window`, so a user's script can never read or write the
 * actual visited page's DOM, cookies, or localStorage. It also never
 * imports or calls any `browser.*`/`chrome.*` extension API, so even
 * though such APIs are technically reachable from any extension page,
 * nothing here exposes them to the script being run. The script's only
 * channel in or out is the postMessage handled below: whatever's in `ctx`
 * comes in, and only a plain string goes back out.
 *
 * The only things this deliberately does NOT protect against (documented
 * rather than silently assumed away): a hostile script could still burn
 * CPU/memory for a while (bounded by the timeout on the caller's side,
 * ScriptSandbox.ts's SCRIPT_TIMEOUT_MS) and could still make network
 * requests via fetch/XHR — this page doesn't strip those the way a Worker
 * sandbox would, because unlike a Worker, `new Function` here needs the
 * page's relaxed CSP to run at all, and stripping globals after the fact
 * is easy to bypass from inside the very code we're trying to contain
 * (e.g. via `constructor.constructor`). Network access from a sandboxed
 * chrome-extension:// origin can't touch the visited page's cookies or
 * same-origin state either way, which is the actual sensitive boundary.
 */

interface SandboxRequest {
  requestId: string;
  code: string;
  ctx: unknown;
}

window.addEventListener('message', (event: MessageEvent) => {
  const data = event.data as SandboxRequest | undefined;
  if (!data || typeof data.requestId !== 'string' || typeof data.code !== 'string') return;

  let response: { requestId: string; ok: boolean; value?: string; error?: string };
  try {
    const fn = new Function('ctx', data.code);
    const result = fn(data.ctx);
    response = {
      requestId: data.requestId,
      ok: true,
      value: result === undefined || result === null ? '' : String(result),
    };
  } catch (err) {
    response = {
      requestId: data.requestId,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // event.source is the actual window that called postMessage on us —
  // not spoofable by any other script — so replying straight to it (with
  // '*' as the target origin, since we don't know or care what the
  // embedding page's origin is) only ever reaches that same caller.
  (event.source as Window | null)?.postMessage(response, '*');
});
