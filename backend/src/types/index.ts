import { Request } from 'express';

// ユーザー関連の型定義
export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  github_token?: string;
  created_at?: string;
  updated_at?: string;
}

// リクエストに認証情報を追加する拡張型
export interface AuthenticatedRequest extends Request {
  user?: User;
}

// アプリケーション関連の型定義
export interface App {
  id: string;
  user_id: string;
  name: string;
  repository: string;
  branch: string;
  subdomain: string;
  url?: string;
  status: 'created' | 'building' | 'running' | 'stopped' | 'failed';
  domain_type: 'auto' | 'custom';
  custom_domain: string | null;
  container_id?: string;
  build_method: 'auto' | 'dockerfile' | 'nextjs';
  auto_deploy: boolean;
  last_deployed_at?: string;
  created_at: string;
  updated_at?: string;
}

// デプロイ関連の型定義
export interface Deploy {
  id: string;
  app_id: string;
  status: 'pending' | 'in_progress' | 'success' | 'failed';
  logs?: string;
  commit_hash?: string;
  commit_message?: string;
  initiated_by: string;
  created_at: string;
  completed_at?: string;
}

// ドメイン関連の型定義
export interface Domain {
  id: string;
  app_id: string;
  domain: string;
  verified: boolean;
  verification_code?: string;
  created_at: string;
  verified_at?: string;
}

// 環境変数の型定義
export interface EnvVar {
  id?: string;
  app_id?: string;
  key: string;
  value: string;
}

// GitHub関連の型定義
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

export interface GithubBranch {
  name: string;
  commit: {
    sha: string;
  };
}

// エラーレスポンスの型定義
export interface ErrorResponse {
  error: string;
  message: string;
  stack?: string;
}

// Dockerサービス用の型定義
export interface DockerBuildOptions {
  repoPath: string;
  imageTag: string;
  buildMethod: string;
  envVars?: EnvVar[];
}

// カスタムエラークラス
export class AppError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
    
    // Errorクラスを継承する際のTypeScriptの対応
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// CommitInfo型の定義
export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}
