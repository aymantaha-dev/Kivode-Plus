import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, Github, Loader2, GitBranch, Sparkles } from 'lucide-react';
import { cn } from '@renderer/utils/helpers';

interface GitHubCloneDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onClone: (url: string) => Promise<void>;
}

export function GitHubCloneDialog({ isOpen, onClose, onClone }: GitHubCloneDialogProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const githubRegex = /^https:\/\/github\.com\/[\w-]+\/[\w-]+(\.git)?$/;
    if (!githubRegex.test(url)) {
      setError('Please enter a valid GitHub URL (https://github.com/username/repository)');
      return;
    }

    setIsLoading(true);
    try {
      await onClone(url);
      setUrl('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to clone repository');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2 }}
            onKeyDown={handleKeyDown}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none"
          >
            <div 
              className="bg-card/95 border border-border/50 rounded-2xl shadow-2xl p-6 w-full max-w-md pointer-events-auto backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center shadow-lg">
                    <Github className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Clone Repository</h2>
                    <p className="text-sm text-muted-foreground">
                      Import from GitHub
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg hover:bg-primary/10"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Repository URL
                  </label>
                  <div className="relative">
                    <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="https://github.com/username/repository"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      disabled={isLoading}
                      className="h-11 pl-10 rounded-xl border-border/50 focus:border-primary/50"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Example: https://github.com/facebook/react
                  </p>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {error}
                  </motion.div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-11 rounded-xl border-border/50 hover:bg-primary/5"
                    onClick={onClose}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-11 gap-2 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 hover:from-gray-700 hover:to-gray-800 text-white shadow-lg"
                    disabled={isLoading || !url.trim()}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cloning...
                      </>
                    ) : (
                      <>
                        <Github className="h-4 w-4" />
                        Clone
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}