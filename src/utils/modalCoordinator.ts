import { useEffect, useRef } from 'react';

const CLOSE_ALL_MODALS_EVENT = 'digital-twin:close-all-modals';
const activeLockedModals = new Set<string>();

export function broadcastCloseAllModals(sourceId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<{ sourceId: string }>(CLOSE_ALL_MODALS_EVENT, {
      detail: { sourceId },
    })
  );
}

export function useModalCloseListener(modalId: string, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ sourceId?: string }>;
      if (customEvent.detail?.sourceId !== modalId) {
        onCloseRef.current();
      }
    };
    window.addEventListener(CLOSE_ALL_MODALS_EVENT, handler);
    return () => window.removeEventListener(CLOSE_ALL_MODALS_EVENT, handler);
  }, [modalId]);
}

export function useModalScrollLock(modalId: string, isOpen: boolean): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (isOpen) {
      activeLockedModals.add(modalId);
      document.body.style.overflow = 'hidden';
    } else {
      activeLockedModals.delete(modalId);
      if (activeLockedModals.size === 0) {
        document.body.style.overflow = '';
      }
    }

    return () => {
      activeLockedModals.delete(modalId);
      if (activeLockedModals.size === 0) {
        document.body.style.overflow = '';
      }
    };
  }, [modalId, isOpen]);
}
