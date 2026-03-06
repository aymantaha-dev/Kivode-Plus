// src/renderer/src/App.tsx

import { Component, ReactNode, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useAppStore } from '@renderer/stores/useAppStore';
import { TitleBar } from '@renderer/components/TitleBar';
import { FileTree } from '@renderer/components/FileTree';
import { EditorTabs } from '@renderer/components/EditorTabs';
import { CodeEditor } from '@renderer/components/CodeEditor';
import { AIPanel } from '@renderer/components/AIPanel';
import { DiffViewer } from '@renderer/components/DiffViewer';
import { MetricsPanel } from '@renderer/components/MetricsPanel';
import { SettingsPanel } from '@renderer/components/SettingsPanel';
import { PreviewPanel } from '@renderer/components/PreviewPanel';
import { ToastContainer } from '@renderer/components/ToastContainer';
import { LoadingOverlay } from '@renderer/components/LoadingOverlay';
import { WelcomeScreen } from '@renderer/components/WelcomeScreen';
import { GitHubCloneDialog } from '@renderer/components/GitHubCloneDialog';
import { GitHubIntegrationPanel } from '@renderer/components/GitHubIntegrationPanel';
import { OnboardingGuide } from '@renderer/components/OnboardingGuide';
import { Button } from '@renderer/components/ui/button';
import { PanelLeft, PanelRight, Bot, BarChart3, Settings, FileCode, Eye, Github } from 'lucide-react';

class AIPanelErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Unknown rendering error' };
  }

  componentDidCatch(error: Error) {
    console.error('AIPanel crashed:', error);
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full p-4 flex flex-col gap-3 items-start justify-center">
          <p className="text-sm font-semibold text-destructive">AI panel stopped unexpectedly.</p>
          <p className="text-xs text-muted-foreground">{this.state.message}</p>
          <Button size="sm" variant="outline" onClick={this.handleReset}>Reload AI Panel</Button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isGitHubDialogOpen, setIsGitHubDialogOpen] = useState(false);
  const [isGitHubPanelOpen, setIsGitHubPanelOpen] = useState(false);
  const [gitHubInitialTab, setGitHubInitialTab] = useState<'repos' | 'publish'>('repos');
  const [showOnboarding, setShowOnboarding] = useState(false);

  const {
    theme,
    projectPath,
    currentView,
    setCurrentView,
    sidebarCollapsed,
    toggleSidebar,
    rightPanelCollapsed,
    toggleRightPanel,
    isLoading,
    loadingMessage,
    setAvailableModels,
    setProject,
    setFileTree,
    addToast,
  } = useAppStore();

  useEffect(() => {
    const init = async () => {
      try {
        document.documentElement.classList.toggle('dark', theme === 'dark');

        if (window.electronAPI) {
          try {
            const models = await window.electronAPI.ai.getModels();
            setAvailableModels(models);
          } catch (error) {
            console.warn('Failed to load AI models:', error);
          }
        }

        const seenOnboarding = localStorage.getItem('kivode.onboarding.seen');
        if (!seenOnboarding) {
          setShowOnboarding(true);
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setIsInitialized(true);
      }
    };

    init();
  }, []);

  useEffect(() => {
    const handleOpenGitHubDialog = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.timestamp) {
        setIsGitHubDialogOpen(true);
      }
    };

    window.addEventListener('open-github-clone-dialog', handleOpenGitHubDialog);
    return () => window.removeEventListener('open-github-clone-dialog', handleOpenGitHubDialog);
  }, []);

  useEffect(() => {
    const handleOpenGitHubPanel = (event: Event) => {
      const customEvent = event as CustomEvent;
      const tab = customEvent.detail?.tab === 'publish' ? 'publish' : 'repos';
      setGitHubInitialTab(tab);
      setIsGitHubPanelOpen(true);
    };
    window.addEventListener('open-github-panel', handleOpenGitHubPanel);
    return () => window.removeEventListener('open-github-panel', handleOpenGitHubPanel);
  }, []);

  const handleGitHubClone = async (url: string) => {
    try {
      const result = await window.electronAPI.file.selectFolder();
      if (!result.canceled && result.filePaths.length > 0) {
        const targetPath = result.filePaths[0];

        addToast({ type: 'info', title: 'Cloning...', message: 'Please wait while we clone the repository' });

        const cloneResult = await window.electronAPI.github.clone(url, targetPath);
        if (cloneResult.success) {
          addToast({ type: 'success', title: 'Success!', message: cloneResult.message });
          const tree = await window.electronAPI.file.readDirectory(cloneResult.path);
          const name = url.split('/').pop()?.replace('.git', '') || 'GitHub Project';
          setProject(cloneResult.path, name);
          setFileTree(tree);
          await window.electronAPI.shell.showItemInFolder(cloneResult.path);
        } else {
          throw new Error(cloneResult.message);
        }
      }
    } catch (error: any) {
      console.error('GitHub clone error:', error);
      addToast({ type: 'error', title: 'Clone Failed', message: error.message || 'Failed to clone repository' });
      throw error;
    }
  };

  const renderMainContent = () => {
    const allowedViewsWithoutProject = ['settings', 'metrics'];

    if (!projectPath && !allowedViewsWithoutProject.includes(currentView)) {
      return <WelcomeScreen />;
    }

    switch (currentView) {
      case 'diff':
        return <DiffViewer />;
      case 'metrics':
        return <MetricsPanel />;
      case 'settings':
        return <SettingsPanel onOpenGuide={() => setShowOnboarding(true)} />;
      case 'preview':
        return <PreviewPanel />;
      case 'editor':
      default:
        return projectPath ? <CodeEditor /> : <WelcomeScreen />;
    }
  };

  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading Kivode+...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TitleBar />

      <div className="flex flex-1 overflow-hidden p-3 pt-2">
        <PanelGroup direction="horizontal" className="h-full w-full gap-3">
          {!sidebarCollapsed && projectPath && (
            <>
              <Panel defaultSize={20} minSize={14} maxSize={30}>
                <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border/80 px-3 py-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Explorer</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={toggleSidebar}>
                      <PanelLeft className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-auto p-2">
                    <FileTree />
                  </div>
                </div>
              </Panel>
              <PanelResizeHandle className="group flex w-1 items-center justify-center rounded-full bg-border/40 transition hover:bg-primary/40" />
            </>
          )}

          <Panel minSize={38}>
            <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/60 shadow-sm">
              {projectPath && <EditorTabs />}
              <div className="relative flex-1 overflow-hidden">{renderMainContent()}</div>

              <div className="border-t border-border/70 bg-card/80 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 rounded-full border-border/80 bg-background/70 px-3 text-xs hover:bg-accent"
                      onClick={() => setIsGitHubDialogOpen(true)}
                    >
                      <Github className="h-3.5 w-3.5" />
                      <span>Import</span>
                    </Button>

                    <div className="flex items-center gap-1 rounded-full border border-border/80 bg-muted/40 p-1">
                      <Button variant={currentView === 'editor' ? 'secondary' : 'ghost'} size="sm" className="h-7 gap-1 rounded-full px-3" onClick={() => setCurrentView('editor')} disabled={!projectPath}>
                        <FileCode className="h-3.5 w-3.5" />
                        <span className="text-xs">Editor</span>
                      </Button>
                      <Button variant={currentView === 'preview' ? 'secondary' : 'ghost'} size="sm" className="h-7 gap-1 rounded-full px-3" onClick={() => setCurrentView('preview')} disabled={!projectPath}>
                        <Eye className="h-3.5 w-3.5" />
                        <span className="text-xs">Preview</span>
                      </Button>
                      <Button variant={currentView === 'diff' ? 'secondary' : 'ghost'} size="sm" className="h-7 gap-1 rounded-full px-3" onClick={() => setCurrentView('diff')} disabled={!projectPath}>
                        <FileCode className="h-3.5 w-3.5" />
                        <span className="text-xs">Diff</span>
                      </Button>
                      <Button variant={currentView === 'metrics' ? 'secondary' : 'ghost'} size="sm" className="h-7 gap-1 rounded-full px-3" onClick={() => setCurrentView('metrics')}>
                        <BarChart3 className="h-3.5 w-3.5" />
                        <span className="text-xs">Metrics</span>
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant={sidebarCollapsed ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-full" onClick={toggleSidebar}>
                      <PanelLeft className="h-4 w-4" />
                    </Button>
                    <Button variant={rightPanelCollapsed ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-full" onClick={toggleRightPanel}>
                      <PanelRight className="h-4 w-4" />
                    </Button>
                    <Button variant={currentView === 'settings' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8 rounded-full" onClick={() => setCurrentView('settings')}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          {!rightPanelCollapsed && (
            <>
              <PanelResizeHandle className="group flex w-1 items-center justify-center rounded-full bg-border/40 transition hover:bg-primary/40" />
              <Panel defaultSize={34} minSize={24} maxSize={55}>
                <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-sm">
                  <div className="flex items-center justify-between border-b border-border/80 p-3">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">AI Assistant</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={toggleRightPanel}>
                      <PanelRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <AIPanelErrorBoundary>
                      <AIPanel />
                    </AIPanelErrorBoundary>
                  </div>
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      <GitHubCloneDialog isOpen={isGitHubDialogOpen} onClose={() => setIsGitHubDialogOpen(false)} onClone={handleGitHubClone} />

      {isGitHubPanelOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setIsGitHubPanelOpen(false)}
        >
          <div className="h-[85vh] w-[90vw] max-w-[1400px] overflow-hidden rounded-2xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <GitHubIntegrationPanel initialTab={gitHubInitialTab} onClose={() => setIsGitHubPanelOpen(false)} />
          </div>
        </motion.div>
      )}

      {isLoading && <LoadingOverlay message={loadingMessage} />}
      <ToastContainer />
      <OnboardingGuide
        open={showOnboarding}
        onClose={() => {
          localStorage.setItem('kivode.onboarding.seen', '1');
          setShowOnboarding(false);
        }}
        onStepAction={(action) => {
          if (action === 'open-settings') setCurrentView('settings');
          if (action === 'open-editor') setCurrentView('editor');
          if (action === 'open-preview') setCurrentView('preview');
          if (action === 'open-github') setIsGitHubDialogOpen(true);
          if (action === 'open-ai' && rightPanelCollapsed) toggleRightPanel();
          if (action === 'open-tree' && sidebarCollapsed) toggleSidebar();
        }}
      />
    </div>
  );
}

export default App;
