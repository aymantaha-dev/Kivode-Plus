// src/renderer/src/components/RepositoryList.tsx

import { useState, useEffect } from 'react';
import { Star, GitBranch, Lock, Globe, Search, Loader2 } from 'lucide-react';

// Badge component inline
const Badge = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 ${className}`}>
    {children}
  </span>
);

// Input component inline
const Input = ({ 
  placeholder, 
  value, 
  onChange,
  className = ''
}: { 
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) => (
  <input
    type="text"
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
  />
);

// ScrollArea component inline
const ScrollArea = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`overflow-auto ${className}`}>
    {children}
  </div>
);

interface Repository {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  stars: number;
  language: string | null;
  updatedAt: string;
  defaultBranch: string;
}

export function RepositoryList({ onSelect }: { onSelect: (repo: Repository) => void }) {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<Repository[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRepositories();
  }, []);

  useEffect(() => {
    const filtered = repos.filter(repo => 
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.language?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredRepos(filtered);
  }, [searchQuery, repos]);

  const loadRepositories = async () => {
    try {
      const data = await window.electronAPI.github.getRepositories();
      setRepos(data);
      setFilteredRepos(data);
    } catch (error) {
      console.error('Failed to load repositories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Search repositories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {filteredRepos.map((repo) => (
            <div
              key={repo.id}
              onClick={() => onSelect(repo)}
              className="p-4 border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-primary group-hover:underline">
                      {repo.name}
                    </h3>
                    {repo.private ? (
                      <Lock className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <Globe className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {repo.description || 'No description'}
                  </p>
                  
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    {repo.language && (
                      <Badge className="font-normal">
                        {repo.language}
                      </Badge>
                    )}
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {repo.stars}
                    </div>
                    <div className="flex items-center gap-1">
                      <GitBranch className="w-3 h-3" />
                      {repo.defaultBranch}
                    </div>
                    <span>Updated {formatDate(repo.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}