import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@renderer/components/ui/button';
import { CheckCircle2, ArrowRight, ArrowLeft, X, Sparkles, Github, Eye, Settings, PanelLeft, PanelRight } from 'lucide-react';

interface OnboardingGuideProps {
  open: boolean;
  onClose: () => void;
  onStepAction?: (action: 'open-settings' | 'open-editor' | 'open-preview' | 'open-github' | 'open-ai' | 'open-tree') => void;
}

const steps = [
  {
    title: 'Welcome to Kivode+',
    description: 'A clean and guided start so you can begin coding right away.',
    icon: Sparkles,
    action: { label: 'Open editor', value: 'open-editor' as const, hint: 'Start from the editor workspace.' },
  },
  {
    title: 'Open your project tree',
    description: 'Use the left panel to browse files quickly. You can resize it any time.',
    icon: PanelLeft,
    action: { label: 'Show file tree', value: 'open-tree' as const, hint: 'The tree panel can now be resized by drag.' },
  },
  {
    title: 'Connect GitHub',
    description: 'Import a repository in one click and continue directly in the same workspace.',
    icon: Github,
    action: { label: 'Import from GitHub', value: 'open-github' as const, hint: 'Clone then auto-open project files.' },
  },
  {
    title: 'Preview & inspect output',
    description: 'Switch to Preview mode from the bottom dock to validate UI and runtime behavior.',
    icon: Eye,
    action: { label: 'Go to preview', value: 'open-preview' as const, hint: 'Quickly move between Editor/Preview/Diff/Metrics.' },
  },
  {
    title: 'Use AI Assistant panel',
    description: 'Open the AI panel on the right and resize it based on the task complexity.',
    icon: PanelRight,
    action: { label: 'Open AI panel', value: 'open-ai' as const, hint: 'Great for generation, refactors, and reviews.' },
  },
  {
    title: 'Tune settings once',
    description: 'Configure API keys and preferences, then you are ready for your full workflow.',
    icon: Settings,
    action: { label: 'Open settings', value: 'open-settings' as const, hint: 'You can return to this guide anytime from settings.' },
  },
];

export function OnboardingGuide({ open, onClose, onStepAction }: OnboardingGuideProps) {
  const [step, setStep] = useState(0);

  const active = steps[step];
  const Icon = active.icon;
  const isLast = step === steps.length - 1;
  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-6xl gap-4 p-6">
        <aside className="w-80 rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Guided setup</p>
              <h2 className="mt-1 text-lg font-semibold">Get started fast</h2>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>

          <div className="space-y-2">
            {steps.map((item, index) => {
              const ItemIcon = item.icon;
              const isActive = index === step;
              const done = index < step;

              return (
                <button
                  key={item.title}
                  onClick={() => setStep(index)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                    isActive ? 'border-primary/40 bg-primary/10' : 'border-transparent hover:border-border hover:bg-muted/40'
                  }`}
                >
                  <div className={`rounded-lg p-1.5 ${done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <ItemIcon className="h-4 w-4" />}
                  </div>
                  <span className="text-sm font-medium">{item.title}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="flex-1 rounded-2xl border border-border/70 bg-card/70 p-8 shadow-sm">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="flex h-full flex-col">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <Icon className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Step {step + 1} of {steps.length}</p>
                  <h3 className="text-3xl font-bold">{active.title}</h3>
                </div>
              </div>

              <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">{active.description}</p>

              <div className="mt-6 rounded-2xl border border-border/70 bg-background/60 p-4">
                <p className="text-sm text-muted-foreground">{active.action.hint}</p>
                <Button className="mt-4 rounded-full" onClick={() => onStepAction?.(active.action.value)}>
                  {active.action.label}
                </Button>
              </div>

              <div className="mt-auto flex items-center justify-between pt-8">
                <Button variant="outline" className="rounded-full" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                  <ArrowLeft className="mr-1 h-4 w-4" /> Previous
                </Button>

                {isLast ? (
                  <Button className="rounded-full" onClick={onClose}>
                    <CheckCircle2 className="mr-1 h-4 w-4" /> Finish setup
                  </Button>
                ) : (
                  <Button className="rounded-full" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
                    Next <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
