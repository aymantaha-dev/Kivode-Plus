export interface ElectronAPI {
  github: {
    isAuthenticated: () => Promise<boolean>;
    getUser: () => Promise<GitHubUser>;
    getRepositories: () => Promise<any[]>;
    publishRepository: (
      name: string,
      description: string,
      isPrivate: boolean,
      localPath: string,
      options: PublishRepositoryOptions
    ) => Promise<PublishResult>;
    clone: (cloneUrl: string, targetPath: string) => Promise<{ success: boolean; path?: string; message: string }>;
    getLocalRepositoryTarget: (projectPath: string) => Promise<{ isGitHubOrigin: boolean; fullName: string; owner: string; repo: string } | null>;
    startEditingSession: (owner: string, repo: string) => Promise<boolean>;
    getCurrentSession: () => Promise<any>;
  };
  file: {
    selectFolder: () => Promise<{ canceled: boolean; filePaths: string[] }>;
    readDirectory: (path: string) => Promise<any>;
    pathExists: (path: string) => Promise<boolean>; // ADD THIS LINE
  };
}