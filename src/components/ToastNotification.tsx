import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, AlertTriangle, AlertOctagon, TrendingUp, Sparkles, Info, CheckCircle2 } from "lucide-react";
import { Toast } from "../types";

interface ToastNotificationProps {
  toasts: Toast[];
  onClose: (id: string) => void;
}

export default function ToastNotification({ toasts, onClose }: ToastNotificationProps) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={onClose} />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ToastItemProps {
  key?: string;
  toast: Toast;
  onClose: (id: string) => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 5500); // automatically dismiss after 5.5 seconds
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  // Styles and icons based on type
  const config = {
    success: {
      bg: "bg-[#e8ece9] border-[#d2ddd6]",
      iconBg: "bg-[#2d5a44]/10",
      iconColor: "text-[#2d5a44]",
      titleColor: "text-[#1e2a22]",
      messageColor: "text-stone-600",
      accent: "bg-[#2d5a44]",
      Icon: Sparkles,
    },
    warning: {
      bg: "bg-amber-50 border-amber-200",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-800",
      titleColor: "text-amber-950",
      messageColor: "text-amber-900/80",
      accent: "bg-amber-600",
      Icon: AlertTriangle,
    },
    error: {
      bg: "bg-[#f9f1ec] border-[#f0ded4]",
      iconBg: "bg-[#b25329]/10",
      iconColor: "text-[#b25329]",
      titleColor: "text-[#b25329]",
      messageColor: "text-[#b25329]/90",
      accent: "bg-[#b25329]",
      Icon: AlertOctagon,
    },
    info: {
      bg: "bg-stone-50 border-stone-200",
      iconBg: "bg-stone-100",
      iconColor: "text-[#2a2924]",
      titleColor: "text-[#111]",
      messageColor: "text-stone-500",
      accent: "bg-stone-600",
      Icon: Info,
    },
  }[toast.type] || {
    bg: "bg-white border-stone-200",
    iconBg: "bg-stone-100",
    iconColor: "text-stone-600",
    titleColor: "text-stone-900",
    messageColor: "text-stone-600",
    accent: "bg-stone-400",
    Icon: Info,
  };

  const { Icon } = config;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: -20, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={`pointer-events-auto relative overflow-hidden border ${config.bg} rounded-2xl shadow-lg p-4 flex gap-3.5 items-start`}
    >
      {/* Accent strip on left side */}
      <div className={`absolute top-0 left-0 w-1 h-full ${config.accent}`} />

      {/* Dynamic graphic icon */}
      <div className={`p-2 rounded-xl shrink-0 ${config.iconBg} ${config.iconColor}`}>
        <Icon className="w-5 h-5" />
      </div>

      {/* Content text */}
      <div className="flex-1 min-w-0 pr-4 mt-0.5">
        <h4 className={`font-serif font-semibold text-sm ${config.titleColor} leading-tight`}>
          {toast.title}
        </h4>
        <p className={`text-xs mt-1 leading-relaxed whitespace-pre-line ${config.messageColor}`}>
          {toast.message}
        </p>
      </div>

      {/* Direct dismiss helper button */}
      <button
        onClick={() => onClose(toast.id)}
        className="shrink-0 p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100/50 transition-colors cursor-pointer"
        aria-label="Tutup notifikasi"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}
