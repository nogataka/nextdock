import axios from 'axios';
import { 
  App, 
  Deploy, 
  Domain, 
  User, 
  AuthResponse, 
  GithubRepository, 
  GithubBranch,
  EnvVar
} from '../types';

// APIのベースURL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// APIクライアントインスタンスを作成
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// デバッグ用にリクエスト/レスポンスのインターセプターを追加
apiClient.interceptors.request.use(
  (config) => {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, config);
    return config;
  },
  (error) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API Response] ${response.status} ${response.config.url}`, response);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error(`[API Response Error] ${error.response.status} ${error.config?.url}`, error.response.data);
    } else if (error.request) {
      console.error('[API No Response Received]', error.request);
    } else {
      console.error('[API Error]', error.message);
    }
    return Promise.reject(error);
  }
);

// リクエスト時にトークンを設定
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// 認証関連のAPI
export const authApi = {
  // ユーザー登録
  register: async (name: string, email: string, password: string): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/api/auth/register', {
      name,
      email,
      password,
    });
    return response.data;
  },

  // ログイン
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/api/auth/login', {
      email,
      password,
    });
    return response.data;
  },

  // ユーザープロフィール取得
  getProfile: async (): Promise<User> => {
    const response = await apiClient.get<{ user: User }>('/api/auth/profile');
    return response.data.user;
  },
};

// アプリ関連のAPI
export const appsApi = {
  // アプリ一覧取得
  getApps: async (): Promise<App[]> => {
    const response = await apiClient.get<{ apps: App[] }>('/api/apps');
    
    // スネークケースからキャメルケースへの変換処理を追加
    if (response.data.apps && response.data.apps.length > 0) {
      response.data.apps.forEach(app => {
        const appData = app as any;
        
        // container_idがあればcontainerIdにコピー
        if (appData.container_id && !appData.containerId) {
          appData.containerId = appData.container_id;
        }
        
        // 日付フィールドの変換
        if (appData.last_deployed_at && !appData.lastDeployedAt) {
          appData.lastDeployedAt = appData.last_deployed_at;
        }
        
        // created_atをcreatedAtに変換
        if (appData.created_at && !appData.createdAt) {
          appData.createdAt = appData.created_at;
        }
        
        // updated_atをupdatedAtに変換
        if (appData.updated_at && !appData.updatedAt) {
          appData.updatedAt = appData.updated_at;
        }
      });
    }
    
    return response.data.apps;
  },

  // アプリ詳細取得
  getApp: async (id: string): Promise<{ app: App; deployments: Deploy[]; environment: EnvVar[] }> => {
    const response = await apiClient.get<{ app: App; deployments: Deploy[]; environment: EnvVar[] }>(`/api/apps/${id}`);
    
    // バックエンドのプロパティ名をフロントエンドの形式に変換
    if (response.data.app) {
      const appData = response.data.app as any;
      
      // container_idがあればcontainerIdにコピー
      if (appData.container_id && !appData.containerId) {
        appData.containerId = appData.container_id;
        console.log('バックエンドのcontainer_idをcontainerIdに変換しました:', appData.container_id);
      }
      
      // 日付フィールドの変換
      if (appData.last_deployed_at && !appData.lastDeployedAt) {
        appData.lastDeployedAt = appData.last_deployed_at;
        console.log('バックエンドのlast_deployed_atをlastDeployedAtに変換しました:', appData.last_deployed_at);
      }
      
      // created_atをcreatedAtに変換
      if (appData.created_at && !appData.createdAt) {
        appData.createdAt = appData.created_at;
      }
      
      // updated_atをupdatedAtに変換
      if (appData.updated_at && !appData.updatedAt) {
        appData.updatedAt = appData.updated_at;
      }
    }
    
    // デプロイメントデータの日付フィールド変換
    if (response.data.deployments && response.data.deployments.length > 0) {
      response.data.deployments.forEach(deploy => {
        const deployData = deploy as any;
        
        // デバッグ用ロギング
        console.log('getApp内のデプロイデータ:', JSON.stringify(deployData));
        
        // completed_atをcompletedAtに変換
        if (deployData.completed_at && !deployData.completedAt) {
          deployData.completedAt = deployData.completed_at;
        }
        
        // created_atをcreatedAtに変換
        if (deployData.created_at && !deployData.createdAt) {
          deployData.createdAt = deployData.created_at;
        }
        
        // コミット情報の変換
        if (deployData.commit_hash && !deployData.commitHash) {
          deployData.commitHash = deployData.commit_hash;
          console.log(`getApp内でコミットハッシュを変換: ${deployData.commit_hash} -> ${deployData.commitHash}`);
        }
        
        if (deployData.commit_message && !deployData.commitMessage) {
          deployData.commitMessage = deployData.commit_message;
          console.log(`getApp内でコミットメッセージを変換: ${deployData.commit_message} -> ${deployData.commitMessage}`);
        }
        
        // 所要時間を計算（completedAtとcreatedAtがある場合）
        if (deployData.completedAt && deployData.createdAt && !deployData.duration) {
          try {
            const start = new Date(deployData.createdAt).getTime();
            const end = new Date(deployData.completedAt).getTime();
            const durationMs = end - start;
            
            // 読みやすい形式に変換（例：「2分30秒」）
            if (durationMs > 0) {
              const seconds = Math.floor(durationMs / 1000);
              if (seconds < 60) {
                deployData.duration = `${seconds}秒`;
              } else {
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = seconds % 60;
                deployData.duration = `${minutes}分${remainingSeconds > 0 ? ' ' + remainingSeconds + '秒' : ''}`;
              }
              console.log(`getApp内で所要時間を計算: ${deployData.duration}`);
            }
          } catch (e) {
            console.error('所要時間の計算に失敗しました:', e);
          }
        }
      });
    }
    
    return response.data;
  },

  // 新規アプリ作成
  createApp: async (appData: {
    name: string;
    repository: string;
    branch: string;
    buildMethod?: 'auto' | 'dockerfile' | 'nextjs';
    domainType?: 'auto' | 'custom';
    customDomain?: string;
    envVars?: EnvVar[];
  }): Promise<{ message: string; app: App }> => {
    const response = await apiClient.post<{ message: string; app: App }>('/api/apps', appData);
    return response.data;
  },

  // アプリ更新
  updateApp: async (
    id: string,
    updateData: {
      name?: string;
      branch?: string;
      buildMethod?: 'auto' | 'dockerfile' | 'nextjs';
      domainType?: 'auto' | 'custom';
      customDomain?: string;
      autoDeploy?: boolean;
      repository?: string;
      envVars?: EnvVar[];
    }
  ): Promise<{ message: string; app: App }> => {
    const response = await apiClient.put<{ message: string; app: App }>(`/api/apps/${id}`, updateData);
    return response.data;
  },

  // アプリ削除
  deleteApp: async (id: string): Promise<{ message: string }> => {
    try {
      console.log(`Sending delete request for app ID: ${id}`);
      const response = await apiClient.delete<{ message: string }>(`/api/apps/${id}`);
      console.log('Delete response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error in deleteApp API call:', error);
      throw error;
    }
  },

  // アプリの起動/停止
  toggleAppStatus: async (id: string, action: 'start' | 'stop'): Promise<{ message: string; app: App }> => {
    const response = await apiClient.post<{ message: string; app: App }>(`/api/apps/${id}/status`, { action });
    return response.data;
  },
  
  // コンテナログの取得
  getContainerLogs: async (id: string): Promise<{ logs: string }> => {
    const response = await apiClient.get<{ logs: string }>(`/api/apps/${id}/logs`);
    return response.data;
  },
};

// デプロイ関連のAPI
export const deploysApi = {
  // デプロイ履歴取得
  getDeployHistory: async (appId: string): Promise<{ deploys: Deploy[] }> => {
    const response = await apiClient.get<{ deploys: Deploy[] }>(`/api/deploys/app/${appId}`);
    
    // スネークケースからキャメルケースへの変換
    if (response.data.deploys && response.data.deploys.length > 0) {
      response.data.deploys.forEach(deploy => {
        const deployData = deploy as any;
        
        // デバッグ用ロギング
        console.log('処理前のデプロイデータ:', JSON.stringify(deployData));
        
        // 日付フィールドの変換
        if (deployData.completed_at && !deployData.completedAt) {
          deployData.completedAt = deployData.completed_at;
        }
        
        if (deployData.created_at && !deployData.createdAt) {
          deployData.createdAt = deployData.created_at;
        }
        
        // コミット情報の変換
        if (deployData.commit_hash && !deployData.commitHash) {
          deployData.commitHash = deployData.commit_hash;
          console.log(`コミットハッシュを変換: ${deployData.commit_hash} -> ${deployData.commitHash}`);
        }
        
        if (deployData.commit_message && !deployData.commitMessage) {
          deployData.commitMessage = deployData.commit_message;
          console.log(`コミットメッセージを変換: ${deployData.commit_message} -> ${deployData.commitMessage}`);
        }
        
        // 所要時間を計算（completedAtとcreatedAtがある場合）
        if (deployData.completedAt && deployData.createdAt && !deployData.duration) {
          try {
            const start = new Date(deployData.createdAt).getTime();
            const end = new Date(deployData.completedAt).getTime();
            const durationMs = end - start;
            
            // 読みやすい形式に変換（例：「2分30秒」）
            if (durationMs > 0) {
              const seconds = Math.floor(durationMs / 1000);
              if (seconds < 60) {
                deployData.duration = `${seconds}秒`;
              } else {
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = seconds % 60;
                deployData.duration = `${minutes}分${remainingSeconds > 0 ? ' ' + remainingSeconds + '秒' : ''}`;
              }
              console.log(`所要時間を計算: ${deployData.duration}`);
            }
          } catch (e) {
            console.error('所要時間の計算に失敗しました:', e);
          }
        }
        
        // デバッグ用ロギング
        console.log('処理後のデプロイデータ:', JSON.stringify({
          commitHash: deployData.commitHash,
          commitMessage: deployData.commitMessage,
          duration: deployData.duration
        }));
      });
    }
    
    return response.data;
  },

  // デプロイ詳細取得
  getDeployDetails: async (appId: string, deployId: string): Promise<Deploy> => {
    const response = await apiClient.get<{ deploy: Deploy }>(`/api/deploys/app/${appId}/deploy/${deployId}`);
    
    // スネークケースからキャメルケースへの変換
    if (response.data.deploy) {
      const deployData = response.data.deploy as any;
      
      // デバッグ用ロギング
      console.log('詳細：処理前のデプロイデータ:', JSON.stringify(deployData));
      
      // 日付フィールドの変換
      if (deployData.completed_at && !deployData.completedAt) {
        deployData.completedAt = deployData.completed_at;
      }
      
      if (deployData.created_at && !deployData.createdAt) {
        deployData.createdAt = deployData.created_at;
      }
      
      // コミット情報の変換
      if (deployData.commit_hash && !deployData.commitHash) {
        deployData.commitHash = deployData.commit_hash;
        console.log(`詳細：コミットハッシュを変換: ${deployData.commit_hash} -> ${deployData.commitHash}`);
      }
      
      if (deployData.commit_message && !deployData.commitMessage) {
        deployData.commitMessage = deployData.commit_message;
        console.log(`詳細：コミットメッセージを変換: ${deployData.commit_message} -> ${deployData.commitMessage}`);
      }
      
      // 所要時間を計算（completedAtとcreatedAtがある場合）
      if (deployData.completedAt && deployData.createdAt && !deployData.duration) {
        try {
          const start = new Date(deployData.createdAt).getTime();
          const end = new Date(deployData.completedAt).getTime();
          const durationMs = end - start;
          
          // 読みやすい形式に変換（例：「2分30秒」）
          if (durationMs > 0) {
            const seconds = Math.floor(durationMs / 1000);
            if (seconds < 60) {
              deployData.duration = `${seconds}秒`;
            } else {
              const minutes = Math.floor(seconds / 60);
              const remainingSeconds = seconds % 60;
              deployData.duration = `${minutes}分${remainingSeconds > 0 ? ' ' + remainingSeconds + '秒' : ''}`;
            }
            console.log(`詳細：所要時間を計算: ${deployData.duration}`);
          }
        } catch (e) {
          console.error('所要時間の計算に失敗しました:', e);
        }
      }
      
      // デバッグ用ロギング
      console.log('詳細：処理後のデプロイデータ:', JSON.stringify({
        commitHash: deployData.commitHash,
        commitMessage: deployData.commitMessage,
        duration: deployData.duration
      }));
    }
    
    return response.data.deploy;
  },

  // デプロイ実行
  triggerDeploy: async (appId: string): Promise<{ message: string; deploy: Deploy }> => {
    const response = await apiClient.post<{ message: string; deploy: Deploy }>(`/api/deploys/app/${appId}`);
    return response.data;
  },

  // デプロイログ取得
  getDeployLogs: async (appId: string, deployId: string): Promise<{ logs: string; status: string }> => {
    const response = await apiClient.get<{ logs: string; status: string }>(
      `/api/deploys/app/${appId}/deploy/${deployId}/logs`
    );
    return response.data;
  },
};

// ドメイン関連のAPI
export const domainsApi = {
  // ドメイン設定取得
  getDomainSettings: async (appId: string): Promise<{ app: App; domains: Domain[] }> => {
    const response = await apiClient.get<{ app: App; domains: Domain[] }>(`/api/domains/app/${appId}`);
    return response.data;
  },

  // カスタムドメイン追加
  addCustomDomain: async (appId: string, domain: string): Promise<{ message: string; domain: Domain }> => {
    const response = await apiClient.post<{ message: string; domain: Domain }>(`/api/domains/app/${appId}`, { domain });
    return response.data;
  },

  // カスタムドメイン検証
  verifyCustomDomain: async (appId: string, domainId: string): Promise<{ message: string; domain: Domain }> => {
    const response = await apiClient.post<{ message: string; domain: Domain }>(
      `/api/domains/app/${appId}/domain/${domainId}/verify`
    );
    return response.data;
  },

  // カスタムドメイン削除
  removeCustomDomain: async (appId: string, domainId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/api/domains/app/${appId}/domain/${domainId}`);
    return response.data;
  },

  // プライマリドメイン設定
  setPrimaryDomain: async (
    appId: string,
    domainType: 'auto' | 'custom',
    customDomain?: string
  ): Promise<{ message: string; app: App }> => {
    const response = await apiClient.put<{ message: string; app: App }>(`/api/domains/app/${appId}/primary`, {
      domainType,
      customDomain,
    });
    return response.data;
  },
};

// GitHub関連のAPI
export const githubApi = {
  // リポジトリ一覧取得
  getRepositories: async (): Promise<GithubRepository[]> => {
    try {
      // 開発モードの場合はモックデータを返す
      if (isDevelopmentMode()) {
        console.log('開発モード: サンプルGitHubリポジトリを返します');
        return getMockRepositories();
      }

      const response = await apiClient.get<{ repositories: GithubRepository[] }>('/api/github/repositories');
      return response.data.repositories;
    } catch (error: any) {
      // GitHubと連携していない場合や認証失敗の場合は空配列を返す
      if (error.response && error.response.status === 401) {
        console.log('GitHub認証エラー: GitHubアカウントと連携されていないか、トークンが無効です。');
        return [];
      }
      throw error;
    }
  },

  // ブランチ一覧取得
  getBranches: async (repoName: string): Promise<GithubBranch[]> => {
    try {
      // 開発モードの場合はモックデータを返す
      if (isDevelopmentMode()) {
        console.log(`開発モード: リポジトリ "${repoName}" のサンプルブランチを返します`);
        return getMockBranches();
      }

      // repoNameをURLエンコードする
      const encodedRepoName = encodeURIComponent(repoName);
      console.log(`Fetching branches for repository: ${repoName} (encoded: ${encodedRepoName})`);
      
      const response = await apiClient.get<{ branches: GithubBranch[] }>(`/api/github/repositories/${encodedRepoName}/branches`);
      return response.data.branches;
    } catch (error: any) {
      console.error('Error fetching branches:', error);
      
      // GitHubと連携していない場合や認証失敗の場合は空配列を返す
      if (error.response && error.response.status === 401) {
        console.log('GitHub認証エラー: GitHubアカウントと連携されていないか、トークンが無効です。');
        return [];
      }
      throw error;
    }
  },
  
  // GitHubアカウントとの連携状態を確認
  checkGithubConnection: async (): Promise<boolean> => {
    try {
      // 開発モードの場合は常に接続していると判断
      if (isDevelopmentMode()) {
        console.log('開発モード: GitHubとの連携をシミュレートします');
        return true;
      }

      await apiClient.get<{ repositories: GithubRepository[] }>('/api/github/repositories');
      return true;
    } catch (error: any) {
      if (error.response && error.response.status === 401) {
        return false;
      }
      throw error;
    }
  }
};

// 開発モードかどうかを判断する
function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV === 'development' && 
         (!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID || 
          process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID === 'あなたのGitHubクライアントID');
}

// モックリポジトリデータ
function getMockRepositories(): GithubRepository[] {
  return [
    {
      id: 1,
      name: 'nextjs-sample',
      full_name: 'yourname/nextjs-sample',
      description: 'Next.jsのサンプルプロジェクト',
      html_url: 'https://github.com/yourname/nextjs-sample',
      default_branch: 'main',
      updated_at: new Date().toISOString(),
      language: 'TypeScript',
      private: false
    },
    {
      id: 2,
      name: 'react-portfolio',
      full_name: 'yourname/react-portfolio',
      description: 'Reactで作成したポートフォリオサイト',
      html_url: 'https://github.com/yourname/react-portfolio',
      default_branch: 'main',
      updated_at: new Date().toISOString(),
      language: 'JavaScript',
      private: false
    },
    {
      id: 3,
      name: 'express-api',
      full_name: 'yourname/express-api',
      description: 'Express.jsで作成したRESTful API',
      html_url: 'https://github.com/yourname/express-api',
      default_branch: 'master',
      updated_at: new Date().toISOString(),
      language: 'JavaScript',
      private: false
    }
  ];
}

// モックブランチデータ
function getMockBranches(): GithubBranch[] {
  return [
    { name: 'main', commit: 'a1b2c3d4' },
    { name: 'develop', commit: 'e5f6g7h8' },
    { name: 'feature-login', commit: 'i9j0k1l2' }
  ];
}

// Environment variables API
export const environmentApi = {
  // Get environment variables for an app
  getEnvironmentVariables: async (appId: string): Promise<EnvVar[]> => {
    const response = await apiClient.get<{ environment: EnvVar[] }>(`/api/apps/${appId}/environment`);
    
    // スネークケースからキャメルケースへの変換
    if (response.data.environment && response.data.environment.length > 0) {
      response.data.environment.forEach(env => {
        const envData = env as any;
        
        // created_atをcreatedAtに変換
        if (envData.created_at && !envData.createdAt) {
          envData.createdAt = envData.created_at;
        }
        
        // app_idをappIdに変換
        if (envData.app_id && !envData.appId) {
          envData.appId = envData.app_id;
        }
      });
    }
    
    return response.data.environment;
  },

  // Add environment variable
  addEnvironmentVariable: async (appId: string, envVar: { key: string; value: string }): Promise<EnvVar> => {
    const response = await apiClient.post<{ environment: EnvVar }>(`/api/apps/${appId}/environment`, envVar);
    
    // レスポンスデータの変換
    if (response.data.environment) {
      const envData = response.data.environment as any;
      
      // created_atをcreatedAtに変換
      if (envData.created_at && !envData.createdAt) {
        envData.createdAt = envData.created_at;
      }
      
      // app_idをappIdに変換
      if (envData.app_id && !envData.appId) {
        envData.appId = envData.app_id;
      }
    }
    
    return response.data.environment;
  },

  // Delete environment variable
  deleteEnvironmentVariable: async (appId: string, envVarId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/api/apps/${appId}/environment/${envVarId}`);
    return response.data;
  },
};

const api = {
  auth: authApi,
  apps: appsApi,
  deploys: deploysApi,
  domains: domainsApi,
  github: githubApi,
  environment: environmentApi,
};

export default api;
