import { useAppStore } from '@renderer/stores/useAppStore';
import { cn } from '@renderer/utils/helpers';
import { Button } from '@renderer/components/ui/button';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors = {
  success: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    icon: 'text-emerald-500',
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-600 dark:text-red-400',
    icon: 'text-red-500',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
    icon: 'text-amber-500',
  },
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
    icon: 'text-blue-500',
  },
};

export function ToastContainer() {
  const { toasts, removeToast } = useAppStore();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type];
          const color = colors[toast.type];

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              className={cn(
                'flex items-start gap-4 p-4 rounded-xl border shadow-xl min-w-[320px] max-w-[420px] backdrop-blur-sm',
                color.bg,
                color.border,
                'bg-card/80'
              )}
            >
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", color.bg)}>
                <Icon className={cn("w-4 h-4", color.icon)} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h4 className={cn("font-semibold text-sm", color.text)}>{toast.title}</h4>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {toast.message}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0 -mr-1 -mt-1 hover:bg-background/50 rounded-md"
                onClick={() => removeToast(toast.id)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}