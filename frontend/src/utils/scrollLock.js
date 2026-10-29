import { useEffect } from "react";

let lockCount = 0;
let savedScrollY = 0;
let prevPosition = "";
let prevTop = "";
let prevLeft = "";
let prevRight = "";
let prevWidth = "";
let prevBodyOverflow = "";
let prevBodyOverflowY = "";
let prevHtmlOverflow = "";
let prevHtmlOverflowY = "";

function onTouchMove(e) {
  // 1. If touching an overlay/backdrop directly, prevent background drag
  const target = e.target;
  const isBackdrop =
    target.id === "modal" ||
    (target.classList &&
      (target.classList.contains("booking-history-modal-backdrop") ||
        target.classList.contains("booking-recommendation-backdrop") ||
        target.classList.contains("bk-modal-overlay") ||
        target.classList.contains("bk-facility-overlay") ||
        target.classList.contains("bk-img-lightbox-overlay") ||
        target.classList.contains("app-dialog-overlay") ||
        target.classList.contains("modal-backdrop")));

  if (isBackdrop) {
    if (e.cancelable) e.preventDefault();
    return;
  }

  // 2. Find closest modal card
  const modal = target.closest?.(
    ".booking-history-modal, .booking-recommendation-modal, .bk-modal-card, .bk-facility-modal, .bk-img-lightbox-modal, .app-dialog, .modal"
  );

  if (!modal) {
    if (e.cancelable) e.preventDefault();
    return;
  }

  // 3. If modal does not have scrollable content (fits on screen), block drag
  const hasScrollableY = modal.scrollHeight > modal.clientHeight;
  if (!hasScrollableY) {
    if (e.cancelable) e.preventDefault();
  }
}

export function lockScroll() {
  lockCount++;
  if (lockCount === 1) {
    savedScrollY =
      window.scrollY ||
      window.pageYOffset ||
      document.documentElement.scrollTop ||
      0;
    prevPosition = document.body.style.position;
    prevTop = document.body.style.top;
    prevLeft = document.body.style.left;
    prevRight = document.body.style.right;
    prevWidth = document.body.style.width;
    prevBodyOverflow = document.body.style.overflow;
    prevBodyOverflowY = document.body.style.overflowY;
    prevHtmlOverflow = document.documentElement.style.overflow;
    prevHtmlOverflowY = document.documentElement.style.overflowY;

    document.body.style.position = "fixed";
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    document.body.style.overflowY = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overflowY = "hidden";

    document.addEventListener("touchmove", onTouchMove, { passive: false });
  }
}

export function unlockScroll() {
  if (lockCount <= 0) return;
  lockCount--;
  if (lockCount === 0) {
    document.removeEventListener("touchmove", onTouchMove);

    document.body.style.position = prevPosition;
    document.body.style.top = prevTop;
    document.body.style.left = prevLeft;
    document.body.style.right = prevRight;
    document.body.style.width = prevWidth;
    document.body.style.overflow = prevBodyOverflow;
    document.body.style.overflowY = prevBodyOverflowY;
    document.documentElement.style.overflow = prevHtmlOverflow;
    document.documentElement.style.overflowY = prevHtmlOverflowY;

    window.scrollTo(0, savedScrollY);
  }
}

// Global bridges for cross-iframe synchronization (Admin / Approval dashboards)
if (typeof window !== "undefined") {
  window._lockModalScroll = lockScroll;
  window._unlockModalScroll = unlockScroll;
}

export function useLockScroll(locked) {
  useEffect(() => {
    if (locked) {
      lockScroll();
      return () => {
        unlockScroll();
      };
    }
  }, [locked]);
}

