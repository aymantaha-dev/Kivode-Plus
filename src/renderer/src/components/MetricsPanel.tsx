import { useEffect, useState } from 'react';
import { useAppStore } from '@renderer/stores/useAppStore';
import { ScrollArea } from '@renderer/components/ui/scroll-area';
import { Button } from '@renderer/components/ui/button';
import { cn, formatNumber, calculateMetricsSummary, getLanguageColor } from '@renderer/utils/helpers';
import { 
  BarChart3, 
  Files, 
  Code2, 
  Layers,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ArrowLeft,
  PieChart,
  Activity,
  TrendingUp,
  Zap,
  Shield,
  GitBranch,
  Package
} from 'lucide-react';
import { motion } from 'framer-motion';
import { ProjectMetrics, DependencyInfo } from '@renderer/types';

export function MetricsPanel() {
  const { projectPath, setCurrentView, addToast } = useAppStore();
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [dependencies, setDependencies] = useState<DependencyInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadMetrics = async () => {
    if (!projectPath) return;

    setIsLoading(true);
    try {
      const [metricsData, depsData] = await Promise.all([
        window.electronAPI.project.getMetrics(projectPath),
        window.electronAPI.project.getDependencies(projectPath),
      ]);

      setMetrics(metricsData);
      setDependencies(depsData);
    } catch (error: any) {
      console.error('Failed to load metrics:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load project metrics',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [projectPath]);

  if (!projectPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6 shadow-lg shadow-primary/10">
            <BarChart3 className="w-12 h-12 text-primary/60" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No Project Open</h3>
          <p className="text-sm text-muted-foreground">
            Open a project to view metrics
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground mt-4">Analyzing project...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-500/5 flex items-center justify-center mb-6 shadow-lg shadow-red-500/10">
            <AlertCircle className="w-12 h-12 text-red-500/60" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Failed to Load Metrics</h3>
          <Button onClick={loadMetrics} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const summary = calculateMetricsSummary(metrics);
  const topLanguages = Object.entries(metrics.languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const healthColors = {
    good: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-500', icon: CheckCircle },
    fair: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-500', icon: AlertCircle },
    poor: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-500', icon: AlertCircle },
  };

  const health = healthColors[summary.health];

  return (
    <ScrollArea className="h-full bg-background">
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-lg shadow-primary/10">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Project Metrics</h2>
              <p className="text-sm text-muted-foreground">
                Comprehensive analysis of your codebase
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadMetrics} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentView('editor')} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </div>
        </div>

        {/* Health Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'p-6 rounded-2xl border backdrop-blur-sm',
            health.bg, health.border
          )}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center bg-background/50", health.text)}>
                <health.icon className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Code Health Score</h3>
                <p className="text-sm text-muted-foreground">
                  {summary.health === 'good' ? 'Your code looks great!' : 
                   summary.health === 'fair' ? 'Some improvements recommended' : 
                   'Significant issues detected'}
                </p>
              </div>
            </div>
            <div className={cn("text-5xl font-bold", health.text)}>
              {summary.score}
              <span className="text-2xl text-muted-foreground font-normal">/100</span>
            </div>
          </div>

          {summary.suggestions.length > 0 && (
            <div className="space-y-3 bg-background/50 rounded-xl p-4">
              <p className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Suggestions for improvement:
              </p>
              <ul className="space-y-2">
                {summary.suggestions.map((suggestion, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className={cn("mt-1.5 w-1.5 h-1.5 rounded-full", health.text.replace('text-', 'bg-'))} />
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Files, label: 'Files', value: formatNumber(metrics.totalFiles), color: 'from-blue-500 to-cyan-500' },
            { icon: Code2, label: 'Lines of Code', value: formatNumber(metrics.totalLines), color: 'from-emerald-500 to-teal-500' },
            { icon: Layers, label: 'Languages', value: Object.keys(metrics.languages).length, color: 'from-violet-500 to-purple-500' },
            { icon: Activity, label: 'Avg Complexity', value: metrics.complexity.averageComplexity.toFixed(1), color: 'from-orange-500 to-amber-500' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              className="group p-5 rounded-2xl bg-card/50 border border-border/50 hover:border-primary/30 hover:bg-card/80 transition-all duration-300 backdrop-blur-sm"
            >
              <div className={cn("w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center mb-3 shadow-lg", stat.color)}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Languages */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <PieChart className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Languages</h3>
                <p className="text-xs text-muted-foreground">Distribution by file count</p>
              </div>
            </div>
            <div className="space-y-4">
              {topLanguages.map(([lang, count], index) => (
                <div key={lang} className="group">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full shadow-sm"
                        style={{ backgroundColor: getLanguageColor(lang) }}
                      />
                      <span className="text-sm font-medium capitalize">{lang}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{count} files</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(count / metrics.totalFiles) * 100}%` }}
                      transition={{ delay: 0.5 + index * 0.1, duration: 0.5 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: getLanguageColor(lang) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Dependencies */}
          {dependencies.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Dependencies</h3>
                    <p className="text-xs text-muted-foreground">{dependencies.length} total packages</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2">
                {dependencies.slice(0, 12).map((dep) => (
                  <div 
                    key={dep.name}
                    className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/30 hover:border-primary/30 hover:bg-background transition-all duration-200 group"
                  >
                    <span className="text-sm font-medium truncate">{dep.name}</span>
                    <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded-full">
                      {dep.version}
                    </span>
                  </div>
                ))}
              </div>
              {dependencies.length > 12 && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  +{dependencies.length - 12} more dependencies
                </p>
              )}
            </motion.div>
          )}
        </div>

        {/* Complexity Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Complexity Analysis</h3>
              <p className="text-xs text-muted-foreground">Code structure metrics</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {[
              { label: 'Functions', value: metrics.complexity.functions, icon: Code2 },
              { label: 'Classes', value: metrics.complexity.classes, icon: Layers },
              { label: 'Max Complexity', value: metrics.complexity.maxComplexity, icon: TrendingUp },
            ].map((item, index) => (
              <div key={item.label} className="text-center p-4 rounded-xl bg-background/50 border border-border/30">
                <div className="w-12 h-12 mx-auto rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <p className="text-3xl font-bold mb-1">{item.value}</p>
                <p className="text-sm text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </ScrollArea>
  );
}