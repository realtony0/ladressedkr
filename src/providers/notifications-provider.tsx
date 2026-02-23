"use client";

import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/helpers/cn";
import { playNotificationTone } from "@/lib/helpers/sound";

type NotificationType = "success" | "error" | "warning" | "info";

interface NotificationInput {
  title: string;
  message?: string;
  type?: NotificationType;
  durationMs?: number;
  sound?: boolean;
}

interface NotificationToast extends Required<Pick<NotificationInput, "title">> {
  id: string;
  title: string;
  message: string | null;
  type: NotificationType;
  durationMs: number;
}

interface NotificationsContextValue {
  notify: (input: NotificationInput) => void;
  notifySuccess: (title: string, message?: string) => void;
  notifyError: (title: string, message?: string) => void;
  notifyWarning: (title: string, message?: string) => void;
  notifyInfo: (title: string, message?: string) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

const MAX_TOASTS = 5;
const DEFAULT_DURATION_MS = 3200;

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

function makeId() {
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ToastIcon({ type }: { type: NotificationType }) {
  if (type === "success") {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-[#245f30]" aria-hidden="true" />;
  }
  if (type === "warning") {
    return <AlertTriangle className="h-4 w-4 shrink-0 text-[#8b5a12]" aria-hidden="true" />;
  }
  if (type === "error") {
    return <XCircle className="h-4 w-4 shrink-0 text-[#8b2424]" aria-hidden="true" />;
  }
  return <Info className="h-4 w-4 shrink-0 text-[var(--color-dark-green)]" aria-hidden="true" />;
}

function toastStyles(type: NotificationType) {
  if (type === "success") {
    return "border-[#7A9E7E] bg-[#eef7ef]";
  }
  if (type === "warning") {
    return "border-[#d6b566] bg-[#fff9ea]";
  }
  if (type === "error") {
    return "border-[#d8a9a9] bg-[#fff4f4]";
  }
  return "border-[var(--color-light-gray)] bg-white";
}

function toneByType(type: NotificationType) {
  if (type === "error") {
    return "error" as const;
  }
  if (type === "success") {
    return "success" as const;
  }
  return "default" as const;
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timeout = timersRef.current.get(id);
    if (timeout) {
      window.clearTimeout(timeout);
      timersRef.current.delete(id);
    }
  }, []);

  const clear = useCallback(() => {
    timersRef.current.forEach((timeout) => window.clearTimeout(timeout));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const notify = useCallback(
    (input: NotificationInput) => {
      const id = makeId();
      const type = input.type ?? "info";
      const durationMs = input.durationMs ?? DEFAULT_DURATION_MS;
      const toast: NotificationToast = {
        id,
        title: input.title,
        message: input.message?.trim() || null,
        type,
        durationMs,
      };

      setToasts((current) => [toast, ...current].slice(0, MAX_TOASTS));

      const timeout = window.setTimeout(() => {
        dismiss(id);
      }, durationMs);
      timersRef.current.set(id, timeout);

      if (input.sound) {
        playNotificationTone(toneByType(type));
      }
    },
    [dismiss],
  );

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notify,
      notifySuccess: (title, message) => notify({ title, message, type: "success" }),
      notifyError: (title, message) => notify({ title, message, type: "error" }),
      notifyWarning: (title, message) => notify({ title, message, type: "warning" }),
      notifyInfo: (title, message) => notify({ title, message, type: "info" }),
      dismiss,
      clear,
    }),
    [dismiss, notify, clear],
  );

  useEffect(
    () => () => {
      timersRef.current.forEach((timeout) => window.clearTimeout(timeout));
      timersRef.current.clear();
    },
    [],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 top-[4.25rem] z-[70] flex flex-col gap-2 md:inset-x-auto md:right-6 md:top-6 md:w-[26rem]">
        {toasts.map((toast) => (
          <section
            key={toast.id}
            className={cn(
              "pointer-events-auto animate-rise-in rounded-xl border p-3 shadow-lg backdrop-blur",
              toastStyles(toast.type),
            )}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-2">
              <ToastIcon type={toast.type} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-dark-green)]">{toast.title}</p>
                {toast.message ? (
                  <p className="mt-0.5 text-xs text-[var(--color-black)]/70">{toast.message}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-black)]/55 transition-colors hover:bg-black/5 hover:text-[var(--color-black)]"
                onClick={() => dismiss(toast.id)}
                aria-label="Fermer la notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </section>
        ))}
      </div>
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used inside NotificationsProvider");
  }

  return context;
}
