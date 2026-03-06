import { useAppStore } from '@renderer/stores/useAppStore';
import { Button } from '@renderer/components/ui/button';
import { ScrollArea } from '@renderer/components/ui/scroll-area';
import { cn, parseDiff } from '@renderer/utils/helpers';
import {
  Check,
  X,
  FileCode,
  ArrowLeft,
  GitCompare,
  Plus,
  Minus,
  Files,
} from 'lucide-react';
import { motion } from 'framer-motion';

export function DiffViewer() {
  const {
    diffData,
    diffQueue,
    activeDiffFilePath,
    setActiveDiffFilePath,
    applyDiff,
    rejectDiff,
    setCurrentView,
    isGenerating,
  } = useAppStore();

  if (!diffData || diffQueue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 shadow-lg shadow-primary/10">
            <GitCompare className="w-12 h-12 text-primary/60" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No Changes to Review</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
            Use the AI assistant to modify code, and the changes will appear here for review
          </p>
          <Button variant="outline" onClick={() => setCurrentView('editor')} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Editor
          </Button>
        </div>
      </div>
    );
  }

  const diff = parseDiff(diffData.original, diffData.modified);
  const additions = diff.filter(d => d.type === 'add').length;
  const deletions = diff.filter(d => d.type === 'remove').length;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentView('editor')}
            className="hover:bg-primary/10"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <GitCompare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Review Changes</h3>
              <p className="text-xs text-muted-foreground">
                {diffData.filePath.split(/[\\/]/).pop()}
              </p>
            </div>
            {isGenerating && (
              <span className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary animate-pulse">
                AI editing…
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-sm bg-muted/50 rounded-lg px-4 py-2">
            <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold">{additions}</span>
              <span className="text-muted-foreground">additions</span>
            </span>
            <div className="w-px h-4 bg-border" />
            <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <div className="w-6 h-6 rounded-md bg-red-500/10 flex items-center justify-center">
                <Minus className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold">{deletions}</span>
              <span className="text-muted-foreground">deletions</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => rejectDiff(activeDiffFilePath || diffData.filePath)}
              className="gap-2 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30"
            >
              <X className="w-4 h-4" />
              Reject File
            </Button>
            <Button
              variant="default"
              onClick={() => applyDiff(activeDiffFilePath || diffData.filePath)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Check className="w-4 h-4" />
              Apply File
            </Button>
          </div>
        </div>
      </div>

      <div className="border-b border-border/40 bg-card/20 px-4 py-2 flex items-center gap-2 overflow-x-auto">
        <span className="text-xs text-muted-foreground flex items-center gap-1 mr-2 whitespace-nowrap">
          <Files className="w-3 h-3" />
          {diffQueue.length} file(s)
        </span>
        {diffQueue.map((item) => {
          const isActive = (activeDiffFilePath || diffData.filePath) === item.filePath;
          return (
            <Button
              key={item.filePath}
              size="sm"
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn('h-7 rounded-full px-3 text-xs', !isActive && 'text-muted-foreground')}
              onClick={() => setActiveDiffFilePath(item.filePath)}
            >
              {item.filePath.split(/[\\/]/).pop()}
            </Button>
          );
        })}
      </div>

      <ScrollArea className="flex-1 bg-muted/20">
        <div className="font-mono text-sm">
          <div className="flex border-b border-border/50 bg-card/50 sticky top-0 backdrop-blur-sm">
            <div className="w-16 py-3 px-3 text-right text-muted-foreground border-r border-border/50 text-xs font-medium">Old</div>
            <div className="w-16 py-3 px-3 text-right text-muted-foreground border-r border-border/50 text-xs font-medium">New</div>
            <div className="flex-1 py-3 px-4 text-xs font-medium text-muted-foreground">Changes</div>
          </div>

          {diff.map((change, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.01 }}
              className={cn(
                'flex border-b border-border/30 transition-colors',
                change.type === 'add' && 'bg-emerald-500/5 hover:bg-emerald-500/10',
                change.type === 'remove' && 'bg-red-500/5 hover:bg-red-500/10',
                change.type === 'unchanged' && 'hover:bg-muted/30'
              )}
            >
              <div className="w-16 py-2 px-3 text-right text-muted-foreground/50 border-r border-border/50 select-none text-xs">{change.oldLine || ''}</div>
              <div className="w-16 py-2 px-3 text-right text-muted-foreground/50 border-r border-border/50 select-none text-xs">{change.newLine || ''}</div>
              <div className={cn('flex-1 py-2 px-4 whitespace-pre', change.type === 'add' && 'text-emerald-700 dark:text-emerald-300', change.type === 'remove' && 'text-red-700 dark:text-red-300')}>
                <span className={cn('inline-block w-4 font-bold', change.type === 'add' && 'text-emerald-600', change.type === 'remove' && 'text-red-600')}>
                  {change.type === 'add' && '+'}
                  {change.type === 'remove' && '-'}
                  {change.type === 'unchanged' && ' '}
                </span>
                {change.content}
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollArea>

      <div className="flex items-center justify-between px-6 py-3 border-t border-border/50 bg-card/30 backdrop-blur-sm text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <FileCode className="w-3.5 h-3.5" />
          {diff.length} lines changed
        </span>
        <span className="flex items-center gap-2">
          <GitCompare className="w-3.5 h-3.5" />
          Approve/reject each file separately
        </span>
      </div>
    </div>
  );
}
