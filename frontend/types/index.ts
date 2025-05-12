// ユーザー関連の型定義
export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  githubToken?: string;
  createdAt?: string;
  updatedAt?: string;
}

// アプリケーション関連の型定義
export interface App {
  id: string;
  name: string;
  repository: string;
  branch: string;
  url: string;
  subdomain: string;
  status: 'created' | 'building' | 'running' | 'stopped' | 'failed';
  domainType: 'auto' | 'custom';
  customDomain: string | null;
  containerId?: string;
  container_id?: string;
  userId: string;
  buildMethod: 'auto' | 'dockerfile' | 'nextjs';
  autoDeploy: boolean;
  lastDeployedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

// デプロイ関連の型定義
export interface Deploy {
  id: string;
  appId: string;
  status: 'pending' | 'in_progress' | 'success' | 'failed';
  logs?: string;
  commitHash?: string;
  commitMessage?: string;
  initiatedBy: string;
  createdAt: string;
  completedAt?: string;
  duration?: string;
}

// ドメイン関連の型定義
export interface Domain {
  id: string;
  appId: string;
  domain: string;
  verified: boolean;
  verificationCode?: string;
  createdAt: string;
  verifiedAt?: string;
}

// 環境変数の型定義
export interface EnvVar {
  id?: string;
  key: string;
  value: string;
  appId?: string;
}

// 認証関連のレスポンス型
export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

// エラーレスポンスの型定義
export interface ErrorResponse {
  error: string;
  message: string;
  stack?: string;
}

// GithubリポジトリAPI用の型定義
export interface GithubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  default_branch: string;
  updated_at: string;
  language: string | null;
  private: boolean;
}

// Githubブランチ用の型定義
export interface GithubBranch {
  name: string;
  commit: string;
}
