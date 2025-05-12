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
    return response.data.apps;
  },

  // アプリ詳細取得
  getApp: async (id: string): Promise<{ app: App; deployments: Deploy[]; environment: EnvVar[] }> => {
    const response = await apiClient.get<{ app: App; deployments: Deploy[]; environment: EnvVar[] }>(`/api/apps/${id}`);
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
};

// デプロイ関連のAPI
export const deploysApi = {
  // デプロイ履歴取得
  getDeployHistory: async (appId: string): Promise<Deploy[]> => {
    const response = await apiClient.get<{ deploys: Deploy[] }>(`/api/deploys/app/${appId}`);
    return response.data.deploys;
  },

  // デプロイ詳細取得
  getDeployDetails: async (appId: string, deployId: string): Promise<Deploy> => {
    const response = await apiClient.get<{ deploy: Deploy }>(`/api/deploys/app/${appId}/deploy/${deployId}`);
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

const api = {
  auth: authApi,
  apps: appsApi,
  deploys: deploysApi,
  domains: domainsApi,
  github: githubApi,
};

export default api;
