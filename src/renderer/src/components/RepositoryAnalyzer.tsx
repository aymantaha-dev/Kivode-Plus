// src/renderer/src/components/RepositoryAnalyzer.tsx

import { useState, useEffect } from 'react';
import { FileCode, GitBranch, HardDrive, Cpu, Loader2, CheckCircle2 } from 'lucide-react';

interface AnalysisData {
  totalFiles: number;
  languages: Record<string, number>;
  sizeInMB: number;
  defaultBranch: string;
  branchesCount: number;
  projectType: string;
  architecture: string;
}

export function RepositoryAnalyzer({ owner, repo }: { owner: string; repo: string }) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const runAnalysis = async () => {
      setIsLoading(true);
      setLoadError(null);
      setAnalysis(null);

      try {
        const data = await window.electronAPI.github.analyzeRepository(owner, repo);
        if (!mounted) return;
        setAnalysis(data);
      } catch (error: any) {
        if (!mounted) return;
        console.error('Failed to analyze:', error);
        setLoadError(error?.message || 'Failed to analyze repository');
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    runAnalysis();

    return () => {
      mounted = false;
    };
  }, [owner, repo]);

  const getLanguageColor = (lang: string) => {
    const colors: Record<string, string> = {
      TypeScript: 'bg-blue-500',
      JavaScript: 'bg-yellow-400',
      Python: 'bg-blue-600',
      Java: 'bg-orange-600',
      Go: 'bg-cyan-500',
      Rust: 'bg-orange-500',
      'C++': 'bg-pink-600',
      'C#': 'bg-green-600',
      PHP: 'bg-indigo-500',
      Ruby: 'bg-red-600',
      HTML: 'bg-orange-500',
      CSS: 'bg-blue-400',
    };
    return colors[lang] || 'bg-gray-400';
  };

  const calculatePercentage = (bytes: number) => {
    if (!analysis) return 0;
    const total = Object.values(analysis.languages).reduce((a, b) => a + b, 0);
    return total > 0 ? Math.round((bytes / total) * 100) : 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Repository analytics is temporarily unavailable.
      </div>
    );
  }

  if (!analysis) return null;

  const sortedLanguages = Object.entries(analysis.languages).sort(([, a], [, b]) => b - a).slice(0, 6);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: FileCode, color: 'blue', label: 'Files', value: analysis.totalFiles.toLocaleString() },
          { icon: HardDrive, color: 'purple', label: 'Size', value: `${analysis.sizeInMB} MB` },
          { icon: GitBranch, color: 'emerald', label: 'Branches', value: analysis.branchesCount },
          { icon: Cpu, color: 'amber', label: 'Type', value: analysis.projectType },
        ].map((stat, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-${stat.color}-500/10 flex items-center justify-center`}>
              <stat.icon className={`w-5 h-5 text-${stat.color}-500`} />
            </div>
            <div>
              <div className="text-xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground uppercase">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Languages */}
      {sortedLanguages.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <h3 className="font-semibold">Languages</h3>
          </div>
          <div className="p-4 space-y-3">
            {sortedLanguages.map(([lang, bytes]) => {
              const pct = calculatePercentage(bytes);
              return (
                <div key={lang}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${getLanguageColor(lang)}`} />
                      {lang}
                    </span>
                    <span className="text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`${getLanguageColor(lang)} h-full rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
        <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-blue-400 mb-1">Safe Editing Ready</p>
          <p className="text-muted-foreground">
            Default branch: <code className="px-2 py-0.5 rounded bg-blue-500/10 font-mono text-xs">{analysis.defaultBranch}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
