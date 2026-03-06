import * as fs from 'fs';
import * as path from 'path';

export interface ProjectMetrics {
  totalFiles: number;
  totalLines: number;
  totalSize: number;
  languages: { [key: string]: number };
  fileTypes: { [key: string]: number };
  complexity: {
    averageComplexity: number;
    maxComplexity: number;
    functions: number;
    classes: number;
  };
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'production' | 'development' | 'optional';
}

export interface ProjectStructure {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: ProjectStructure[];
}

export class ProjectAnalyzer {
  private languagePatterns: { [key: string]: RegExp };

  constructor() {
    this.languagePatterns = {
      javascript: /\.jsx?$/,
      typescript: /\.tsx?$/,
      python: /\.py$/,
      java: /\.java$/,
      csharp: /\.cs$/,
      cpp: /\.(cpp|cc|cxx)$/,
      c: /\.(c|h)$/,
      html: /\.html?$/,
      css: /\.css$/,
      scss: /\.scss$/,
      json: /\.json$/,
      markdown: /\.md$/,
      sql: /\.sql$/,
      shell: /\.(sh|bash|zsh)$/,
      yaml: /\.(yaml|yml)$/,
      xml: /\.xml$/,
    };
  }

  async analyze(projectPath: string): Promise<{
    metrics: ProjectMetrics;
    structure: ProjectStructure;
    dependencies: DependencyInfo[];
  }> {
    const metrics = await this.getMetrics(projectPath);
    const structure = await this.getStructure(projectPath);
    const dependencies = await this.getDependencies(projectPath);

    return {
      metrics,
      structure,
      dependencies,
    };
  }

  async getMetrics(projectPath: string): Promise<ProjectMetrics> {
    const metrics: ProjectMetrics = {
      totalFiles: 0,
      totalLines: 0,
      totalSize: 0,
      languages: {},
      fileTypes: {},
      complexity: {
        averageComplexity: 0,
        maxComplexity: 0,
        functions: 0,
        classes: 0,
      },
    };

    await this.analyzeDirectory(projectPath, metrics);

    // Calculate average complexity
    if (metrics.complexity.functions > 0) {
      metrics.complexity.averageComplexity = 
        Math.round((metrics.complexity.maxComplexity / metrics.complexity.functions) * 100) / 100;
    }

    return metrics;
  }

  private async analyzeDirectory(dirPath: string, metrics: ProjectMetrics): Promise<void> {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      // Skip hidden files, node_modules, etc.
      if (item.startsWith('.') || 
          item === 'node_modules' || 
          item === '__pycache__' ||
          item === 'dist' ||
          item === 'build') {
        continue;
      }

      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        await this.analyzeDirectory(fullPath, metrics);
      } else {
        await this.analyzeFile(fullPath, stat, metrics);
      }
    }
  }

  private async analyzeFile(
    filePath: string, 
    stat: fs.Stats, 
    metrics: ProjectMetrics
  ): Promise<void> {
    metrics.totalFiles++;
    metrics.totalSize += stat.size;

    const ext = path.extname(filePath).toLowerCase();
    metrics.fileTypes[ext] = (metrics.fileTypes[ext] || 0) + 1;

    const language = this.detectLanguage(filePath);
    metrics.languages[language] = (metrics.languages[language] || 0) + 1;

    // Count lines for text files
    if (this.isTextFile(ext)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').length;
        metrics.totalLines += lines;

        // Analyze complexity for code files
        if (['javascript', 'typescript', 'python', 'java', 'csharp', 'cpp', 'c'].includes(language)) {
          this.analyzeComplexity(content, language, metrics);
        }
      } catch (e) {
        // Skip files that can't be read as text
      }
    }
  }

  private analyzeComplexity(content: string, language: string, metrics: ProjectMetrics): void {
    const patterns: { [key: string]: { function: RegExp; class: RegExp } } = {
      javascript: {
        function: /\b(function|const|let|var)\s+\w+\s*[=:]\s*(?:async\s*)?\([^)]*\)\s*=>|\bfunction\s+\w+\s*\(/g,
        class: /\bclass\s+\w+/g,
      },
      typescript: {
        function: /\b(function|const|let|var)\s+\w+\s*[=:]\s*(?:async\s*)?\([^)]*\)\s*=>|\bfunction\s+\w+\s*\(/g,
        class: /\bclass\s+\w+/g,
      },
      python: {
        function: /\bdef\s+\w+\s*\(/g,
        class: /\bclass\s+\w+/g,
      },
      java: {
        function: /\b(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*\{/g,
        class: /\bclass\s+\w+/g,
      },
      csharp: {
        function: /\b(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*\{/g,
        class: /\bclass\s+\w+/g,
      },
    };

    const pattern = patterns[language];
    if (pattern) {
      const functions = content.match(pattern.function) || [];
      const classes = content.match(pattern.class) || [];

      metrics.complexity.functions += functions.length;
      metrics.complexity.classes += classes.length;

      // Simple complexity estimation based on control structures
      const controlStructures = content.match(/\b(if|else|for|while|switch|case|catch)\b/g) || [];
      const fileComplexity = controlStructures.length;
      metrics.complexity.maxComplexity = Math.max(metrics.complexity.maxComplexity, fileComplexity);
    }
  }

  async getDependencies(projectPath: string): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];

    // Check for package.json (Node.js)
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        
        if (packageJson.dependencies) {
          Object.entries(packageJson.dependencies).forEach(([name, version]) => {
            dependencies.push({
              name,
              version: version as string,
              type: 'production',
            });
          });
        }

        if (packageJson.devDependencies) {
          Object.entries(packageJson.devDependencies).forEach(([name, version]) => {
            dependencies.push({
              name,
              version: version as string,
              type: 'development',
            });
          });
        }
      } catch (e) {
        console.error('Error parsing package.json:', e);
      }
    }

    // Check for requirements.txt (Python)
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    if (fs.existsSync(requirementsPath)) {
      try {
        const content = fs.readFileSync(requirementsPath, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach(line => {
          const match = line.match(/^([\w-]+)([<>=!~]+.+)?$/);
          if (match) {
            dependencies.push({
              name: match[1],
              version: match[2] || 'latest',
              type: 'production',
            });
          }
        });
      } catch (e) {
        console.error('Error parsing requirements.txt:', e);
      }
    }

    // Check for Gemfile (Ruby)
    const gemfilePath = path.join(projectPath, 'Gemfile');
    if (fs.existsSync(gemfilePath)) {
      try {
        const content = fs.readFileSync(gemfilePath, 'utf-8');
        const gemPattern = /gem\s+['"]([^'"]+)['"](?:\s*,\s*['"]([^'"]+)['"])?/g;
        let match;
        
        while ((match = gemPattern.exec(content)) !== null) {
          dependencies.push({
            name: match[1],
            version: match[2] || 'latest',
            type: 'production',
          });
        }
      } catch (e) {
        console.error('Error parsing Gemfile:', e);
      }
    }

    // Check for Cargo.toml (Rust)
    const cargoPath = path.join(projectPath, 'Cargo.toml');
    if (fs.existsSync(cargoPath)) {
      try {
        const content = fs.readFileSync(cargoPath, 'utf-8');
        const depPattern = /^([\w-]+)\s*=\s*["'](.+)["']/gm;
        let match;
        
        while ((match = depPattern.exec(content)) !== null) {
          dependencies.push({
            name: match[1],
            version: match[2],
            type: 'production',
          });
        }
      } catch (e) {
        console.error('Error parsing Cargo.toml:', e);
      }
    }

    return dependencies;
  }

  async getStructure(projectPath: string): Promise<ProjectStructure> {
    const name = path.basename(projectPath);
    
    return this.buildStructure(projectPath, name);
  }

  private async buildStructure(itemPath: string, name: string): Promise<ProjectStructure> {
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      // Skip certain directories
      if (name.startsWith('.') || 
          name === 'node_modules' || 
          name === '__pycache__' ||
          name === 'dist' ||
          name === 'build') {
        return {
          name,
          path: itemPath,
          type: 'directory',
          children: [],
        };
      }

      const items = fs.readdirSync(itemPath);
      const children: ProjectStructure[] = [];

      for (const item of items) {
        const childPath = path.join(itemPath, item);
        children.push(await this.buildStructure(childPath, item));
      }

      // Sort: directories first, then files
      children.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'directory' ? -1 : 1;
      });

      return {
        name,
        path: itemPath,
        type: 'directory',
        children,
      };
    } else {
      return {
        name,
        path: itemPath,
        type: 'file',
        size: stat.size,
      };
    }
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    for (const [language, pattern] of Object.entries(this.languagePatterns)) {
      if (pattern.test(ext)) {
        return language;
      }
    }

    return 'other';
  }

  private isTextFile(ext: string): boolean {
    const textExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cs', '.cpp', '.c', '.h', '.hpp',
      '.html', '.htm', '.css', '.scss', '.sass', '.less', '.json', '.xml', '.yaml', '.yml',
      '.md', '.txt', '.sql', '.sh', '.bash', '.zsh', '.ps1', '.php', '.rb', '.go', '.rs',
      '.swift', '.kt', '.dart', '.vue', '.svelte', '.dockerfile', '.gitignore',
    ];
    
    return textExtensions.includes(ext);
  }
}
