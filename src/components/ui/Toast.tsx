'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'framer-motion';

interface ToastItem {
  id: number;
  message: string;
}

interface ToastContextValue {
  push: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ push: () => {} });

export const useToast = () => useContext(ToastContext);

const VISIBLE_MS = 4500;
let nextId = 0;

/** Konuşma balonu şeklinde bildirimler. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string) => {
    const id = nextId++;
    setItems((current) => [...current, { id, message }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), VISIBLE_MS);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 right-4 z-[70] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:right-6"
      >
        <AnimatePresence>
          {items.map((item) => (
            <m.div
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="max-w-xs rounded-xl bg-fg px-4 py-3 text-sm font-semibold text-bg shadow-cel-lg"
            >
              {item.message}
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
