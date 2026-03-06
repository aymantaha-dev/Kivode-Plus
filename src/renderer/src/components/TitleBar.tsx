import { useAppStore } from '@renderer/stores/useAppStore';
import { Button } from '@renderer/components/ui/button';
import { BrandLogo } from '@renderer/components/BrandLogo';
import {
  Minus, 
  Square, 
  X, 
  FolderOpen, 
  Github, 
  FileArchive,
  Sparkles,
  Moon,
  Sun,
  FileOutput,
  SaveAll
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function TitleBar() {
  const [showNewMenu, setShowNewMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { 
    theme, 
    toggleTheme, 
    setIsLoading, 
    setLoadingMessage,
    setProject,
    setFileTree,
    addToast,
    projectName,
    projectPath,
    openFiles,
    saveFile,
    exportProject,
  } = useAppStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowNewMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenFolder = async () => {
    setShowNewMenu(false);
    try {
      const result = await window.electronAPI.file.selectFolder();
      if (result.filePaths && result.filePaths.length > 0) {
        const path = result.filePaths[0];
        setLoadingMessage('Loading project...');
        setIsLoading(true);
        const tree = await window.electronAPI.file.readDirectory(path);
        const name = path.split(/[\\/]/).pop() || 'Project';
        setProject(path, name);
        setFileTree(tree);
        addToast({
          type: 'success',
          title: 'Project Loaded',
          message: `Loaded ${name} successfully`,
        });
      }
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to open folder',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenZip = async () => {
    setShowNewMenu(false);
    try {
      const result = await window.electronAPI.file.openDialog();
      if (result.filePaths && result.filePaths.length > 0) {
        const zipPath = result.filePaths[0];
        setLoadingMessage('Extracting ZIP...');
        setIsLoading(true);
        const extractPath = await window.electronAPI.file.extractZip(zipPath);
        const tree = await window.electronAPI.file.readDirectory(extractPath);
        const name = zipPath.split(/[\\/]/).pop()?.replace('.zip', '') || 'Project';
        setProject(extractPath, name);
        setFileTree(tree);
        addToast({
          type: 'success',
          title: 'ZIP Extracted',
          message: `Extracted ${name} successfully`,
        });
      }
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to extract ZIP file',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloneGitHub = () => {
    setShowNewMenu(false);
    window.dispatchEvent(new CustomEvent('open-github-clone-dialog', {
      bubbles: true,
      cancelable: true,
      detail: { timestamp: Date.now() }
    }));
  };

  const handlePublishToGitHub = () => {
    setShowNewMenu(false);
    window.dispatchEvent(new CustomEvent('open-github-panel', {
      bubbles: true,
      cancelable: true,
      detail: { tab: 'publish', timestamp: Date.now() }
    }));
  };

  const handleSaveAll = async () => {
    setShowNewMenu(false);
    const modifiedFiles = openFiles.filter(f => f.isModified);
    
    if (modifiedFiles.length === 0) {
      addToast({
        type: 'info',
        title: 'No Changes',
        message: 'No modified files to save',
      });
      return;
    }

    try {
      for (const file of modifiedFiles) {
        await saveFile(file.path);
      }
      addToast({
        type: 'success',
        title: 'All Saved',
        message: `Saved ${modifiedFiles.length} file(s)`,
      });
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: error.message || 'Failed to save some files',
      });
    }
  };

  const handleExportProject = async () => {
    setShowNewMenu(false);
    
    if (!projectPath || openFiles.length === 0) {
      addToast({
        type: 'warning',
        title: 'No Project',
        message: 'Open a project first to export',
      });
      return;
    }

    try {
      setLoadingMessage('Exporting project...');
      setIsLoading(true);

      const result = await window.electronAPI.file.selectFolder();
      
      if (!result.filePaths || result.filePaths.length === 0) {
        setIsLoading(false);
        return;
      }

      const selectedPath = result.filePaths[0];
      const folderName = projectName || 'exported-project';
      const finalExportPath = `${selectedPath}/${folderName}`;

      await exportProject(finalExportPath);

    } catch (error: any) {
      console.error('Export error:', error);
    } finally {
      setIsLoading(false);
    }
  };

 return (
    <div 
      className="flex items-center justify-between h-10 px-4 bg-card/80 backdrop-blur-md border-b border-border select-none relative z-50"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
       <div className="flex items-center gap-2">
  {/* Custom SVG brand mark. */}
  <div className="w-6 h-6 rounded flex items-center justify-center">
    <BrandLogo className="w-6 h-6 text-foreground" />
  </div>
  <span className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground to-foreground/70">
    Kivode+
  </span>
</div>
        <div className="h-5 w-px bg-border mx-2" />

        <div className="relative" ref={menuRef}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs hover:bg-primary/10 text-foreground"
            onClick={() => setShowNewMenu(!showNewMenu)}
          >
            File
          </Button>
          
          <AnimatePresence>
            {showNewMenu && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="fixed w-56 bg-popover/95 border border-border/50 rounded-xl shadow-2xl py-1 z-[99999] backdrop-blur-xl"
                style={{ 
                  top: '40px',
                  left: '120px'
                }}
              >
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-primary/10 flex items-center gap-2 transition-colors rounded-lg mx-1 w-[calc(100%-8px)] text-foreground"
                  onClick={handleOpenFolder}
                >
                  <FolderOpen className="w-4 h-4 text-foreground/80" />
                  Open Folder
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-primary/10 flex items-center gap-2 transition-colors rounded-lg mx-1 w-[calc(100%-8px)] text-foreground"
                  onClick={handleOpenZip}
                >
                  <FileArchive className="w-4 h-4 text-foreground/80" />
                  Open ZIP
                </button>
                <div className="h-px bg-border my-1 mx-2" />
                
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-primary/10 flex items-center gap-2 transition-colors rounded-lg mx-1 w-[calc(100%-8px)] text-foreground"
                  onClick={handleCloneGitHub}
                  type="button"
                >
                  <Github className="w-4 h-4 text-foreground/80" />
                  Clone from GitHub
                </button>
                
                <div className="h-px bg-border my-1 mx-2" />

                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-primary/10 flex items-center gap-2 transition-colors disabled:opacity-50 rounded-lg mx-1 w-[calc(100%-8px)] text-foreground"
                  onClick={handlePublishToGitHub}
                  disabled={!projectPath}
                >
                  <Github className="w-4 h-4 text-foreground/80" />
                  Publish Project to GitHub
                </button>

                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-primary/10 flex items-center gap-2 transition-colors disabled:opacity-50 rounded-lg mx-1 w-[calc(100%-8px)] text-foreground"
                  onClick={handleSaveAll}
                  disabled={!openFiles.some(f => f.isModified)}
                >
                  <SaveAll className="w-4 h-4 text-foreground/80" />
                  Save All
                  {openFiles.some(f => f.isModified) && (
                    <span className="ml-auto text-xs bg-primary text-primary-foreground px-1.5 rounded-full">
                      {openFiles.filter(f => f.isModified).length}
                    </span>
                  )}
                </button>

                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-primary/10 flex items-center gap-2 transition-colors text-primary rounded-lg mx-1 w-[calc(100%-8px)]"
                  onClick={handleExportProject}
                  disabled={!projectPath}
                >
                  <FileOutput className="w-4 h-4" />
                  Export Project...
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="absolute left-1/2 transform -translate-x-1/2 text-sm text-muted-foreground pointer-events-none">
        {projectName || 'No Project Open'}
      </div>

      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-primary/10" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
        <div className="h-5 w-px bg-border mx-1" />
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted" onClick={() => window.electronAPI.window.minimize()}>
          <Minus className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted" onClick={() => window.electronAPI.window.maximize()}>
          <Square className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive hover:text-destructive-foreground" onClick={() => window.electronAPI.window.close()}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
