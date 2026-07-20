/**
 * src/content/engine/ScriptSandbox.ts
 *
 * Runs a "Bloco de Script/Fórmula" block's user-authored JS by delegating
 * to sandbox.html — a dedicated extension page (see src/sandbox/index.ts)
 * loaded in a hidden, detached iframe. That page is the only place in the
 * extension whose CSP allows eval (see wxt.config.ts), and it's its own
 * chrome-extension:// document — entirely separate from whatever page
 * this content script is running on — so the user's script can compute a
 * value from `ctx` (see ScriptContext below) but can never see or modify
 * the actual page's DOM, cookies, or storage, and this module never
 * imports/uses any browser.* extension API from inside that page either.
 *
 * Also used directly by the dashboard's editor (its own "Testar" button
 * on a Script block) — works identically there since a dashboard page is
 * itself just another `document`/`window`, with the exact same isolation
 * benefit: even the person editing the flow shouldn't have a script
 * (e.g. one they didn't write themselves, from an imported/shared flow)
 * silently touching anything beyond `ctx` just because they clicked
 * "Testar".
 *
 * Never throws: any failure (script error, timeout, the sandbox page
 * failing to load) resolves to `{ ok: false, error }` so a broken script
 * degrades to a clear error message in place of the expanded text,
 * instead of breaking the whole expansion.
 */
import { browser } from 'wxt/browser';

/** What a script can read. Kept to plain, structured-clone-safe data —
 * see shared/utils/dom.ts for getFieldTypeCategory/getFieldContent, which
 * is what fieldType/fieldContent are actually built from. */
export interface ScriptContext {
  /** Global Variables ({{KEY}}) as a plain key→value map, so a script can
   * read the same values a flow's own {{KEY}} tokens would resolve to. */
  variables: Record<string, string>;
  /** The page's hostname the shortcut is being expanded on. */
  hostname: string;
  /** Current date/time as an ISO string — `new Date(ctx.now)` to work with it. */
  now: string;
  /** The focused field's category (email/password/textarea/...). */
  fieldType: string;
  /** Whatever's already typed in the focused field. */
  fieldContent: string;
}

export type ScriptResult = { ok: true; value: string } | { ok: false; error: string };

const SCRIPT_TIMEOUT_MS = 2000;

let sandboxIframe: HTMLIFrameElement | null = null;
let sandboxReadyPromise: Promise<HTMLIFrameElement> | null = null;

function getSandboxIframe(): Promise<HTMLIFrameElement> {
  if (sandboxReadyPromise) return sandboxReadyPromise;

  sandboxReadyPromise = new Promise((resolve, reject) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.addEventListener('load', () => resolve(iframe), { once: true });
      iframe.addEventListener('error', () => reject(new Error('sandbox.html failed to load')), { once: true });
      iframe.src = browser.runtime.getURL('/sandbox.html');
      (document.documentElement || document.body).appendChild(iframe);
      sandboxIframe = iframe;
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });

  return sandboxReadyPromise;
}

/**
 * Runs `code` (a function body — write `return ...;`, not a full function
 * declaration) against `ctx`.
 */
export async function runScript(code: string, ctx: ScriptContext): Promise<ScriptResult> {
  let iframe: HTMLIFrameElement;
  try {
    iframe = await getSandboxIframe();
  } catch (err) {
    // Extremely unlikely (it's our own bundled page), but a page's CSP
    // could in principle block frame-src, or the extension context could
    // be mid-reload — fail closed with a clear message either way.
    sandboxReadyPromise = null; // let the next call retry from scratch
    return { ok: false, error: `Could not start the script sandbox: ${err instanceof Error ? err.message : String(err)}` };
  }

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise<ScriptResult>((resolve) => {
    let settled = false;
    const finish = (result: ScriptResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      // Only trust replies that actually came from our own sandbox iframe
      // — anything else could be the host page trying to spoof a result.
      if (event.source !== iframe.contentWindow) return;
      const data = event.data;
      if (!data || data.requestId !== requestId) return;
      finish(data.ok ? { ok: true, value: data.value } : { ok: false, error: data.error });
    };
    window.addEventListener('message', onMessage);

    const timer = setTimeout(() => finish({ ok: false, error: 'Script timed out' }), SCRIPT_TIMEOUT_MS);

    iframe.contentWindow?.postMessage({ requestId, code, ctx }, '*');
  });
}
