// src/main/services/GitHubService.ts

import { Octokit } from '@octokit/rest';
import { app, safeStorage } from 'electron';
import Store from 'electron-store';
import * as fs from 'fs';
import * as path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import crypto from 'crypto';

interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope: string;
}

interface RepositoryInfo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  stars: number;
  language: string | null;
  updatedAt: string | null;
  defaultBranch: string;
  size: number;
  htmlUrl: string;
  cloneUrl: string;
  topics: string[];
}

interface RepositoryAnalysis {
  totalFiles: number;
  languages: Record<string, number>;
  sizeInMB: number;
  defaultBranch: string;
  branchesCount: number;
  projectType: string;
  architecture: string;
}

interface CommitOptions {
  message: string;
  description?: string;
  branch?: string;
}

interface PullRequestOptions {
  title: string;
  body: string;
  head: string;
  base: string;
}

interface PublishRepositoryOptions {
  verifyUser?: boolean;
  addReadme?: boolean;
  gitignoreTemplate?: string;
  licenseTemplate?: string;
  targetMode?: 'create' | 'existing' | 'auto';
  existingRepoFullName?: string;
  branchName?: string;
  forcePush?: boolean;
  gitUserName?: string;
  gitUserEmail?: string;
  createPullRequest?: boolean;
  pullRequestBase?: string;
}

interface LocalRepositoryTarget {
  hasGit: boolean;
  hasOrigin: boolean;
  isGitHubOrigin: boolean;
  fullName: string | null;
  cloneUrl: string | null;
}

export class GitHubService {
  private octokit: Octokit | null = null;
  private store: Store<Record<string, string>>;
  private currentUser: { login: string; id: number; avatar: string } | null = null;
  private accessToken: string | null = null;
  private tokenScope: string = 'unknown';
  private readonly ENCRYPTION_KEY = 'github-auth-data';

  constructor() {
    this.store = new Store({
      name: 'github-auth',
      encryptionKey: this.getStoreEncryptionKey(),
    });
    
    this.migrateLegacyStoreIfNeeded();
    this.loadStoredToken();
  }



  private migrateLegacyStoreIfNeeded(): void {
    const keyPath = path.join(app.getPath('userData'), 'github-auth.key');
    if (fs.existsSync(keyPath)) return;

    const legacyStore = new Store<Record<string, string>>({
      name: 'github-auth',
      encryptionKey: 'kivode-secure-storage',
    });

    const legacyEncrypted = legacyStore.get(this.ENCRYPTION_KEY);
    if (!legacyEncrypted) return;

    try {
      const decrypted = safeStorage.decryptString(Buffer.from(legacyEncrypted, 'latin1'));
      const parsed: TokenData = JSON.parse(decrypted);
      this.storeToken(parsed);
      legacyStore.delete(this.ENCRYPTION_KEY);
    } catch {
      // Ignore migration failures and continue with clean state.
    }
  }

  private getStoreEncryptionKey(): string {
    const keyPath = path.join(app.getPath('userData'), 'github-auth.key');

    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath, 'utf-8').trim();
    }

    const randomKey = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(keyPath, randomKey, { mode: 0o600 });
    return randomKey;
  }

  private async loadStoredToken() {
    try {
      const encrypted = this.store.get(this.ENCRYPTION_KEY);
      if (encrypted) {
        const decrypted = safeStorage.decryptString(Buffer.from(encrypted, 'latin1'));
        const tokenData: TokenData = JSON.parse(decrypted);
        
        if (tokenData.expiresAt && tokenData.expiresAt < Date.now()) {
          this.clearStoredToken();
          return;
        }
        
        this.accessToken = tokenData.accessToken;
        this.tokenScope = tokenData.scope || 'unknown';
        this.octokit = new Octokit({ 
          auth: tokenData.accessToken,
          userAgent: 'Kivode-Plus/1.0.0',
        });
        
        const { data: user } = await this.octokit.users.getAuthenticated();
        this.currentUser = {
          login: user.login,
          id: user.id,
          avatar: user.avatar_url,
        };
      }
    } catch (error) {
      console.error('Failed to load stored token:', error);
      this.clearStoredToken();
    }
  }

  private storeToken(tokenData: TokenData) {
    const serialized = JSON.stringify(tokenData);
    const encrypted = safeStorage.encryptString(serialized);
    this.store.set(this.ENCRYPTION_KEY, encrypted.toString('latin1'));
  }

  private clearStoredToken() {
    this.store.delete(this.ENCRYPTION_KEY);
    this.octokit = null;
    this.currentUser = null;
    this.accessToken = null;
    this.tokenScope = 'unknown';
  }

  isAuthenticated(): boolean {
    return this.octokit !== null && this.currentUser !== null;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getOctokit(): Octokit {
    if (!this.octokit) throw new Error('Not authenticated');
    return this.octokit;
  }

  async setAccessToken(token: string): Promise<void> {
    const octokit = new Octokit({
      auth: token,
      userAgent: 'Kivode-Plus/1.0.0',
    });

    const user = await octokit.users.getAuthenticated();
    const scopes = user.headers['x-oauth-scopes'] || '';

    const tokenData: TokenData = {
      accessToken: token,
      scope: scopes || 'unknown',
    };

    this.storeToken(tokenData);
    this.accessToken = token;
    this.tokenScope = tokenData.scope;
    this.octokit = octokit;
    this.currentUser = {
      login: user.data.login,
      id: user.data.id,
      avatar: user.data.avatar_url || '',
    };
  }

  async getRepositories(): Promise<RepositoryInfo[]> {
    if (!this.octokit) throw new Error('Not authenticated');

    const repos: RepositoryInfo[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const { data } = await this.octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        direction: 'desc',
        per_page: perPage,
        page,
        affiliation: 'owner,collaborator,organization_member',
      });

      repos.push(...data.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        private: repo.private,
        stars: repo.stargazers_count,
        language: repo.language,
        updatedAt: repo.updated_at,
        defaultBranch: repo.default_branch,
        size: repo.size,
        htmlUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        topics: repo.topics || [],
      })));

      if (data.length < perPage) break;
      page++;
    }

    return repos;
  }

  async getRepository(owner: string, repo: string): Promise<RepositoryInfo> {
    if (!this.octokit) throw new Error('Not authenticated');

    const { data } = await this.octokit.repos.get({ owner, repo });
    
    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      private: data.private,
      stars: data.stargazers_count,
      language: data.language,
      updatedAt: data.updated_at,
      defaultBranch: data.default_branch,
      size: data.size,
      htmlUrl: data.html_url,
      cloneUrl: data.clone_url,
      topics: data.topics || [],
    };
  }


  async getRepositoryReadme(owner: string, repo: string): Promise<{ exists: boolean; content: string; truncated: boolean; htmlUrl: string | null; path: string | null }> {
    if (!this.octokit) throw new Error('Not authenticated');

    try {
      const { data } = await this.octokit.repos.getReadme({ owner, repo });
      const decoded = data.content
        ? Buffer.from(data.content, data.encoding as BufferEncoding).toString('utf-8')
        : '';
      const normalized = decoded.trim();
      const maxChars = 2200;

      return {
        exists: true,
        content: normalized.length > maxChars ? `${normalized.slice(0, maxChars)}

...` : normalized,
        truncated: normalized.length > maxChars,
        htmlUrl: data.html_url || null,
        path: data.path || null,
      };
    } catch (error: any) {
      if (error?.status === 404) {
        return { exists: false, content: '', truncated: false, htmlUrl: null, path: null };
      }
      throw error;
    }
  }

  async analyzeRepository(owner: string, repo: string): Promise<RepositoryAnalysis> {
    if (!this.octokit) throw new Error('Not authenticated');

    const timeout = <T>(promise: Promise<T>, label: string, ms = 12000): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          setTimeout(() => reject(new Error(`${label} timed out`)), ms);
        }),
      ]);

    const { data: repoData } = await timeout(this.octokit.repos.get({ owner, repo }), 'Repository metadata request');
    const { data: languagesData } = await timeout(this.octokit.repos.listLanguages({ owner, repo }), 'Languages request');

    const { data: branchesData } = await timeout(
      this.octokit.repos.listBranches({
        owner,
        repo,
        per_page: 100,
      }),
      'Branches request'
    );

    const branchesCount = Math.max(branchesData.length, 1);

    const { data: treeData } = await timeout(
      this.octokit.git.getTree({
        owner,
        repo,
        tree_sha: repoData.default_branch,
      }),
      'Repository tree request'
    );

    const rootFiles = treeData.tree.filter((item) => item.type === 'blob');
    const totalFiles = rootFiles.length;

    const projectType = this.detectProjectType(rootFiles.map((f) => f.path || ''));
    const architecture = this.detectArchitecture(rootFiles.map((f) => f.path || ''));

    return {
      totalFiles,
      languages: languagesData,
      sizeInMB: Math.round((repoData.size / 1024) * 100) / 100,
      defaultBranch: repoData.default_branch,
      branchesCount,
      projectType,
      architecture,
    };
  }

  private detectProjectType(files: string[]): string {
    const hasFile = (name: string) => files.some(f => f.toLowerCase().includes(name.toLowerCase()));
    
    if (hasFile('package.json')) {
      if (hasFile('react') || files.some(f => f.includes('jsx') || f.includes('tsx'))) return 'React/Node.js';
      if (hasFile('vue')) return 'Vue.js';
      if (hasFile('angular')) return 'Angular';
      return 'Node.js';
    }
    if (hasFile('requirements.txt') || hasFile('setup.py')) return 'Python';
    if (hasFile('pom.xml') || hasFile('build.gradle')) return 'Java';
    if (hasFile('Cargo.toml')) return 'Rust';
    if (hasFile('go.mod')) return 'Go';
    if (hasFile('composer.json')) return 'PHP';
    if (hasFile('Gemfile')) return 'Ruby';
    if (hasFile('Dockerfile')) return 'Docker/Container';
    
    return 'Unknown';
  }

  private detectArchitecture(files: string[]): string {
    const hasFile = (name: string) => files.some(f => f.toLowerCase().includes(name.toLowerCase()));
    
    if (hasFile('docker-compose')) return 'Microservices (Docker)';
    if (hasFile('kubernetes') || hasFile('k8s')) return 'Kubernetes';
    if (hasFile('serverless')) return 'Serverless';
    if (hasFile('terraform') || hasFile('pulumi')) return 'Infrastructure as Code';
    if (hasFile('.github/workflows')) return 'CI/CD (GitHub Actions)';
    
    return 'Standard';
  }

  async createBranch(owner: string, repo: string, branch: string, fromBranch?: string): Promise<void> {
    if (!this.octokit) throw new Error('Not authenticated');

    const baseBranch = fromBranch || (await this.getRepository(owner, repo)).defaultBranch;
    
    const { data: refData } = await this.octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
    });

    await this.octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: refData.object.sha,
    });
  }

  async getDiff(owner: string, repo: string, base: string, head: string): Promise<string> {
    if (!this.octokit) throw new Error('Not authenticated');

    const { data: compareData } = await this.octokit.repos.compareCommits({
      owner,
      repo,
      base,
      head,
    });

    let diffOutput = '';
    
    for (const file of compareData.files || []) {
      diffOutput += `diff --git a/${file.filename} b/${file.filename}\n`;
      diffOutput += `--- a/${file.filename}\n`;
      diffOutput += `+++ b/${file.filename}\n`;
      diffOutput += `@@ -1,${file.changes} +1,${file.changes} @@\n`;
      diffOutput += file.patch || '';
      diffOutput += '\n\n';
    }

    return diffOutput;
  }

  async commitChanges(
    owner: string, 
    repo: string, 
    options: CommitOptions
  ): Promise<{ sha: string; url: string }> {
    if (!this.octokit) throw new Error('Not authenticated');

    const branch = options.branch || 'main';
    
    const { data: refData } = await this.octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });

    const latestCommitSha = refData.object.sha;

    const { data: commitData } = await this.octokit.git.getCommit({
      owner,
      repo,
      commit_sha: latestCommitSha,
    });

    const { data: newCommit } = await this.octokit.git.createCommit({
      owner,
      repo,
      message: options.message,
      tree: commitData.tree.sha,
      parents: [latestCommitSha],
    });

    await this.octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    return {
      sha: newCommit.sha,
      url: newCommit.html_url,
    };
  }

  async createPullRequest(
    owner: string, 
    repo: string, 
    options: PullRequestOptions
  ): Promise<{ number: number; url: string }> {
    if (!this.octokit) throw new Error('Not authenticated');

    const { data: pr } = await this.octokit.pulls.create({
      owner,
      repo,
      title: options.title,
      body: options.body,
      head: options.head,
      base: options.base,
    });

    return {
      number: pr.number,
      url: pr.html_url,
    };
  }

  async syncWithRemote(owner: string, repo: string, branch: string): Promise<{
    hasConflicts: boolean;
    behindBy: number;
    aheadBy: number;
    conflicts?: string[];
  }> {
    if (!this.octokit) throw new Error('Not authenticated');

    try {
      const { data: compareData } = await this.octokit.repos.compareCommits({
        owner,
        repo,
        base: `${owner}:${branch}`,
        head: `${branch}`,
      });

      return {
        hasConflicts: compareData.status === 'diverged' && compareData.ahead_by > 0 && compareData.behind_by > 0,
        behindBy: compareData.behind_by,
        aheadBy: compareData.ahead_by,
      };
    } catch (error) {
      return {
        hasConflicts: true,
        behindBy: 0,
        aheadBy: 0,
        conflicts: ['Unable to determine sync status automatically'],
      };
    }
  }

  async publishRepository(
    name: string, 
    description: string, 
    isPrivate: boolean, 
    localPath: string,
    options: PublishRepositoryOptions = {}
  ): Promise<{ url: string; cloneUrl: string }> {
    if (!this.octokit) throw new Error('Not authenticated');

    if (options.verifyUser !== false) {
      const { data: user } = await this.octokit.users.getAuthenticated();
      this.currentUser = {
        login: user.login,
        id: user.id,
        avatar: user.avatar_url || '',
      };
    }

    const git: SimpleGit = simpleGit(localPath);
    const isRepo = await git.checkIsRepo();

    if (!isRepo) {
      await git.init();
    }

    await this.applyOptionalScaffold(localPath, name, description, options);

    const repo = await this.resolvePublishTarget(name, description, isPrivate, localPath, options);

    const remotes = await git.getRemotes(true);
    const hasOrigin = remotes.some(r => r.name === 'origin');
    const remoteUrl = repo.clone_url;

    if (!hasOrigin) {
      await git.addRemote('origin', remoteUrl);
    } else {
      await git.remote(['set-url', 'origin', remoteUrl]);
    }

    await git.add('.');

    const status = await git.status();
    if (status.files.length > 0) {
      const { name: authorName, email: authorEmail } = await this.ensureCommitIdentity(git, options);
      await git.commit('Initial commit from Kivode+', undefined, {
        '--author': `${authorName} <${authorEmail}>`,
      });
    }

    const targetBranch = (options.branchName || repo.default_branch || 'main').trim() || 'main';
    let finalUrl = repo.html_url;

    try {
      await this.pushWithAuth(git, targetBranch, remoteUrl, options.forcePush === true);

      if (options.createPullRequest && targetBranch !== (repo.default_branch || 'main')) {
        try {
          const createdPr = await this.createPullRequest(repo.owner.login, repo.name, {
            title: `Kivode+ update: ${targetBranch}`,
            body: 'Pull request created from Kivode+ publish flow.',
            head: targetBranch,
            base: options.pullRequestBase || repo.default_branch || 'main',
          });
          finalUrl = createdPr.url;
        } catch {
          finalUrl = `${repo.html_url}/tree/${targetBranch}`;
        }
      }
    } catch (error: any) {
      const message = String(error?.message || '').toLowerCase();
      const shouldFallbackBranch = message.includes('already has commits') || message.includes('non-fast-forward');

      if (!shouldFallbackBranch) {
        throw error;
      }

      const fallbackBranch = `kivode-publish-${Date.now()}`;
      await this.pushWithAuth(git, fallbackBranch, remoteUrl, false);

      try {
        const pr = await this.createPullRequest(repo.owner.login, repo.name, {
          title: `Kivode+ publish update: ${fallbackBranch}`,
          body: 'This pull request was created automatically because the target branch already contains commits.',
          head: fallbackBranch,
          base: repo.default_branch || targetBranch,
        });
        finalUrl = pr.url;
      } catch {
        finalUrl = `${repo.html_url}/tree/${fallbackBranch}`;
      }
    }

    return {
      url: finalUrl,
      cloneUrl: repo.clone_url,
    };
  }

  private async resolvePublishTarget(
    name: string,
    description: string,
    isPrivate: boolean,
    localPath: string,
    options: PublishRepositoryOptions
  ): Promise<any> {
    const requestedMode = options.targetMode || 'auto';

    if (requestedMode === 'existing' && options.existingRepoFullName) {
      return this.getExistingRepository(options.existingRepoFullName);
    }

    if (requestedMode === 'auto') {
      const localTarget = await this.getLocalRepositoryTarget(localPath);
      if (localTarget.isGitHubOrigin && localTarget.fullName) {
        return this.getExistingRepository(localTarget.fullName);
      }
    }

    if (!name.trim()) {
      throw new Error('Repository name is required when creating a new repository.');
    }

    return this.createOrGetRepository(name.trim(), description, isPrivate);
  }

  private async createOrGetRepository(name: string, description: string, isPrivate: boolean): Promise<any> {
    if (!this.octokit) throw new Error('Not authenticated');

    try {
      const created = await this.octokit.repos.createForAuthenticatedUser({
        name,
        description,
        private: isPrivate,
        auto_init: false,
      });
      return created.data;
    } catch (error: any) {
      const status = error?.status;
      const message = String(error?.message || '');
      const responseMessage = JSON.stringify(error?.response?.data || {});
      const combinedMessage = `${message} ${responseMessage}`.toLowerCase();

      if (status === 403 || combinedMessage.includes('resource not accessible by personal access token')) {
        throw new Error('Your GitHub token does not have enough permissions to create repositories.');
      }

      const nameAlreadyExists =
        status === 422 &&
        (combinedMessage.includes('name already exists') ||
          combinedMessage.includes('name already exists on this account'));

      if (nameAlreadyExists) {
        if (!this.currentUser?.login) {
          throw new Error('A repository with this name already exists. Please choose another name.');
        }

        return this.getExistingRepository(`${this.currentUser.login}/${name}`);
      }

      throw new Error('Could not create the GitHub repository. Please check your settings and try again.');
    }
  }

  private async getExistingRepository(fullName: string): Promise<any> {
    if (!this.octokit) throw new Error('Not authenticated');

    const [owner, repo] = fullName.split('/');
    if (!owner || !repo) {
      throw new Error('Invalid repository selected.');
    }

    try {
      const existing = await this.octokit.repos.get({ owner, repo });
      return existing.data;
    } catch {
      throw new Error('The selected repository could not be accessed. Check your permissions and try again.');
    }
  }

  private async pushWithAuth(git: SimpleGit, branch: string, remoteUrl: string, forcePush: boolean = false): Promise<void> {
    const authHeader = this.accessToken ? `Authorization: Bearer ${this.accessToken}` : '';

    try {
      if (authHeader) {
        await git.raw(['-c', `http.extraHeader=${authHeader}`, 'push', ...(forcePush ? ['--force-with-lease'] : []), '-u', 'origin', `HEAD:${branch}`]);
      } else {
        await git.push([...(forcePush ? ['--force-with-lease'] : []), '-u', 'origin', `HEAD:${branch}`]);
      }
    } catch (error: any) {
      if (this.shouldRetryPushWithToken(error) && this.accessToken) {
        const directUrl = this.buildTokenAuthenticatedUrl(remoteUrl, this.accessToken);
        try {
          await git.raw(['push', ...(forcePush ? ['--force-with-lease'] : []), '-u', directUrl, `HEAD:${branch}`]);
          return;
        } catch (retryError: any) {
          error = retryError;
        }
      }

      const normalized = this.normalizeGitErrorMessage(error);

      if (
        normalized.includes('non-fast-forward') ||
        normalized.includes('fetch first') ||
        normalized.includes('[rejected]')
      ) {
        throw new Error('The target repository already has commits. Choose another repository name or pull latest changes before publishing.');
      }

      if (
        normalized.includes('authentication failed') ||
        normalized.includes('could not read') ||
        normalized.includes('permission denied') ||
        normalized.includes('http basic: access denied') ||
        normalized.includes('403')
      ) {
        throw new Error('Git push authentication failed. Reconnect GitHub and ensure your token has Contents: Read and write access to the selected repository.');
      }

      if (
        normalized.includes('repository rule violations found') ||
        normalized.includes('gh013') ||
        normalized.includes('protected branch hook declined') ||
        normalized.includes('pre-receive hook declined')
      ) {
        const forceHint = forcePush ? ' Force push is blocked by repository protection rules.' : '';
        throw new Error(`Push was blocked by repository rules/branch protection. Push to an allowed branch or update repository rules and try again.${forceHint}`);
      }

      if (normalized.includes('repository not found')) {
        throw new Error('Repository not found or inaccessible with the current token. Check the repository target and token permissions.');
      }

      const details = this.sanitizeGitErrorMessage(normalized);
      if (details) {
        throw new Error(`Failed to upload project files to GitHub repository: ${details}`);
      }

      throw new Error('Failed to upload project files to GitHub repository.');
    }
  }

  private shouldRetryPushWithToken(error: any): boolean {
    const message = this.normalizeGitErrorMessage(error);
    return (
      message.includes('authentication failed') ||
      message.includes('could not read') ||
      message.includes('permission denied') ||
      message.includes('http basic: access denied') ||
      message.includes('403')
    );
  }

  private buildTokenAuthenticatedUrl(remoteUrl: string, token: string): string {
    if (!remoteUrl.startsWith('https://')) {
      return remoteUrl;
    }

    const cleanRemoteUrl = remoteUrl.replace(/^https:\/\/(x-access-token:)?[^@]+@/i, 'https://');
    const encodedToken = encodeURIComponent(token);
    return cleanRemoteUrl.replace(/^https:\/\//i, `https://x-access-token:${encodedToken}@`);
  }

  private normalizeGitErrorMessage(error: any): string {
    const parts = [
      String(error?.message || ''),
      String(error?.stdout || ''),
      String(error?.stderr || ''),
      String(error?.git?.message || ''),
    ];

    return parts
      .join('\n')
      .replace(/\r/g, '\n')
      .toLowerCase()
      .trim();
  }

  private sanitizeGitErrorMessage(message: string): string {
    if (!message) return '';

    return message
      .replace(/https:\/\/x-access-token:[^@\s]+@/g, 'https://x-access-token:[REDACTED]@')
      .replace(/authorization:\s*bearer\s+[a-z0-9_\-.]+/gi, 'Authorization: Bearer [REDACTED]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 260);
  }

  private async ensureCommitIdentity(git: SimpleGit, options: PublishRepositoryOptions): Promise<{ name: string; email: string }> {
    const configuredName = (await this.getGitConfigValue(git, 'user.name'))?.trim();
    const configuredEmail = (await this.getGitConfigValue(git, 'user.email'))?.trim();

    const fallbackName = options.gitUserName?.trim() || this.currentUser?.login || 'Kivode+';
    const fallbackEmail = options.gitUserEmail?.trim() || this.getDefaultGitEmail(fallbackName);

    const finalName = configuredName || fallbackName;
    const finalEmail = configuredEmail || fallbackEmail;

    if (!configuredName) {
      await git.raw(['config', 'user.name', finalName]);
    }
    if (!configuredEmail) {
      await git.raw(['config', 'user.email', finalEmail]);
    }

    return { name: finalName, email: finalEmail };
  }

  private async getGitConfigValue(git: SimpleGit, key: string): Promise<string> {
    try {
      const value = await git.raw(['config', '--get', key]);
      return value.trim();
    } catch {
      return '';
    }
  }

  private getDefaultGitEmail(userLoginOrName: string): string {
    const normalized = (userLoginOrName || 'kivode-user').toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'kivode-user';
    return `${normalized}@users.noreply.github.com`;
  }

  private async applyOptionalScaffold(
    localPath: string,
    repoName: string,
    description: string,
    options: PublishRepositoryOptions
  ): Promise<void> {
    if (options.addReadme) {
      const readmePath = path.join(localPath, 'README.md');
      if (!fs.existsSync(readmePath)) {
        const readme = `# ${repoName}

${description || 'Project published with Kivode+.'}
`;
        fs.writeFileSync(readmePath, readme, 'utf-8');
      }
    }

    if (options.gitignoreTemplate) {
      const gitignorePath = path.join(localPath, '.gitignore');
      if (!fs.existsSync(gitignorePath)) {
        const gitignore = this.getGitignoreTemplate(options.gitignoreTemplate);
        if (gitignore) {
          fs.writeFileSync(gitignorePath, gitignore, 'utf-8');
        }
      }
    }

    if (options.licenseTemplate) {
      const licensePath = path.join(localPath, 'LICENSE');
      if (!fs.existsSync(licensePath)) {
        const license = this.getLicenseTemplate(options.licenseTemplate, this.currentUser?.login || 'Project Owner');
        if (license) {
          fs.writeFileSync(licensePath, license, 'utf-8');
        }
      }
    }
  }

  private getGitignoreTemplate(template: string): string {
    const key = template.toLowerCase();
    const templates: Record<string, string> = {
      node: 'node_modules/\ndist/\n.env\n.env.*\n*.log\n',
      python: '__pycache__/\n*.pyc\n.venv/\nvenv/\n.env\n',
      java: 'target/\n*.class\n*.jar\n.idea/\n',
      go: 'bin/\n*.test\ncoverage.out\n',
      rust: 'target/\nCargo.lock\n',
      ruby: '.bundle/\nvendor/bundle/\n*.gem\n',
      none: '',
    };
    return templates[key] ?? '';
  }

  private getLicenseTemplate(template: string, owner: string): string {
    const year = new Date().getFullYear();
    const key = template.toLowerCase();

    if (key === 'mit') {
      return `MIT License\n\nCopyright (c) ${year} ${owner}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n`;
    }

    if (key === 'apache-2.0') {
      return `Apache License\nVersion 2.0, January 2004\nhttp://www.apache.org/licenses/\n\nCopyright ${year} ${owner}\n\nLicensed under the Apache License, Version 2.0 (the "License");\nyou may not use this file except in compliance with the License.\nYou may obtain a copy of the License at\n\n    http://www.apache.org/licenses/LICENSE-2.0\n\nUnless required by applicable law or agreed to in writing, software\ndistributed under the License is distributed on an "AS IS" BASIS,\nWITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\nSee the License for the specific language governing permissions and\nlimitations under the License.\n`;
    }

    if (key === 'gpl-3.0') {
      return `GNU GENERAL PUBLIC LICENSE\nVersion 3, 29 June 2007\n\nCopyright (C) ${year} ${owner}\n\nThis program is free software: you can redistribute it and/or modify\nit under the terms of the GNU General Public License as published by\nthe Free Software Foundation, either version 3 of the License, or\n(at your option) any later version.\n`;
    }

    return '';
  }

  generateSmartCommitMessage(changes: { added: string[]; modified: string[]; deleted: string[] }): string {
    const parts: string[] = [];
    
    if (changes.added.length > 0) parts.push(`Add ${changes.added.length} file(s)`);
    if (changes.modified.length > 0) parts.push(`Update ${changes.modified.length} file(s)`);
    if (changes.deleted.length > 0) parts.push(`Remove ${changes.deleted.length} file(s)`);

    if (parts.length === 0) return 'Update files';
    if (parts.length === 1) return parts[0];
    
    return parts.join(', ');
  }


  getAuthStatus(): {
    authenticated: boolean;
    user: { login: string; id: number; avatar: string } | null;
    scope: string;
    scopes: string[];
    tokenTypeHint: 'fine-grained-or-app' | 'classic' | 'unknown';
    capabilities: {
      canReadRepositories: boolean;
      canCreateRepositories: boolean;
      canPushCode: boolean;
    };
  } {
    const scopes = this.tokenScope
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const hasClassicRepo = scopes.includes('repo') || scopes.includes('public_repo');
    const unknownOrFineGrained = scopes.length === 0 || this.tokenScope === 'unknown';

    return {
      authenticated: this.isAuthenticated(),
      user: this.currentUser,
      scope: this.tokenScope,
      scopes,
      tokenTypeHint: unknownOrFineGrained ? 'fine-grained-or-app' : hasClassicRepo ? 'classic' : 'unknown',
      capabilities: {
        canReadRepositories: unknownOrFineGrained || hasClassicRepo,
        canCreateRepositories: unknownOrFineGrained || scopes.includes('repo') || scopes.includes('delete_repo'),
        canPushCode: unknownOrFineGrained || hasClassicRepo,
      },
    };
  }

  async cloneRepositoryWithAuth(url: string, targetPath: string): Promise<void> {
    const git: SimpleGit = simpleGit().env('GIT_TERMINAL_PROMPT', '0').env('GCM_INTERACTIVE', 'never');
    const authHeader = this.accessToken ? `Authorization: Bearer ${this.accessToken}` : '';

    try {
      if (authHeader) {
        await git.raw(['-c', 'credential.helper=', '-c', 'core.askPass=', '-c', `http.extraHeader=${authHeader}`, 'clone', url, targetPath]);
        return;
      }

      await git.raw(['-c', 'credential.helper=', '-c', 'core.askPass=', 'clone', url, targetPath]);
    } catch (error: any) {
      const normalized = this.normalizeGitErrorMessage(error);

      if (this.accessToken && (normalized.includes('authentication failed') || normalized.includes('invalid credentials') || normalized.includes('terminal prompts disabled') || normalized.includes('could not read username'))) {
        const directUrl = this.buildTokenAuthenticatedUrl(url, this.accessToken);
        await git.raw(['-c', 'credential.helper=', '-c', 'core.askPass=', 'clone', directUrl, targetPath]);
        return;
      }

      if (normalized.includes('authentication failed') || normalized.includes('invalid credentials') || normalized.includes('403')) {
        throw new Error('Authentication failed while cloning this repository. Reconnect GitHub token or verify repository access.');
      }
      throw error;
    }
  }

  async getLocalRepositoryTarget(localPath: string): Promise<LocalRepositoryTarget> {
    const git: SimpleGit = simpleGit(localPath);
    const isRepo = await git.checkIsRepo();

    if (!isRepo) {
      return {
        hasGit: false,
        hasOrigin: false,
        isGitHubOrigin: false,
        fullName: null,
        cloneUrl: null,
      };
    }

    const remotes = await git.getRemotes(true);
    const origin = remotes.find(r => r.name === 'origin');
    const remoteUrl = origin?.refs?.push || origin?.refs?.fetch || null;

    if (!remoteUrl) {
      return {
        hasGit: true,
        hasOrigin: false,
        isGitHubOrigin: false,
        fullName: null,
        cloneUrl: null,
      };
    }

    const fullName = this.parseGitHubRepoFullName(remoteUrl);

    return {
      hasGit: true,
      hasOrigin: true,
      isGitHubOrigin: Boolean(fullName),
      fullName,
      cloneUrl: remoteUrl,
    };
  }

  private parseGitHubRepoFullName(remoteUrl: string): string | null {
    const normalized = remoteUrl.trim();

    const sshMatch = normalized.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
    if (sshMatch) {
      return `${sshMatch[1]}/${sshMatch[2]}`;
    }

    const httpsMatch = normalized.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
    if (httpsMatch) {
      return `${httpsMatch[1]}/${httpsMatch[2]}`;
    }

    return null;
  }

  async logout(): Promise<void> {
    this.clearStoredToken();
  }
}
