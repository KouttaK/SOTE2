/**
 * src/dashboard/components/Toast.ts
 *
 * Centralized, non-blocking toast notification system for SOTE dashboard.
 * Replaces intrusive native alert() dialogs with elegant dark-mode toasts.
 */

export type ToastType = 'error' | 'success' | 'info' | 'warning';

export function showToast(message: string, type: ToastType = 'error', durationMs = 3500): void {
  // Container or direct body attach
  const toast = document.createElement('div');
  toast.className = `sote-toast sote-toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.textContent = message;

  const bg =
    type === 'error'
      ? '#ef4444'
      : type === 'success'
      ? '#10b981'
      : type === 'warning'
      ? '#f59e0b'
      : '#3b82f6';

  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '10px 20px',
    borderRadius: '8px',
    background: bg,
    color: '#ffffff',
    fontSize: '0.875rem',
    fontWeight: '500',
    fontFamily: 'Inter, sans-serif',
    zIndex: '999999',
    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.4)',
    pointerEvents: 'auto',
    cursor: 'pointer',
    opacity: '0',
    transition: 'opacity 0.2s ease-in-out, transform 0.2s ease-in-out'
  });

  document.body.appendChild(toast);

  let dismissed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    if (timer) clearTimeout(timer);
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(4px)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 200);
  };

  toast.addEventListener('click', dismiss);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  timer = setTimeout(dismiss, durationMs);
}
