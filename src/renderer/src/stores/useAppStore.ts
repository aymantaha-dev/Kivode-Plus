import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { sanitizeToast } from '@renderer/utils/notifications';
import { 
  FileNode, 
  OpenFile, 
  AIModel, 
  ProjectMetrics, 
  DependencyInfo,
  ProjectSettings,
  ViewType,
  ToastMessage 
} from '@/types';

interface AppState {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  toggleTheme: () => void;

  projectPath: string | null;
  projectName: string | null;
  fileTree: FileNode[];
  setProject: (path: string | null, name: string | null) => void;
  setFileTree: (tree: FileNode[]) => void;
  refreshFileTree: () => Promise<void>;

  openFiles: OpenFile[];
  activeFile: string | null;
  openFile: (file: FileNode) => Promise<void>;
  closeFile: (path: string) => void;
  closeAllFiles: () => void;
  setActiveFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
  saveAllFiles: () => Promise<void>; // Saves all modified files.
  markFileModified: (path: string, isModified: boolean) => void;

  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;

  selectedModel: string;
  setSelectedModel: (model: string) => void;
  availableModels: AIModel[];
  setAvailableModels: (models: AIModel[]) => void;
  isGenerating: boolean;
  setIsGenerating: (isGenerating: boolean) => void;
  aiResponse: string | null;
  setAiResponse: (response: string | null) => void;

  diffData: {
    original: string;
    modified: string;
    filePath: string;
  } | null;
  diffQueue: Array<{ original: string; modified: string; filePath: string }>;
  activeDiffFilePath: string | null;
  setDiffData: (data: { original: string; modified: string; filePath: string } | null) => void;
  setActiveDiffFilePath: (filePath: string | null) => void;
  applyDiff: (filePath?: string) => Promise<void>;
  rejectDiff: (filePath?: string) => void;

  projectMetrics: ProjectMetrics | null;
  setProjectMetrics: (metrics: ProjectMetrics | null) => void;
  dependencies: DependencyInfo[];
  setDependencies: (deps: DependencyInfo[]) => void;

  settings: ProjectSettings;
  updateSettings: (settings: Partial<ProjectSettings>) => void;

  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  rightPanelCollapsed: boolean;
  toggleRightPanel: () => void;
  bottomPanelHeight: number;
  setBottomPanelHeight: (height: number) => void;

  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;

  isDragging: boolean;
  setIsDragging: (isDragging: boolean) => void;

  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (message: string) => void;

  // Exports the current project as an archive.
  exportProject: (exportPath: string) => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => {
        set({ theme });
        document.documentElement.classList.toggle('dark', theme === 'dark');
      },
      toggleTheme: () => {
        const newTheme = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: newTheme });
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
      },

      projectPath: null,
      projectName: null,
      fileTree: [],
      setProject: (path, name) => set({ projectPath: path, projectName: name }),
      setFileTree: (tree) => set({ fileTree: tree }),
      refreshFileTree: async () => {
        const { projectPath } = get();
        if (projectPath) {
          try {
            const tree = await window.electronAPI.file.readDirectory(projectPath);
            set({ fileTree: tree });
          } catch (error) {
            console.error('Failed to refresh file tree:', error);
          }
        }
      },

      openFiles: [],
      activeFile: null,
    
      openFile: async (fileNode) => {
        if (fileNode.type !== 'file') return;

        const { openFiles } = get();
        const existingFile = openFiles.find(f => f.path === fileNode.path);

        if (existingFile) {
          set({ activeFile: fileNode.path });
          return;
        }

        try {
          const content = await window.electronAPI.file.readFile(fileNode.path);
          const newFile: OpenFile = {
            path: fileNode.path,
            name: fileNode.name,
            content,
            originalContent: content,
            language: fileNode.language || 'plaintext',
            isModified: false,
            isActive: true,
          };

          set({
            openFiles: [...openFiles.map(f => ({ ...f, isActive: false })), newFile],
            activeFile: fileNode.path,
          });
        } catch (error) {
          console.error('Failed to open file:', error);
          get().addToast({
            type: 'error',
            title: 'Error',
            message: `Failed to open ${fileNode.name}`,
          });
        }
      },

      closeFile: (path) => {
        const { openFiles, activeFile } = get();
        const newOpenFiles = openFiles.filter(f => f.path !== path);
        
        if (activeFile === path && newOpenFiles.length > 0) {
          const lastFile = newOpenFiles[newOpenFiles.length - 1];
          lastFile.isActive = true;
          set({ 
            openFiles: newOpenFiles,
            activeFile: lastFile.path,
          });
        } else if (newOpenFiles.length === 0) {
          set({ 
            openFiles: [],
            activeFile: null,
          });
        } else {
          set({ openFiles: newOpenFiles });
        }
      },
      closeAllFiles: () => set({ openFiles: [], activeFile: null }),
      setActiveFile: (path) => {
        const { openFiles } = get();
        set({
          openFiles: openFiles.map(f => ({
            ...f,
            isActive: f.path === path,
          })),
          activeFile: path,
        });
      },
      updateFileContent: (path, content) => {
        const { openFiles } = get();
        set({
          openFiles: openFiles.map(f =>
            f.path === path ? { ...f, content, isModified: true } : f
          ),
        });
      },
      
      saveFile: async (path) => {
        const { openFiles } = get();
        const file = openFiles.find(f => f.path === path);
        if (!file) return;

        try {
          await window.electronAPI.file.writeFile(path, file.content);
          set({
            openFiles: openFiles.map(f =>
              f.path === path ? { ...f, isModified: false, originalContent: f.content } : f
            ),
          });
          get().addToast({
            type: 'success',
            title: 'Saved',
            message: `${file.name} saved successfully`,
          });
        } catch (error) {
          console.error('Failed to save file:', error);
          get().addToast({
            type: 'error',
            title: 'Error',
            message: `Failed to save ${file.name}`,
          });
          throw error;
        }
      },

      // Saves all modified files. 
      saveAllFiles: async () => {
        const { openFiles } = get();
        const modifiedFiles = openFiles.filter(f => f.isModified);
        
        if (modifiedFiles.length === 0) {
          get().addToast({
            type: 'info',
            title: 'No Changes',
            message: 'No modified files to save',
          });
          return;
        }

        const results = await window.electronAPI.file.saveAllFiles(
          modifiedFiles.map(f => ({ path: f.path, content: f.content }))
        );

        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;

        if (failCount === 0) {
          set({
            openFiles: openFiles.map(f =>
              f.isModified ? { ...f, isModified: false, originalContent: f.content } : f
            ),
          });
          get().addToast({
            type: 'success',
            title: 'All Saved',
            message: `Saved ${successCount} file(s) successfully`,
          });
        } else {
          get().addToast({
            type: 'warning',
            title: 'Partial Save',
            message: `Saved ${successCount}, failed ${failCount}`,
          });
        }
      },

      markFileModified: (path, isModified) => {
        const { openFiles } = get();
        set({
          openFiles: openFiles.map(f =>
            f.path === path ? { ...f, isModified } : f
          ),
        });
      },

      currentView: 'editor',
      setCurrentView: (view) => set({ currentView: view }),

      selectedModel: 'deepseek-coder',
      setSelectedModel: (model) => set({ selectedModel: model }),
      availableModels: [],
      setAvailableModels: (models) => set({ availableModels: models }),
      isGenerating: false,
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      aiResponse: null,
      setAiResponse: (response) => set({ aiResponse: response }),

      diffData: null,
      diffQueue: [],
      activeDiffFilePath: null,
      setActiveDiffFilePath: (filePath) => {
        const { diffQueue } = get();
        const exists = filePath && diffQueue.some((d) => d.filePath === filePath);
        const nextActive = exists ? filePath : (diffQueue[0]?.filePath || null);
        const nextDiff = nextActive ? (diffQueue.find((d) => d.filePath === nextActive) || null) : null;
        set({ activeDiffFilePath: nextActive, diffData: nextDiff });
      },
      setDiffData: (data) => {
        if (!data) {
          set({ diffData: null, diffQueue: [], activeDiffFilePath: null });
          return;
        }

        const { diffQueue } = get();
        const idx = diffQueue.findIndex((d) => d.filePath === data.filePath);
        const nextQueue = idx >= 0
          ? diffQueue.map((d, i) => (i === idx ? data : d))
          : [...diffQueue, data];

        set({
          diffData: data,
          diffQueue: nextQueue,
          activeDiffFilePath: data.filePath,
          currentView: 'diff',
        });
      },
      applyDiff: async (filePath?: string) => {
        const { diffQueue, activeDiffFilePath, openFiles, closeFile } = get();
        const targetPath = filePath || activeDiffFilePath;
        if (!targetPath) return;
        const targetDiff = diffQueue.find((d) => d.filePath === targetPath);
        if (!targetDiff) return;

        try {
          await window.electronAPI.file.writeFile(targetDiff.filePath, targetDiff.modified);

          const updatedFiles = openFiles.map(f =>
            f.path === targetDiff.filePath
              ? { ...f, content: targetDiff.modified, originalContent: targetDiff.modified, isModified: false }
              : f
          );

          const nextQueue = diffQueue.filter((d) => d.filePath !== targetDiff.filePath);
          const nextActive = nextQueue[0]?.filePath || null;
          const nextDiff = nextActive ? (nextQueue.find((d) => d.filePath === nextActive) || null) : null;

          set({
            diffData: nextDiff,
            diffQueue: nextQueue,
            activeDiffFilePath: nextActive,
            openFiles: updatedFiles,
            currentView: nextDiff ? 'diff' : 'editor',
          });

          closeFile(targetDiff.filePath);

          get().addToast({
            type: 'success',
            title: 'Changes Applied',
            message: `${targetDiff.filePath.split(/[\/]/).pop()} applied successfully`,
          });
        } catch (error) {
          console.error('Failed to apply diff:', error);
          get().addToast({
            type: 'error',
            title: 'Error',
            message: 'Failed to apply changes',
          });
        }
      },
      rejectDiff: (filePath?: string) => {
        const { diffQueue, activeDiffFilePath, closeFile } = get();
        const targetPath = filePath || activeDiffFilePath;
        if (!targetPath) return;

        const nextQueue = diffQueue.filter((d) => d.filePath !== targetPath);
        const nextActive = nextQueue[0]?.filePath || null;
        const nextDiff = nextActive ? (nextQueue.find((d) => d.filePath === nextActive) || null) : null;

        set({
          diffData: nextDiff,
          diffQueue: nextQueue,
          activeDiffFilePath: nextActive,
          currentView: nextDiff ? 'diff' : 'editor',
        });

        closeFile(targetPath);

        get().addToast({
          type: 'info',
          title: 'Changes Rejected',
          message: `${targetPath.split(/[\/]/).pop()} changes were discarded`,
        });
      },

      projectMetrics: null,
      setProjectMetrics: (metrics) => set({ projectMetrics: metrics }),
      dependencies: [],
      setDependencies: (deps) => set({ dependencies: deps }),

      settings: {
        theme: 'dark',
        language: 'en',
        defaultModel: 'deepseek-coder',
        autoSave: true,
        tabSize: 2,
        fontSize: 14,
        wordWrap: true,
        minimap: true,
      },
      updateSettings: (newSettings) => {
        set({ settings: { ...get().settings, ...newSettings } });
      },

      sidebarCollapsed: false,
      toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      rightPanelCollapsed: false,
      toggleRightPanel: () => set(state => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),
      bottomPanelHeight: 200,
      setBottomPanelHeight: (height) => set({ bottomPanelHeight: height }),

      toasts: [],
      addToast: (toast) => {
        const id = Math.random().toString(36).substring(2, 9);
        const safeToast = sanitizeToast(toast);
        const newToast = { ...safeToast, id };
        set(state => ({ toasts: [...state.toasts, newToast] }));
        
        setTimeout(() => {
          get().removeToast(id);
        }, toast.duration || 5000);
      },
      removeToast: (id) => {
        set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
      },

      isDragging: false,
      setIsDragging: (isDragging) => set({ isDragging }),

      isLoading: false,
      setIsLoading: (isLoading) => set({ isLoading }),
      loadingMessage: '',
      setLoadingMessage: (message) => set({ loadingMessage: message }),

      // Exports the current project as an archive.
      exportProject: async (exportPath: string) => {
        const { projectPath, projectName, openFiles } = get();
        
        if (!projectPath) {
          throw new Error('No project open');
        }

        try {
          const filesToExport = openFiles.map(file => ({
            path: file.path,
            content: file.content,
            relativePath: file.path.replace(projectPath, '').replace(/^[/\\]/, ''),
          }));

          await window.electronAPI.project.exportProject({
            sourcePath: projectPath,
            exportPath,
            modifiedFiles: filesToExport,
          });

          get().addToast({
            type: 'success',
            title: 'Export Complete',
            message: `Project exported to: ${exportPath}`,
          });
        } catch (error: any) {
          console.error('Export failed:', error);
          get().addToast({
            type: 'error',
            title: 'Export Failed',
            message: error.message || 'Failed to export project',
          });
          throw error;
        }
      },
    }),
    {
      name: 'kivode-plus-storage',
      partialize: (state) => ({
        theme: state.theme,
        settings: state.settings,
        selectedModel: state.selectedModel,
      }),
    }
  )
);

if (typeof window !== 'undefined') {
  const savedTheme = localStorage.getItem('kivode-plus-storage');
  if (savedTheme) {
    try {
      const parsed = JSON.parse(savedTheme);
      if (parsed.state?.theme) {
        document.documentElement.classList.toggle('dark', parsed.state.theme === 'dark');
      }
    } catch (e) {
      console.error('Failed to parse saved theme:', e);
    }
  }
}
