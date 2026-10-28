import { lockScroll, unlockScroll } from "./scrollLock";
const ICONS = {
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></svg>',
  warning: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 4.3 2.8 17.2A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 3h.01"/></svg>',
};
let closeActiveDialog = null;

function createDialog({ title, message, confirmLabel, cancelLabel, destructive = false, onConfirm, onCancel }) {
  closeActiveDialog?.(false);
  lockScroll();
  const previouslyFocused = document.activeElement;

  const overlay = document.createElement("div");
  overlay.className = "app-dialog-overlay";
  overlay.setAttribute("role", "presentation");

  const dialog = document.createElement("section");
  dialog.className = "app-dialog";
  dialog.setAttribute("role", cancelLabel ? "dialog" : "alertdialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "app-dialog-title");

  const head = document.createElement("div");
  head.className = "app-dialog-head";
  const icon = document.createElement("span");
  icon.className = `app-dialog-icon${destructive ? " is-danger" : ""}`;
  icon.innerHTML = destructive ? ICONS.warning : ICONS.info;
  const heading = document.createElement("h2");
  heading.id = "app-dialog-title";
  heading.textContent = title;
  head.append(icon, heading);

  const content = document.createElement("p");
  content.className = "app-dialog-message";
  content.id = "app-dialog-message";
  content.textContent = String(message ?? "");
  dialog.setAttribute("aria-describedby", content.id);

  const actions = document.createElement("div");
  actions.className = "app-dialog-actions";
  const close = (value) => {
    if (!overlay.isConnected) return value;
    unlockScroll();
    overlay.remove();
    if (closeActiveDialog === close) closeActiveDialog = null;
    document.removeEventListener("keydown", onKeyDown);
    if (value) onConfirm?.();
    else onCancel?.();
    if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus();
    return value;
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") close(false);
    if (event.key === "Tab") {
      const focusable = [...dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  if (cancelLabel) {
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "app-dialog-button secondary";
    cancel.textContent = cancelLabel;
    cancel.addEventListener("click", () => close(false));
    actions.append(cancel);
  }

  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = `app-dialog-button${destructive ? " danger" : " primary"}`;
  confirm.textContent = confirmLabel;
  confirm.addEventListener("click", () => close(true));
  actions.append(confirm);

  dialog.append(head, content, actions);
  overlay.append(dialog);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay && cancelLabel) close(false);
  });
  document.addEventListener("keydown", onKeyDown);
  document.body.append(overlay);
  closeActiveDialog = close;
  confirm.focus();
  return { close };
}

export function showAppNotice(message, title = "Informasi") {
  createDialog({ title, message, confirmLabel: "Mengerti" });
}

export function showAppConfirm(message, { title = "Konfirmasi", confirmLabel = "Lanjutkan", destructive = false } = {}) {
  return new Promise((resolve) => {
    createDialog({
      title,
      message,
      confirmLabel,
      cancelLabel: "Batal",
      destructive,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

export function installAppDialogs() {
  window.alert = (message) => showAppNotice(message);
}
