// src/main/services/GitHubManager.ts

import * as path from 'path';
import * as fs from 'fs';
import simpleGit from 'simple-git';
import { GitHubService } from './GitHubService';

export interface CloneResult {
  success: boolean;
  path: string;
  message: string;
}

export interface EditingSession {
  owner: string;
  repo: string;
  localPath: string;
  workingBranch: string;
  originalBranch: string;
}

export interface GitWorkspaceStatus {
  branch: string;
  tracking: string | null;
  ahead: number;
  behind: number;
  staged: number;
  unstaged: number;
  untracked: number;
  changedFiles: string[];
  recentCommits: Array<{ sha: string; message: string; author: string; date: string }>;
}

export class GitHubManager {
  private git: ReturnType<typeof simpleGit>;
  private service: GitHubService;
  private currentSession: EditingSession | null = null;

  constructor() {
    this.git = simpleGit();
    this.service = new GitHubService();
  }

  // Proxy methods to GitHubService
  get serviceAPI() {
    return this.service;
  }

  isAuthenticated(): boolean {
    return this.service.isAuthenticated();
  }

  getCurrentUser() {
    return this.service.getCurrentUser();
  }

  getAuthStatus() {
    return this.service.getAuthStatus();
  }

  async setAccessToken(token: string): Promise<void> {
    await this.service.setAccessToken(token);
  }

  async getRepositories() {
    return this.service.getRepositories();
  }

  async getRepository(owner: string, repo: string) {
    return this.service.getRepository(owner, repo);
  }

  async analyzeRepository(owner: string, repo: string) {
    return this.service.analyzeRepository(owner, repo);
  }

  async getRepositoryReadme(owner: string, repo: string) {
    return this.service.getRepositoryReadme(owner, repo);
  }

  async validateUrl(url: string): Promise<boolean> {
    const normalized = url.trim();

    if (/^git@github\.com:[^/]+\/.+(\.git)?$/i.test(normalized)) {
      return true;
    }

    try {
      const parsed = new URL(normalized);
      const validHost = parsed.hostname.toLowerCase() === 'github.com';
      const segments = parsed.pathname.split('/').filter(Boolean);
      return validHost && segments.length >= 2;
    } catch {
      return false;
    }
  }

  async cloneRepository(url: string, targetPath: string): Promise<CloneResult> {
    try {
      if (!await this.validateUrl(url)) {
        return {
          success: false,
          path: '',
          message: 'Invalid GitHub URL format',
        };
      }

      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
      }

      const repoName = this.extractRepoName(url);
      const clonePath = path.join(targetPath, repoName);

      if (fs.existsSync(clonePath)) {
        const git = simpleGit(clonePath);
        const isRepo = await git.checkIsRepo();
        
        if (isRepo) {
          await git.pull();
          return {
            success: true,
            path: clonePath,
            message: 'Repository updated successfully',
          };
        } else {
          return {
            success: false,
            path: '',
            message: 'Directory exists but is not a git repository',
          };
        }
      }

      if (this.service.isAuthenticated()) {
        try {
          await this.service.cloneRepositoryWithAuth(url, clonePath);
        } catch (error: any) {
          const authMessage = String(error?.message || '').toLowerCase();
          if (authMessage.includes('authentication failed') || authMessage.includes('invalid credentials')) {
            await this.git.clone(url, clonePath);
          } else {
            throw error;
          }
        }
      } else {
        await this.git.clone(url, clonePath);
      }

      return {
        success: true,
        path: clonePath,
        message: 'Repository cloned successfully',
      };
    } catch (error: any) {
      console.error('Error cloning repository:', error);
      return {
        success: false,
        path: '',
        message: `Failed to clone repository: ${error.message}`,
      };
    }
  }

  async startEditingSession(owner: string, repo: string): Promise<boolean> {
    try {
      const repoInfo = await this.service.getRepository(owner, repo);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const workingBranch = `kivode-edit-${timestamp}`;

      const tempDir = path.join(process.env.TEMP || '/tmp', 'kivode-repos', `${owner}-${repo}-${timestamp}`);

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const cloneResult = await this.cloneRepository(repoInfo.cloneUrl, tempDir);
      if (!cloneResult.success || !cloneResult.path) {
        throw new Error(cloneResult.message || 'Unable to clone repository for editing');
      }

      const repoGit = simpleGit(cloneResult.path);
      await repoGit.fetch();
      await repoGit.checkout(repoInfo.defaultBranch);
      await repoGit.checkoutLocalBranch(workingBranch);
      await repoGit.push(['-u', 'origin', workingBranch]);

      this.currentSession = {
        owner,
        repo,
        localPath: cloneResult.path,
        workingBranch,
        originalBranch: repoInfo.defaultBranch,
      };

      return true;
    } catch (error) {
      console.error('Failed to start editing session:', error);
      return false;
    }
  }


  getCurrentSession(): EditingSession | null {
    return this.currentSession;
  }

  async saveChanges(commitMessage?: string): Promise<{ success: boolean; prUrl?: string }> {
    if (!this.currentSession) {
      throw new Error('No active editing session');
    }

    const { owner, repo, workingBranch, originalBranch } = this.currentSession;

    try {
      const message = commitMessage || 'Update files via Kivode+';

      await this.service.commitChanges(owner, repo, {
        message,
        branch: workingBranch,
      });

      const pr = await this.service.createPullRequest(owner, repo, {
        title: `Kivode+: ${message}`,
        body: `Changes made via Kivode+\n\n**Original Branch:** ${originalBranch}\n**Working Branch:** ${workingBranch}`,
        head: workingBranch,
        base: originalBranch,
      });

      return {
        success: true,
        prUrl: pr.url,
      };
    } catch (error) {
      console.error('Failed to save changes:', error);
      return { success: false };
    }
  }

  async checkSyncStatus(): Promise<{
    canPush: boolean;
    warning?: string;
    behindBy: number;
  }> {
    if (!this.currentSession) {
      throw new Error('No active editing session');
    }

    const { owner, repo, workingBranch } = this.currentSession;
    
    const syncStatus = await this.service.syncWithRemote(owner, repo, workingBranch);
    
    return {
      canPush: !syncStatus.hasConflicts && syncStatus.behindBy === 0,
      warning: syncStatus.hasConflicts 
        ? 'There are conflicts with remote. Please resolve manually.'
        : syncStatus.behindBy > 0 
        ? `Your branch is ${syncStatus.behindBy} commits behind. Pull changes first.`
        : undefined,
      behindBy: syncStatus.behindBy,
    };
  }

  async endSession(): Promise<void> {
    this.currentSession = null;
  }

  async publishRepository(name: string, description: string, isPrivate: boolean, localPath: string, options?: any) {
    return this.service.publishRepository(name, description, isPrivate, localPath, options);
  }

  async getLocalRepositoryTarget(localPath: string) {
    return this.service.getLocalRepositoryTarget(localPath);
  }

  async getWorkspaceStatus(localPath: string): Promise<GitWorkspaceStatus> {
    const git = simpleGit(localPath);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new Error('Selected project is not a git repository');
    }

    const status = await git.status();
    const recent = await git.log({ maxCount: 6 });

    return {
      branch: status.current || 'unknown',
      tracking: status.tracking || null,
      ahead: status.ahead,
      behind: status.behind,
      staged: status.staged.length,
      unstaged: status.modified.length + status.deleted.length + status.renamed.length,
      untracked: status.not_added.length,
      changedFiles: [
        ...status.created,
        ...status.modified,
        ...status.deleted,
        ...status.renamed.map((entry) => (typeof entry === 'string' ? entry : `${entry.from} → ${entry.to}`)),
        ...status.not_added,
      ],
      recentCommits: recent.all.map((commit) => ({
        sha: commit.hash.slice(0, 7),
        message: commit.message,
        author: commit.author_name,
        date: commit.date,
      })),
    };
  }

  async createLocalBranch(localPath: string, branchName: string, checkout = true): Promise<{ branch: string }> {
    const git = simpleGit(localPath);
    if (!await git.checkIsRepo()) {
      throw new Error('Selected project is not a git repository');
    }

    const cleanBranch = branchName.trim();
    if (!cleanBranch) {
      throw new Error('Branch name is required');
    }

    const previous = (await git.status()).current;
    await git.checkoutLocalBranch(cleanBranch);
    if (!checkout) {
      if (previous && previous !== cleanBranch) {
        await git.checkout(previous);
      }
    }

    return { branch: cleanBranch };
  }

  async mergeLocalBranches(localPath: string, sourceBranch: string, targetBranch: string): Promise<{ success: boolean; message: string }> {
    const git = simpleGit(localPath);
    if (!await git.checkIsRepo()) {
      throw new Error('Selected project is not a git repository');
    }

    await git.fetch();
    await git.checkout(targetBranch);
    await git.pull('origin', targetBranch);
    await git.merge([sourceBranch]);
    await git.push('origin', targetBranch);

    return { success: true, message: `Merged ${sourceBranch} into ${targetBranch}` };
  }

  async createPullRequestFromLocal(localPath: string, base: string, head: string, title: string, body?: string) {
    const target = await this.service.getLocalRepositoryTarget(localPath);
    if (!target.isGitHubOrigin || !target.fullName) {
      throw new Error('No GitHub origin was detected for this project');
    }

    const [owner, repo] = target.fullName.split('/');
    if (!owner || !repo) {
      throw new Error('Unable to read owner/repository from remote origin');
    }

    return this.service.createPullRequest(owner, repo, {
      title,
      body: body || `Pull request generated via Kivode+\n\nBase: ${base}\nHead: ${head}`,
      base,
      head,
    });
  }

  async logout(): Promise<void> {
    await this.service.logout();
    this.currentSession = null;
  }

  private extractRepoName(url: string): string {
    const cleanUrl = url.replace(/\.git$/, '');
    const parts = cleanUrl.split('/');
    return parts[parts.length - 1];
  }
}
