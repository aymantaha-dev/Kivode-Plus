import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { GitHubAuthButton } from './GitHubAuthButton';
import { RepositoryAnalyzer } from './RepositoryAnalyzer';
import { useAppStore } from '@renderer/stores/useAppStore';
import type { PublishRepositoryOptions } from '@renderer/types/electron';
import {
  Github,
  BookOpen,
  Upload,
  GitBranch,
  ArrowRight,
  Loader2,
  X,
  Search,
  Star,
  Lock,
  Globe,
  Code2,
  FolderGit2,
  Clock,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Terminal,
  Copy,
  Package,
  Database,
  Wifi,
  GitCommit,
  Rocket,
  GitPullRequest
} from 'lucide-react';

const Button = ({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'ghost';
  className?: string;
}) => {
  const variants = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-border bg-transparent hover:bg-accent',
    ghost: 'hover:bg-accent',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:opacity-50 px-4 py-2 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Badge = ({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'default';
}) => {
  const variants = {
    success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    error: 'bg-red-500/15 text-red-400 border border-red-500/30',
    default: 'bg-muted text-muted-foreground border border-border',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
};

interface PublishStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: 'pending' | 'loading' | 'completed' | 'error';
  message?: string;
}

interface PublishResponse {
  success?: boolean;
  url?: string;
  repoName?: string;
  error?: {
    message: string;
    code: string | number;
    stack?: string;
    response?: unknown;
  };
}


export function GitHubIntegrationPanel({ onClose, initialTab = 'repos' }: { onClose: () => void; initialTab?: 'repos' | 'publish' }) {
  const [selectedRepo, setSelectedRepo] = useState<any>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [activeTab, setActiveTab] = useState<'repos' | 'publish'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [repos, setRepos] = useState<any[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [githubUser, setGithubUser] = useState<{ login: string; avatar: string } | null>(null);

  const [readmeData, setReadmeData] = useState<{ exists: boolean; content: string; truncated: boolean; htmlUrl: string | null } | null>(null);
  const [isReadmeExpanded, setIsReadmeExpanded] = useState(false);
  const [isReadmeLoading, setIsReadmeLoading] = useState(false);

  const [publishName, setPublishName] = useState('');
  const [publishDescription, setPublishDescription] = useState('');
  const [publishPrivate, setPublishPrivate] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showAdvancedPublish, setShowAdvancedPublish] = useState(false);
  const [publishTargetMode, setPublishTargetMode] = useState<'auto' | 'create' | 'existing'>('auto');
  const [existingRepoTarget, setExistingRepoTarget] = useState('');
  const [originSuggestion, setOriginSuggestion] = useState<string | null>(null);
  const [addReadme, setAddReadme] = useState(false);
  const [gitignoreTemplate, setGitignoreTemplate] = useState('none');
  const [licenseTemplate, setLicenseTemplate] = useState('none');
  const [branchName, setBranchName] = useState('');
  const [forcePush, setForcePush] = useState(false);
  const [useCustomBranch, setUseCustomBranch] = useState(false);
  const [createPullRequestAfterPublish, setCreatePullRequestAfterPublish] = useState(false);
  const [pullRequestBase, setPullRequestBase] = useState('main');

  const [publishSteps, setPublishSteps] = useState<PublishStep[]>([
    { id: 'validate', label: 'Validating project files', icon: <Package className="w-4 h-4" />, status: 'pending' },
    { id: 'auth', label: 'Authenticating with GitHub', icon: <Wifi className="w-4 h-4" />, status: 'pending' },
    { id: 'repo', label: 'Preparing repository', icon: <Database className="w-4 h-4" />, status: 'pending' },
    { id: 'git', label: 'Initializing Git', icon: <GitBranch className="w-4 h-4" />, status: 'pending' },
    { id: 'commit', label: 'Committing files', icon: <GitCommit className="w-4 h-4" />, status: 'pending' },
    { id: 'push', label: 'Pushing to GitHub', icon: <Rocket className="w-4 h-4" />, status: 'pending' },
    { id: 'verify', label: 'Verifying upload', icon: <CheckCircle2 className="w-4 h-4" />, status: 'pending' },
  ]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [showProgress, setShowProgress] = useState(false);

  const [publishError, setPublishError] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string>('');

  const { addToast, setProject, setFileTree, setIsLoading: setGlobalLoading, setLoadingMessage, projectPath, projectName } = useAppStore();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!publishName && projectName) {
      setPublishName(projectName.toLowerCase().replace(/\s+/g, '-'));
    }
  }, [projectName, publishName]);

  useEffect(() => {
    const filtered = repos.filter(
      (repo) => repo.name.toLowerCase().includes(searchQuery.toLowerCase()) || repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredRepos(filtered);
  }, [searchQuery, repos]);

  useEffect(() => {
    const detectOriginTarget = async () => {
      if (!projectPath) {
        setOriginSuggestion(null);
        return;
      }

      try {
        const target = await window.electronAPI.github.getLocalRepositoryTarget(projectPath);
        if (target?.isGitHubOrigin && target?.fullName) {
          setOriginSuggestion(target.fullName);
          setLocalRepoTarget(target.fullName);
          setPublishTargetMode('auto');
          setExistingRepoTarget(target.fullName);
        } else {
          setOriginSuggestion(null);
          setLocalRepoTarget(null);
        }
      } catch {
        setOriginSuggestion(null);
      }
    };

    detectOriginTarget();
  }, [projectPath]);

  const loadRepositoryReadme = async (owner: string, repo: string) => {
    setIsReadmeLoading(true);
    setIsReadmeExpanded(false);
    try {
      const readme = await window.electronAPI.github.getRepositoryReadme(owner, repo);
      setReadmeData(readme);
    } catch {
      setReadmeData(null);
    } finally {
      setIsReadmeLoading(false);
    }
  };

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const auth = await window.electronAPI.github.isAuthenticated();
      setIsAuthenticated(auth);

      if (auth) {
        const user = await window.electronAPI.github.getUser();
        setGithubUser(user);
        await loadRepositories();
      } else {
        setGithubUser(null);
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
      setGithubUser(null);
      setIsLoading(false);
    }
  };

  const loadRepositories = async () => {
    try {
      setIsLoading(true);
      const data = await window.electronAPI.github.getRepositories();
      setRepos(data);
      setFilteredRepos(data);
    } catch (error: any) {
      console.error('Failed to load repositories:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to load repositories: ' + (error.message || 'Unknown error'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthChange = async () => {
    await checkAuth();
    setSelectedRepo(null);
    setSearchQuery('');
  };


  useEffect(() => {
    if (!selectedRepo?.fullName) return;
    const [owner, repo] = selectedRepo.fullName.split('/');
    if (owner && repo) {
      loadRepositoryReadme(owner, repo);
    }
  }, [selectedRepo?.fullName]);

  const handleClone = async (repo: any) => {
    setIsCloning(true);
    try {
      const result = await window.electronAPI.file.selectFolder();
      if (!result.canceled && result.filePaths.length > 0) {
        const targetPath = result.filePaths[0];
        setLoadingMessage(`Cloning ${repo.name}...`);
        setGlobalLoading(true);

        const cloneResult = await window.electronAPI.github.clone(repo.cloneUrl, targetPath);

        if (cloneResult.success) {
          const tree = await window.electronAPI.file.readDirectory(cloneResult.path);
          setProject(cloneResult.path, repo.name);
          setFileTree(tree);
          addToast({ type: 'success', title: 'Repository Cloned', message: `Successfully cloned ${repo.name}` });
          onClose();
        } else {
          throw new Error(cloneResult.message || 'Unable to clone repository');
        }
      }
    } catch (error: any) {
      addToast({ type: 'error', title: 'Clone Failed', message: error?.message || 'Invalid URL or missing repository permissions.' });
    } finally {
      setIsCloning(false);
      setGlobalLoading(false);
    }
  };

  const handleStartEditing = async (repo: any) => {
    setIsCloning(true);
    try {
      const success = await window.electronAPI.github.startEditingSession(repo.fullName.split('/')[0], repo.name);

      if (success) {
        const session = await window.electronAPI.github.getCurrentSession();
        if (session) {
          const tree = await window.electronAPI.file.readDirectory(session.localPath);
          setProject(session.localPath, repo.name);
          setFileTree(tree);
          addToast({ type: 'success', title: 'Editing Session Started', message: `Working on branch: ${session.workingBranch}` });
          onClose();
        }
      }
    } catch (error: any) {
      addToast({ type: 'error', title: 'Failed to Start Editing', message: error?.message || 'The requested action could not be completed. Please try again.' });
    } finally {
      setIsCloning(false);
    }
  };
  const updateStepStatus = (stepId: string, status: PublishStep['status'], message?: string) => {
    setPublishSteps((prev) => prev.map((step) => (step.id === stepId ? { ...step, status, message } : step)));
  };

  const resetSteps = () => {
    setPublishSteps((prev) => prev.map((step) => ({ ...step, status: 'pending', message: undefined })));
    setCurrentStepIndex(-1);
  };

  const handlePublish = async () => {
    setPublishError(null);
    setErrorDetails('');
    setShowErrorDetails(false);
    resetSteps();
    setShowProgress(true);

    if (!projectPath) {
      addToast({ type: 'warning', title: 'No Project Open', message: 'Open a local project first to publish it.' });
      setShowProgress(false);
      return;
    }

    if (publishTargetMode === 'create' && !publishName.trim()) {
      addToast({ type: 'warning', title: 'Repository Name Required', message: 'Enter a repository name first.' });
      setShowProgress(false);
      return;
    }

    if (publishTargetMode === 'existing' && !existingRepoTarget.trim()) {
      addToast({ type: 'warning', title: 'Repository Required', message: 'Select an existing repository before publishing.' });
      setShowProgress(false);
      return;
    }

    setIsPublishing(true);

    try {
      const publishOptions: PublishRepositoryOptions = {
        targetMode: publishTargetMode,
        existingRepoFullName: publishTargetMode === 'existing' ? existingRepoTarget : undefined,
        addReadme,
        gitignoreTemplate: gitignoreTemplate !== 'none' ? gitignoreTemplate : undefined,
        licenseTemplate: licenseTemplate !== 'none' ? licenseTemplate : undefined,
        branchName: useCustomBranch ? branchName.trim() || undefined : undefined,
        forcePush,
        createPullRequest: createPullRequestAfterPublish,
        pullRequestBase: pullRequestBase.trim() || undefined,
      };

      const publishRepositoryName = publishTargetMode === 'create' ? publishName.trim() : publishName.trim() || projectName || 'project';

      setCurrentStepIndex(0);
      updateStepStatus('validate', 'loading');
      await new Promise((resolve) => setTimeout(resolve, 500));
      updateStepStatus('validate', 'completed');

      setCurrentStepIndex(1);
      updateStepStatus('auth', 'loading');
      const auth = await window.electronAPI.github.isAuthenticated();
      if (!auth) {
        throw new Error('Not authenticated with GitHub');
      }
      updateStepStatus('auth', 'completed');

      setCurrentStepIndex(2);
      updateStepStatus('repo', 'loading');
      await new Promise((resolve) => setTimeout(resolve, 800));
      updateStepStatus('repo', 'completed', publishTargetMode === 'create' ? 'Creating new repository' : 'Using existing repository');

      const response = (await window.electronAPI.github.publishRepository(
        publishRepositoryName,
        publishDescription.trim(),
        publishPrivate,
        projectPath,
        publishOptions
      )) as PublishResponse;

      if (response?.success !== false && response?.url) {
        ['git', 'commit', 'push', 'verify'].forEach((stepId, index) => {
          setTimeout(() => {
            updateStepStatus(stepId, 'completed');
          }, index * 200);
        });

        addToast({
          type: 'success',
          title: 'Published Successfully',
          message: `Project uploaded to ${response.url}`,
        });

        await openExternalLink(response.url);
        await loadRepositories();

        setTimeout(() => {
          setActiveTab('repos');
          setPublishName('');
          setPublishDescription('');
          resetSteps();
          setShowProgress(false);
        }, 1500);
      } else {
        const errorInfo = response?.error || { message: 'Unknown error', code: 'UNKNOWN' };
        const currentStep = publishSteps[currentStepIndex];
        if (currentStep) {
          updateStepStatus(currentStep.id, 'error', errorInfo.message);
        }

        throw new Error(errorInfo.message);
      }
    } catch (error: any) {
      console.error('Publish error:', error);

      const currentStep = publishSteps[currentStepIndex];
      if (currentStep && currentStep.status === 'loading') {
        updateStepStatus(currentStep.id, 'error', error.message);
      }

      let errorMessage = error.message;

      const normalizedError = String(error.message || '').toLowerCase();
      if (normalizedError.includes('authenticate') || normalizedError.includes('credentials')) {
        errorMessage = 'Authentication failed. Please reconnect GitHub once and try again.';
      } else if (normalizedError.includes('already has commits') || normalizedError.includes('non-fast-forward')) {
        errorMessage = 'Repository already has history. Kivode+ will push your changes to a new branch and open a pull request automatically.';
      } else if (normalizedError.includes('exist')) {
        errorMessage = 'Repository name already exists or project path is invalid.';
      } else if (normalizedError.includes('network')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (normalizedError.includes('empty')) {
        errorMessage = 'Project directory is empty. No files to publish.';
      }

      setPublishError(errorMessage);
      setErrorDetails(JSON.stringify({ message: error.message, stack: error.stack }, null, 2));

      addToast({
        type: 'error',
        title: 'Publish Failed',
        message: errorMessage,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const openExternalLink = async (url: string) => {
    try {
      await window.electronAPI.shell.openExternal(url);
    } catch {
      // ignore to keep app stable
    }
  };

  const copyErrorDetails = async () => {
    await window.electronAPI.clipboard.writeText(errorDetails);
    addToast({
      type: 'success',
      title: 'Copied',
      message: 'Error details copied to clipboard',
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const getStepIcon = (step: PublishStep) => {
    if (step.status === 'loading') {
      return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    }
    if (step.status === 'completed') {
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    }
    if (step.status === 'error') {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />;
  };

  const getStepClassName = (step: PublishStep) => {
    if (step.status === 'loading') {
      return 'border-primary bg-primary/5 text-primary';
    }
    if (step.status === 'completed') {
      return 'border-emerald-500/30 bg-emerald-500/5 text-emerald-500';
    }
    if (step.status === 'error') {
      return 'border-red-500/30 bg-red-500/5 text-red-500';
    }
    return 'border-border bg-muted/30 text-muted-foreground';
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between px-8 py-5 border-b border-border bg-card/50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Github className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-xl">GitHub Integration</h2>
            <p className="text-sm text-muted-foreground">Manage and import your repositories</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <GitHubAuthButton onAuthChange={handleAuthChange} />
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-8 py-4 border-b border-border bg-muted/20">
        <button
          onClick={() => {
            setActiveTab('repos');
            setSelectedRepo(null);
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'repos' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          My Repositories
          {repos.length > 0 && <span className="ml-1 px-2 py-0.5 rounded-full bg-primary-foreground/20 text-xs">{repos.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab('publish')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'publish' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <Upload className="w-4 h-4" />
          Publish Project
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'repos' && (
          <div className="h-full flex">
            <div className="w-[320px] border-r border-border flex flex-col bg-muted/10 flex-shrink-0">
              <div className="p-4 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search repositories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-10 pr-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {!isAuthenticated ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6">
                    <Github className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">Connect your GitHub account</p>
                    <GitHubAuthButton onAuthChange={handleAuthChange} />
                  </div>
                ) : isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                    <p className="text-sm text-muted-foreground">Loading repositories...</p>
                  </div>
                ) : filteredRepos.length === 0 ? (
                  <div className="text-center p-6 text-muted-foreground">{searchQuery ? 'No repositories match your search' : 'No repositories found'}</div>
                ) : (
                  filteredRepos.map((repo) => (
                    <div
                      key={repo.id}
                      onClick={() => setSelectedRepo(repo)}
                      className={`p-3 rounded-lg cursor-pointer transition-all border ${
                        selectedRepo?.id === repo.id ? 'border-primary bg-primary/5' : 'border-transparent hover:border-border hover:bg-accent/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            repo.private ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                          }`}
                        >
                          {repo.private ? <Lock className="w-4 h-4 text-amber-500" /> : <Globe className="w-4 h-4 text-emerald-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">{repo.name}</h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <Star className="w-3 h-3" /> {repo.stars}
                            {repo.language && (
                              <>
                                <span>•</span>
                                <span>{repo.language}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 text-muted-foreground ${selectedRepo?.id === repo.id ? 'rotate-90' : ''}`} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedRepo ? (
                <div className="h-full flex flex-col overflow-hidden">
                  <div className="px-8 py-6 border-b border-border">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h1 className="text-2xl font-bold">{selectedRepo.name}</h1>
                          {selectedRepo.private ? (
                            <Badge variant="warning">
                              <Lock className="w-3 h-3" /> Private
                            </Badge>
                          ) : (
                            <Badge variant="success">
                              <Globe className="w-3 h-3" /> Public
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground">{selectedRepo.description || 'No description available'}</p>
                      </div>
                      <button onClick={() => openExternalLink(selectedRepo.htmlUrl)} className="flex items-center gap-1 text-sm text-primary hover:underline">
                        View on GitHub <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-600 text-sm">
                        <Star className="w-4 h-4" />
                        <span className="font-semibold">{selectedRepo.stars}</span>
                        <span className="text-yellow-600/70">stars</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 text-sm">
                        <GitBranch className="w-4 h-4" />
                        <span className="font-semibold">{selectedRepo.defaultBranch}</span>
                      </div>
                      {selectedRepo.language && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-600 text-sm">
                          <Code2 className="w-4 h-4" />
                          <span className="font-semibold">{selectedRepo.language}</span>
                        </div>
                      )}
                      <div className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        Updated {formatDate(selectedRepo.updatedAt)}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
                    <div className="rounded-xl border border-border bg-card/70 p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">README</h3>
                        {readmeData?.htmlUrl && (
                          <button onClick={() => readmeData.htmlUrl && openExternalLink(readmeData.htmlUrl)} className="text-xs text-primary hover:underline">View original</button>
                        )}
                      </div>

                      {isReadmeLoading ? (
                        <div className="text-sm text-muted-foreground">Loading README...</div>
                      ) : readmeData?.exists ? (
                        <>
                          <div className={`prose prose-sm dark:prose-invert max-w-none text-foreground ${isReadmeExpanded ? '' : 'line-clamp-6'}`}>
                            <ReactMarkdown>{readmeData.content}</ReactMarkdown>
                          </div>
                          {(readmeData.truncated || (!readmeData.truncated && readmeData.content.length > 500)) && (
                            <button
                              onClick={() => setIsReadmeExpanded((v) => !v)}
                              className="mt-2 text-sm text-primary hover:underline"
                            >
                              {isReadmeExpanded ? 'Less' : 'More'}
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">No README available for this repository.</div>
                      )}
                    </div>

                    {selectedRepo.fullName?.includes('/') ? (
                      <RepositoryAnalyzer owner={selectedRepo.fullName.split('/')[0]} repo={selectedRepo.name} />
                    ) : (
                      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Repository analytics is unavailable for this item.</div>
                    )}
                  </div>

                  <div className="px-8 py-4 border-t border-border bg-card/50 flex gap-3">
                    <Button variant="outline" onClick={() => handleClone(selectedRepo)} disabled={isCloning} className="flex-1 h-11">
                      {isCloning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FolderGit2 className="w-4 h-4 mr-2" />}
                      Clone Only
                    </Button>
                    <Button onClick={() => handleStartEditing(selectedRepo)} disabled={isCloning} className="flex-1 h-11">
                      {isCloning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <GitBranch className="w-4 h-4 mr-2" />}
                      Safe Edit Mode
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 text-muted-foreground">
                  <Github className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-lg">Select a repository to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'publish' && (
          <div className="h-full p-6 overflow-auto">
            <div className="max-w-2xl mx-auto space-y-4">
              <AnimatePresence>
                {showProgress && (
                  <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="rounded-xl border border-border bg-card p-6">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <Loader2 className={`w-5 h-5 ${isPublishing ? 'animate-spin' : ''}`} />
                      Publishing Progress
                    </h3>

                    <div className="space-y-3">
                      {publishSteps.map((step, index) => (
                        <motion.div
                          key={step.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${getStepClassName(step)}`}
                        >
                          <div className="flex-shrink-0">{getStepIcon(step)}</div>
                          <div className="flex-1 flex items-center justify-between">
                            <span className="font-medium text-sm">{step.label}</span>
                            {step.message && <span className="text-xs opacity-70">{step.message}</span>}
                          </div>
                          <div className="flex-shrink-0">{step.icon}</div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-muted-foreground mb-2">
                        <span>Overall Progress</span>
                        <span>{Math.round((publishSteps.filter((s) => s.status === 'completed').length / publishSteps.length) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${(publishSteps.filter((s) => s.status === 'completed').length / publishSteps.length) * 100}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Publish Current Project
                </h3>
                <p className="text-sm text-muted-foreground mb-6">Create a new repository, push to an existing one, or auto-push back to the imported origin.</p>

                <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm mb-6">
                  <div className="font-medium mb-2 flex items-center gap-2">
                    <Github className="w-4 h-4" />
                    GitHub Account Status
                  </div>
                  {githubUser ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>
                        Connected as <strong className="text-foreground">{githubUser.login}</strong>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <AlertCircle className="w-4 h-4" />
                      <span>Not connected to GitHub</span>
                    </div>
                  )}
                </div>

                {publishError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-red-500 mb-1">Publish Failed</h4>
                        <p className="text-sm text-red-400 mb-2">{publishError}</p>

                        <button onClick={() => setShowErrorDetails(!showErrorDetails)} className="text-xs text-red-400 hover:text-red-300 underline flex items-center gap-1">
                          {showErrorDetails ? 'Hide' : 'Show'} technical details
                        </button>

                        {showErrorDetails && (
                          <div className="mt-3 p-3 rounded bg-black/50 font-mono text-xs text-red-300 overflow-x-auto">
                            <div className="flex justify-between items-center mb-2">
                              <span>Error Details:</span>
                              <button onClick={copyErrorDetails} className="flex items-center gap-1 text-red-400 hover:text-red-200">
                                <Copy className="w-3 h-3" /> Copy
                              </button>
                            </div>
                            <pre className="whitespace-pre-wrap break-all">{errorDetails}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Publish Target</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPublishTargetMode('auto')}
                        className={`rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                          publishTargetMode === 'auto' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:bg-accent'
                        }`}
                      >
                        <div className="font-medium">Auto Detect</div>
                        <div className="text-xs text-muted-foreground mt-1">Detect from git origin</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPublishTargetMode('create')}
                        className={`rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                          publishTargetMode === 'create' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:bg-accent'
                        }`}
                      >
                        <div className="font-medium">Create New</div>
                        <div className="text-xs text-muted-foreground mt-1">Create a new repository</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPublishTargetMode('existing')}
                        className={`rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                          publishTargetMode === 'existing' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:bg-accent'
                        }`}
                      >
                        <div className="font-medium">Existing Repo</div>
                        <div className="text-xs text-muted-foreground mt-1">Push to existing repository</div>
                      </button>
                    </div>

                    {originSuggestion && publishTargetMode === 'auto' && (
                      <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-2 rounded border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        Detected origin: <strong>{originSuggestion}</strong>
                      </div>
                    )}
                  </div>

                  {publishTargetMode === 'existing' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select Existing Repository</label>
                      <select
                        value={existingRepoTarget}
                        onChange={(e) => setExistingRepoTarget(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Choose a repository...</option>
                        {repos.map((repo) => (
                          <option key={repo.id} value={repo.fullName}>
                            {repo.fullName} {repo.private ? '(Private)' : '(Public)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Repository Name
                      {publishTargetMode !== 'create' && <span className="text-muted-foreground font-normal"> (Optional)</span>}
                    </label>
                    <input
                      type="text"
                      value={publishName}
                      onChange={(e) => setPublishName(e.target.value)}
                      disabled={publishTargetMode !== 'create'}
                      placeholder={publishTargetMode === 'create' ? 'my-awesome-project' : 'Only required for new repositories'}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {publishTargetMode === 'create' && (
                      <p className="text-xs text-muted-foreground">Repository name should be unique in your account. Use lowercase letters, numbers, and hyphens.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <textarea
                      value={publishDescription}
                      onChange={(e) => setPublishDescription(e.target.value)}
                      placeholder="A short description of your project (optional)"
                      rows={3}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Visibility</label>
                    <p className="text-xs text-muted-foreground">Choose who can see and commit to this repository.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPublishPrivate(false)}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                          !publishPrivate ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:bg-accent'
                        }`}
                      >
                        <Globe className="w-5 h-5" />
                        <div className="text-left">
                          <div className="font-medium">Public</div>
                          <div className="text-xs text-muted-foreground">Anyone can see this repository</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPublishPrivate(true)}
                        className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                          publishPrivate ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:bg-accent'
                        }`}
                      >
                        <Lock className="w-5 h-5" />
                        <div className="text-left">
                          <div className="font-medium">Private</div>
                          <div className="text-xs text-muted-foreground">Only you can see this repository</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedPublish(!showAdvancedPublish)}
                      className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-accent/40 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4" />
                        Advanced Configuration
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedPublish ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {showAdvancedPublish && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="border-t border-border"
                        >
                          <div className="p-4 space-y-4 text-sm">
                            <div className="space-y-2">
                              <label className="flex items-center justify-between gap-3 cursor-pointer">
                                <div>
                                  <span className="font-medium">Use new branch (optional)</span>
                                  <p className="text-xs text-muted-foreground">Leave off to push directly to default branch.</p>
                                </div>
                                <input type="checkbox" checked={useCustomBranch} onChange={(e) => setUseCustomBranch(e.target.checked)} className="w-4 h-4 rounded border-border" />
                              </label>
                              {useCustomBranch && (
                                <>
                                  <input
                                    type="text"
                                    value={branchName}
                                    onChange={(e) => setBranchName(e.target.value)}
                                    placeholder="feature/my-update"
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                  />
                                  <p className="text-xs text-muted-foreground">Optional branch name for upload.</p>
                                </>
                              )}
                            </div>

                            <label className="flex items-center justify-between gap-3 cursor-pointer">
                              <div>
                                <span className="font-medium">Add README.md</span>
                                <p className="text-xs text-muted-foreground">Initialize with a README file</p>
                              </div>
                              <input
                                type="checkbox"
                                checked={addReadme}
                                onChange={(e) => setAddReadme(e.target.checked)}
                                className="w-4 h-4 rounded border-border"
                              />
                            </label>

                            <div className="space-y-2">
                              <label className="text-sm font-medium">Add .gitignore</label>
                              <select
                                value={gitignoreTemplate}
                                onChange={(e) => setGitignoreTemplate(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              >
                                <option value="none">None</option>
                                <option value="node">Node</option>
                                <option value="python">Python</option>
                                <option value="java">Java</option>
                                <option value="go">Go</option>
                                <option value="rust">Rust</option>
                                <option value="ruby">Ruby</option>
                              </select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium">Add License</label>
                              <select
                                value={licenseTemplate}
                                onChange={(e) => setLicenseTemplate(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              >
                                <option value="none">None</option>
                                <option value="mit">MIT License</option>
                                <option value="apache-2.0">Apache License 2.0</option>
                                <option value="gpl-3.0">GNU GPL v3.0</option>
                              </select>
                            </div>


                            <label className="flex items-center justify-between gap-3 cursor-pointer">
                              <div>
                                <span className="font-medium">Create Pull Request after upload</span>
                                <p className="text-xs text-muted-foreground">When publishing to non-default branch, open PR automatically.</p>
                              </div>
                              <input
                                type="checkbox"
                                checked={createPullRequestAfterPublish}
                                onChange={(e) => setCreatePullRequestAfterPublish(e.target.checked)}
                                className="w-4 h-4 rounded border-border"
                              />
                            </label>

                            {createPullRequestAfterPublish && (
                              <div className="space-y-2">
                                <label className="text-sm font-medium">PR Base Branch</label>
                                <input
                                  type="text"
                                  value={pullRequestBase}
                                  onChange={(e) => setPullRequestBase(e.target.value)}
                                  placeholder="main"
                                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                              </div>
                            )}
                            <label className="flex items-center justify-between gap-3 cursor-pointer">
                              <div>
                                <span className="font-medium text-amber-400">Force Push</span>
                                <p className="text-xs text-muted-foreground">Overwrite remote history (use with caution)</p>
                              </div>
                              <input
                                type="checkbox"
                                checked={forcePush}
                                onChange={(e) => setForcePush(e.target.checked)}
                                className="w-4 h-4 rounded border-border text-amber-500 focus:ring-amber-500"
                              />
                            </label>

                            {forcePush && (
                              <div className="rounded bg-amber-500/10 border border-amber-500/30 p-2 text-xs text-amber-400 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>Force push will overwrite any existing history on the remote repository. This action cannot be undone.</span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Local Path:</span>
                      <span className="font-mono truncate max-w-[300px]" title={projectPath || 'No project loaded'}>
                        {projectPath || 'No project loaded'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Project Name:</span>
                      <span className="font-medium">{projectName || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card/50 p-3 text-xs space-y-2">
                    <p className="font-medium flex items-center gap-2">
                      <Terminal className="w-3 h-3" />
                      Required GitHub Token Permissions
                    </p>
                    <div className="space-y-1 text-muted-foreground">
                      <p>
                        <strong>Fine-grained token:</strong>
                      </p>
                      <ul className="list-disc ml-4 space-y-0.5">
                        <li>Contents: Read and write</li>
                        <li>Metadata: Read-only</li>
                        <li>Administration: Read and write (for creating repos)</li>
                      </ul>
                      <p className="mt-2">
                        <strong>Classic token:</strong> <code>repo</code> scope
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={handlePublish}
                    disabled={
                      isPublishing || !projectPath || !isAuthenticated || (publishTargetMode === 'create' && !publishName.trim()) ||
                      (publishTargetMode === 'existing' && !existingRepoTarget.trim())
                    }
                    className="w-full h-11 text-base"
                  >
                    {isPublishing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        Publish Project to GitHub
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>

                  {!isAuthenticated && (
                    <p className="text-xs text-center text-amber-400 flex items-center justify-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Please connect your GitHub account to publish
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
