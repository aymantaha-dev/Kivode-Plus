import { BrandLogo } from '@renderer/components/BrandLogo';
// WelcomeScreen.tsx - updated implementation.
import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@renderer/stores/useAppStore';
import { Button } from '@renderer/components/ui/button';
import { motion } from 'framer-motion';
import { cn } from '@renderer/utils/helpers';
import { Github } from 'lucide-react';
import { 
  FolderOpen, 
  FileArchive, 
  Sparkles,
  Code2,
  Zap,
  Shield,
  Globe,
  Cpu,
  BookOpen,
  ChevronRight,
  Layers,
  Upload
} from 'lucide-react';

// Provider logos rendered as SVG components.
const OpenAIIcon = () => (
  <svg fill="currentColor" fillRule="evenodd" height="1em" style={{flex:'none', lineHeight:1}} viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg">
    <title>OpenAI</title>
    <path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z"></path>
  </svg>
);

const AnthropicIcon = () => (
  <svg fill="currentColor" fillRule="evenodd" height="1em" style={{flex:'none', lineHeight:1}} viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg">
    <title>Anthropic</title>
    <path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z"></path>
  </svg>
);

const GoogleIcon = () => (
  <svg fill="currentColor" fillRule="evenodd" height="1em" style={{flex:'none', lineHeight:1}} viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg">
    <title>Google</title>
    <path d="M23 12.245c0-.905-.075-1.565-.236-2.25h-10.54v4.083h6.186c-.124 1.014-.797 2.542-2.294 3.569l-.021.136 3.332 2.53.23.022C21.779 18.417 23 15.593 23 12.245z"></path>
    <path d="M12.225 23c3.03 0 5.574-.978 7.433-2.665l-3.542-2.688c-.948.648-2.22 1.1-3.891 1.1a6.745 6.745 0 01-6.386-4.572l-.132.011-3.465 2.628-.045.124C4.043 20.531 7.835 23 12.225 23z"></path>
    <path d="M5.84 14.175A6.65 6.65 0 015.463 12c0-.758.138-1.491.361-2.175l-.006-.147-3.508-2.67-.115.054A10.831 10.831 0 001 12c0 1.772.436 3.447 1.197 4.938l3.642-2.763z"></path>
    <path d="M12.225 5.253c2.108 0 3.529.892 4.34 1.638l3.167-3.031C17.787 2.088 15.255 1 12.225 1 7.834 1 4.043 3.469 2.197 7.062l3.63 2.763a6.77 6.77 0 016.398-4.572z"></path>
  </svg>
);

const DeepSeekIcon = () => (
  <svg fill="currentColor" fillRule="evenodd" height="1em" style={{flex:'none', lineHeight:1}} viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg">
    <title>DeepSeek</title>
    <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z"></path>
  </svg>
);

const MoonshotIcon = () => (
  <svg fill="currentColor" fillRule="evenodd" height="1em" style={{flex:'none', lineHeight:1}} viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg">
    <title>Kimi</title>
    <path d="M21.846 0a1.923 1.923 0 110 3.846H20.15a.226.226 0 01-.227-.226V1.923C19.923.861 20.784 0 21.846 0z"></path>
    <path d="M11.065 11.199l7.257-7.2c.137-.136.06-.41-.116-.41H14.3a.164.164 0 00-.117.051l-7.82 7.756c-.122.12-.302.013-.302-.179V3.82c0-.127-.083-.23-.185-.23H3.186c-.103 0-.186.103-.186.23V19.77c0 .128.083.23.186.23h2.69c.103 0 .186-.102.186-.23v-3.25c0-.069.025-.135.069-.178l2.424-2.406a.158.158 0 01.205-.023l6.484 4.772a7.677 7.677 0 003.453 1.283c.108.012.2-.095.2-.23v-3.06c0-.117-.07-.212-.164-.227a5.028 5.028 0 01-2.027-.807l-5.613-4.064c-.117-.078-.132-.279-.028-.381z"></path>
  </svg>
);

const features = [
  {
    icon: Code2,
    title: 'Multi-Language Support',
    description: 'JavaScript, TypeScript, Python, Java, C#, C++, SQL, and more',
  },
  {
    icon: Zap,
    title: 'AI-Powered Coding',
    description: 'Generate, modify, review, and explain code with advanced AI models',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    description: 'Your API keys are stored locally. Code never leaves your machine.',
  },
  {
    icon: Globe,
    title: 'GitHub Integration',
    description: 'Clone repositories directly and start coding immediately',
  },
];

// Curated model catalog for current major provider releases.
const models = [
  { name: 'GPT-5.2', Icon: OpenAIIcon, color: 'from-emerald-500 to-teal-600', provider: 'openai' },
  { name: 'GPT-5.1', Icon: OpenAIIcon, color: 'from-emerald-500 to-teal-600', provider: 'openai' },
  { name: 'GPT-5', Icon: OpenAIIcon, color: 'from-emerald-500 to-teal-600', provider: 'openai' },
  { name: 'GPT-4.1', Icon: OpenAIIcon, color: 'from-emerald-400 to-teal-500', provider: 'openai' },
  { name: 'GPT-4.1 Mini', Icon: OpenAIIcon, color: 'from-emerald-400 to-teal-500', provider: 'openai' },
  { name: 'Claude Opus 4.5', Icon: AnthropicIcon, color: 'from-orange-500 to-amber-600', provider: 'anthropic' },
  { name: 'Claude Sonnet 4.5', Icon: AnthropicIcon, color: 'from-orange-500 to-amber-600', provider: 'anthropic' },
  { name: 'Claude Haiku 4.5', Icon: AnthropicIcon, color: 'from-orange-400 to-amber-500', provider: 'anthropic' },
  { name: 'Kimi K2.5', Icon: MoonshotIcon, color: 'from-violet-500 to-purple-600', provider: 'moonshot' },
  { name: 'Kimi K2', Icon: MoonshotIcon, color: 'from-violet-500 to-purple-600', provider: 'moonshot' },
  { name: 'Kimi K1.5', Icon: MoonshotIcon, color: 'from-violet-400 to-purple-500', provider: 'moonshot' },
  { name: 'DeepSeek-V3.5', Icon: DeepSeekIcon, color: 'from-blue-500 to-cyan-600', provider: 'deepseek' },
  { name: 'DeepSeek-Coder V2', Icon: DeepSeekIcon, color: 'from-blue-500 to-cyan-600', provider: 'deepseek' },
  { name: 'DeepSeek Chat', Icon: DeepSeekIcon, color: 'from-blue-400 to-cyan-500', provider: 'deepseek' },
  { name: 'Gemini 3.0 Pro', Icon: GoogleIcon, color: 'from-rose-500 to-pink-600', provider: 'google' },
  { name: 'Gemini 3.0 Flash', Icon: GoogleIcon, color: 'from-rose-500 to-pink-600', provider: 'google' },
];

export function WelcomeScreen() {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  
  const { 
    setIsLoading, 
    setLoadingMessage, 
    setProject, 
    setFileTree, 
    addToast 
  } = useAppStore();

  const handleOpenFolder = async () => {
    try {
      if (!window.electronAPI?.file?.selectFolder) {
        addToast({
          type: 'error',
          title: 'Error',
          message: 'File API not available',
        });
        return;
      }

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
      console.error('Failed to open folder:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to open folder',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenZip = async () => {
    try {
      if (!window.electronAPI?.file?.openDialog) {
        addToast({
          type: 'error',
          title: 'Error',
          message: 'File API not available',
        });
        return;
      }

      const result = await window.electronAPI.file.openDialog({
        filters: [{ name: 'ZIP files', extensions: ['zip'] }]
      });
      
      if (result.filePaths && result.filePaths.length > 0) {
        await processZipFile(result.filePaths[0]);
      }
    } catch (error: any) {
      console.error('Failed to open ZIP:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to open ZIP file',
      });
    }
  };

  const processZipFile = async (zipPath: string) => {
    try {
      setLoadingMessage('Extracting ZIP...');
      setIsLoading(true);

      if (!window.electronAPI?.file?.extractZip) {
        throw new Error('Extract ZIP API not available');
      }

      const extractPath = await window.electronAPI.file.extractZip(zipPath);
      const tree = await window.electronAPI.file.readDirectory(extractPath);
      const name = zipPath.split(/[\\/]/).pop()?.replace(/\.zip$/i, '') || 'Project';
      
      setProject(extractPath, name);
      setFileTree(tree);
      
      addToast({
        type: 'success',
        title: 'ZIP Extracted',
        message: `Extracted ${name} successfully`,
      });
    } catch (error: any) {
      console.error('Failed to process ZIP:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to extract ZIP file',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!window.electronAPI?.dragDrop?.onDrop) {
      console.warn('Drag & Drop API not available');
      return;
    }

    const handleDrop = async (filePath: string) => {
      console.log('File dropped:', filePath);
      
      if (!filePath.toLowerCase().endsWith('.zip')) {
        addToast({
          type: 'warning',
          title: 'Invalid File',
          message: 'Please drop a ZIP file only',
        });
        return;
      }

      try {
        await processZipFile(filePath);
      } catch (error) {
        console.error('Failed to process dropped file:', error);
      }
    };

    window.electronAPI.dragDrop.onDrop(handleDrop);

    return () => {
      window.electronAPI?.dragDrop?.removeListener?.();
    };
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => {
      const newCount = prev - 1;
      if (newCount <= 0) {
        setIsDragging(false);
        return 0;
      }
      return newCount;
    });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    if (!window.electronAPI?.file?.extractZip) {
      const files = Array.from(e.dataTransfer.files);
      const zipFile = files.find(f => f.name.toLowerCase().endsWith('.zip'));
      
      if (!zipFile) {
        addToast({
          type: 'warning',
          title: 'Invalid File',
          message: 'Please drop a ZIP file only',
        });
        return;
      }

      try {
        const JSZip = await import('jszip');
        const zip = await JSZip.default.loadAsync(zipFile);
        
        console.log('ZIP contents:', Object.keys(zip.files));
        
        addToast({
          type: 'info',
          title: 'Browser Mode',
          message: 'ZIP processing requires Electron environment',
        });
      } catch (error) {
        console.error('Browser ZIP processing failed:', error);
      }
      return;
    }

    console.log('Drop handled by Electron IPC');
  }, []);

  return (
    <div 
      className={cn(
        "flex flex-col h-full overflow-auto relative",
        isDragging && "bg-primary/5"
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/5 to-transparent rounded-full" />
      </div>

      <div className="flex flex-col items-center justify-center py-16 px-4 text-center relative z-10">
       <motion.div
  initial={{ opacity: 0, scale: 0.5 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.5, type: "spring" }}
  className="mb-8"
>
  <div className="relative group">
    <div className="absolute -inset-1 bg-primary/15 rounded-full blur-lg" />
    <div className="relative w-32 h-32 flex items-center justify-center">
      <BrandLogo className="w-28 h-28 text-primary drop-shadow-2xl" />
    </div>
  </div>
</motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-2 mb-6"
        >
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground to-foreground/70">
              Kivode+
            </span>
          </h1>
          <h2 className="text-3xl md:text-4xl font-light text-muted-foreground">
            Code Master
          </h2>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg text-muted-foreground max-w-2xl mb-10 leading-relaxed"
        >
          The ultimate AI-powered code editor. Generate, modify, and review code 
          with the world's most advanced AI models.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap justify-center gap-4 mb-12"
        >
          <Button
            size="lg"
            className="gap-2 h-12 px-8 text-base bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 group"
            onClick={handleOpenFolder}
          >
            <FolderOpen className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Open Folder
            <ChevronRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="gap-2 h-12 px-8 text-base border-2 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300 group"
            onClick={handleOpenZip}
          >
            <FileArchive className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Open ZIP
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="gap-2 h-12 px-8 text-base border-2 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300 group"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-github-panel'));
            }}
          >
            <Github className="w-5 h-5 group-hover:scale-110 transition-transform" />
            GitHub Integration
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={cn(
            "w-full max-w-lg p-8 rounded-2xl border-2 border-dashed transition-all duration-300 backdrop-blur-sm cursor-pointer",
            isDragging 
              ? "border-primary bg-primary/10 scale-105 shadow-lg shadow-primary/25" 
              : "border-border/50 bg-card/30 hover:bg-card/50 hover:border-primary/30"
          )}
          onClick={handleOpenZip}
        >
          <input
            type="file"
            accept=".zip"
            className="hidden"
            id="zip-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && window.electronAPI?.file?.extractZip) {
                const path = (file as any).path;
                if (path) {
                  processZipFile(path);
                }
              }
            }}
          />
          <label htmlFor="zip-input" className="cursor-pointer block">
            <div className={cn(
              "w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center transition-all duration-300",
              isDragging ? "bg-primary/20 scale-110" : "bg-primary/10"
            )}>
              {isDragging ? (
                <Upload className="w-8 h-8 text-primary animate-bounce" />
              ) : (
                <Layers className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <p className="text-base font-medium mb-1">
              {isDragging ? 'Drop ZIP file here' : 'Drag & drop a ZIP file'}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse
            </p>
          </label>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="px-4 py-16 relative z-10"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-semibold mb-2">Powered by Advanced AI</h2>
            <div className="w-20 h-1 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto rounded-full" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="group p-6 rounded-2xl bg-card/50 border border-border/50 hover:border-primary/30 hover:bg-card/80 transition-all duration-300 backdrop-blur-sm"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:from-primary/30 group-hover:to-primary/10 transition-all duration-300">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="px-4 py-12 relative z-10"
      >
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold mb-2">Supported AI Models</h2>
            <div className="w-20 h-1 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto rounded-full" />
          </div>
          
          <div className="flex flex-wrap justify-center gap-4">
            {models.map((model, index) => {
              const ModelIcon = model.Icon;
              return (
                <motion.div
                  key={model.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1 + index * 0.05 }}
                  className="group flex items-center gap-3 px-5 py-3 rounded-full bg-card/50 border border-border/50 hover:border-primary/30 hover:bg-card/80 transition-all duration-300 backdrop-blur-sm"
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-lg text-white",
                    model.color
                  )}>
                    <ModelIcon />
                  </div>
                  <span className="text-sm font-medium">{model.name}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      <div className="mt-auto py-8 text-center text-sm text-muted-foreground/60 border-t border-border/30 relative z-10 backdrop-blur-sm">
        <p>Kivode+ v1.1.0 • Built with Electron + React + Love</p>
      </div>
    </div>
  );
}
