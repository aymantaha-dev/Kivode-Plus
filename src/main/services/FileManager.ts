import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import JSZip from 'jszip';

export type AccessPolicy = (targetPath: string) => void;

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified: Date;
  language?: string;
  children?: FileNode[];
}

export class FileManager {
  private tempDir: string;
  private readonly assertAllowed: AccessPolicy;

  constructor(assertAllowed: AccessPolicy = () => undefined) {
    this.assertAllowed = assertAllowed;
    this.tempDir = path.join(require('os').tmpdir(), 'kivode-plus');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async extractZip(zipPath: string, extractPath?: string): Promise<string> {
    try {
      const targetPath = extractPath || path.join(this.tempDir, `extracted_${Date.now()}`);
      
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }

      const zip = new AdmZip(zipPath);
      zip.extractAllTo(targetPath, true);

      return targetPath;
    } catch (error: any) {
      console.error('Error extracting ZIP:', error);
      throw new Error(`Failed to extract ZIP: ${error.message}`);
    }
  }

  async createZip(sourcePath: string, outputPath: string): Promise<string> {
    this.assertAllowed(sourcePath);
    this.assertAllowed(outputPath);
    try {
      const zip = new JSZip();
      await this.addFolderToZip(zip, sourcePath, '');
      
      const content = await zip.generateAsync({ type: 'nodebuffer' });
      fs.writeFileSync(outputPath, content);
      
      return outputPath;
    } catch (error: any) {
      console.error('Error creating ZIP:', error);
      throw new Error(`Failed to create ZIP: ${error.message}`);
    }
  }

  private async addFolderToZip(zip: JSZip, folderPath: string, zipPath: string): Promise<void> {
    const items = fs.readdirSync(folderPath);
    
    for (const item of items) {
      const fullPath = path.join(folderPath, item);
      const itemZipPath = zipPath ? `${zipPath}/${item}` : item;
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        const folder = zip.folder(itemZipPath);
        if (folder) {
          await this.addFolderToZip(folder as unknown as JSZip, fullPath, itemZipPath);
        }
      } else {
        const content = fs.readFileSync(fullPath);
        zip.file(itemZipPath, content);
      }
    }
  }

  async readFile(filePath: string): Promise<string> {
    this.assertAllowed(filePath);
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error: any) {
      console.error('Error reading file:', error);
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    this.assertAllowed(filePath);
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content, 'utf-8');
    } catch (error: any) {
      console.error('Error writing file:', error);
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  async readDirectory(dirPath: string): Promise<FileNode[]> {
    this.assertAllowed(dirPath);
    try {
      const items = fs.readdirSync(dirPath);
      const nodes: FileNode[] = [];

      for (const item of items) {
        // Skip hidden files and node_modules
        if (item.startsWith('.') || item === 'node_modules' || item === '__pycache__') {
          continue;
        }

        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);

        const node: FileNode = {
          name: item,
          path: fullPath,
          type: stat.isDirectory() ? 'directory' : 'file',
          lastModified: stat.mtime,
        };

        if (stat.isFile()) {
          node.size = stat.size;
          node.language = this.detectLanguage(item);
        } else {
          try {
            node.children = await this.readDirectory(fullPath);
          } catch (e) {
            node.children = [];
          }
        }

        nodes.push(node);
      }

      // Sort: directories first, then files
      return nodes.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'directory' ? -1 : 1;
      });
    } catch (error: any) {
      console.error('Error reading directory:', error);
      throw new Error(`Failed to read directory: ${error.message}`);
    }
  }

  async createDirectory(dirPath: string): Promise<void> {
    this.assertAllowed(dirPath);
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (error: any) {
      console.error('Error creating directory:', error);
      throw new Error(`Failed to create directory: ${error.message}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    this.assertAllowed(filePath);
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        fs.rmSync(filePath, { recursive: true });
      } else {
        fs.unlinkSync(filePath);
      }
    } catch (error: any) {
      console.error('Error deleting file:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    this.assertAllowed(oldPath);
    this.assertAllowed(newPath);
    try {
      fs.renameSync(oldPath, newPath);
    } catch (error: any) {
      console.error('Error renaming file:', error);
      throw new Error(`Failed to rename file: ${error.message}`);
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    return fs.existsSync(filePath);
  }

  async getFileStats(filePath: string): Promise<fs.Stats> {
    return fs.statSync(filePath);
  }

  detectLanguage(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const languageMap: { [key: string]: string } = {
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.py': 'python',
      '.java': 'java',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.sql': 'sql',
      '.sh': 'shell',
      '.bash': 'shell',
      '.zsh': 'shell',
      '.ps1': 'powershell',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.dart': 'dart',
      '.vue': 'vue',
      '.svelte': 'svelte',
      '.dockerfile': 'dockerfile',
      '.gitignore': 'gitignore',
    };

    return languageMap[ext] || 'plaintext';
  }

  getTempDir(): string {
    return this.tempDir;
  }

  async cleanup(): Promise<void> {
    try {
      if (fs.existsSync(this.tempDir)) {
        fs.rmSync(this.tempDir, { recursive: true });
      }
    } catch (error) {
      console.error('Error cleaning up temp directory:', error);
    }
  }
}