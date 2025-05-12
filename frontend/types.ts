export interface App {
  id: string;
  name: string;
  repo_url?: string;
  repoUrl?: string;
  repo_branch?: string;
  repoBranch?: string;
  user_id: string;
  status?: string;
  build_method?: string;
  buildMethod?: string;
  // バックエンドのスネークケースプロパティ
  container_id?: string;
  created_at?: string;
  updated_at?: string;
  last_deployed_at?: string;
  // フロントエンドのキャメルケースプロパティ
  containerId?: string;
  createdAt?: string;
  updatedAt?: string;
  lastDeployedAt?: string;
}

export interface Deploy {
  id: string;
  app_id: string;
  status: string;
  logs?: string;
  // バックエンドのスネークケースプロパティ
  commit_hash?: string;
  commit_message?: string;
  created_at?: string;
  completed_at?: string;
  // フロントエンドのキャメルケースプロパティ
  commitHash?: string;
  commitMessage?: string;
  createdAt?: string;
  completedAt?: string;
  // 計算フィールド
  duration?: string;
}

export interface EnvVar {
  id: string;
  app_id: string;
  key: string;
  value: string;
  created_at?: string;
} 