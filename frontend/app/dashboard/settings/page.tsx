'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { FiUser, FiKey, FiCode, FiGithub, FiEdit2, FiSave } from 'react-icons/fi';
import GitHubConnect from '../../../components/GitHubConnect';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'api' | 'integrations'>('profile');
  
  // プロフィール設定のステート
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  
  // アカウント設定のステート
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // API設定のステート
  const [apiKey, setApiKey] = useState('api_key_12345678'); // ダミー値
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // プロフィール更新の処理（実際はAPIコールが必要）
    setIsEditing(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('新しいパスワードと確認パスワードが一致しません。');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('パスワードは8文字以上である必要があります。');
      return;
    }

    // パスワード更新の処理（実際はAPIコールが必要）
    setPasswordSuccess('パスワードが正常に更新されました。');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const generateNewApiKey = () => {
    // 新しいAPIキーを生成（実際はAPIコールが必要）
    const newKey = 'api_key_' + Math.random().toString(36).substring(2, 10);
    setApiKey(newKey);
    setShowApiKey(true);
  };

  // GitHubアカウント連携の処理
  const handleGitHubConnect = () => {
    const githubOAuthUrl = process.env.NEXT_PUBLIC_GITHUB_OAUTH_URL || 
      'https://github.com/login/oauth/authorize';
    
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    if (!clientId) {
      alert('GitHub Client IDが設定されていません。');
      return;
    }
    
    // GitHubのOAuth認証URLを生成
    const redirectUri = `${window.location.origin}/api/auth/github/callback`;
    const scope = 'repo';
    const authUrl = `${githubOAuthUrl}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
    
    // GitHubの認証ページにリダイレクト
    window.location.href = authUrl;
  };

  return (
    <div className="py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">アカウント設定</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          プロフィール、アカウント、APIキーなどの設定を管理します。
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('profile')}
              className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm ${
                activeTab === 'profile'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FiUser className="inline-block mr-2" />
              プロフィール
            </button>
            <button
              onClick={() => setActiveTab('account')}
              className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm ${
                activeTab === 'account'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FiKey className="inline-block mr-2" />
              アカウント
            </button>
            <button
              onClick={() => setActiveTab('api')}
              className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm ${
                activeTab === 'api'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FiCode className="inline-block mr-2" />
              API設定
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm ${
                activeTab === 'integrations'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FiGithub className="inline-block mr-2" />
              連携サービス
            </button>
          </nav>
        </div>

        <div className="px-4 py-5 sm:p-6">
          {/* プロフィール設定 */}
          {activeTab === 'profile' && (
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">プロフィール設定</h3>
              
              {profileSaved && (
                <div className="rounded-md bg-green-50 p-4 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800">プロフィールが正常に更新されました。</p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleProfileSubmit}>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between">
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        名前
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsEditing(!isEditing)}
                        className="text-primary-600 hover:text-primary-500 text-sm"
                      >
                        {isEditing ? (
                          <>
                            <FiSave className="inline-block mr-1" />
                            保存
                          </>
                        ) : (
                          <>
                            <FiEdit2 className="inline-block mr-1" />
                            編集
                          </>
                        )}
                      </button>
                    </div>
                    <div className="mt-1">
                      <input
                        type="text"
                        name="name"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={!isEditing}
                        className={`shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                          !isEditing ? 'bg-gray-100' : ''
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      メールアドレス
                    </label>
                    <div className="mt-1">
                      <input
                        type="email"
                        name="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={!isEditing}
                        className={`shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md ${
                          !isEditing ? 'bg-gray-100' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {isEditing && (
                    <div>
                      <button
                        type="submit"
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        変更を保存
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* アカウント設定 */}
          {activeTab === 'account' && (
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">アカウント設定</h3>
              
              {passwordError && (
                <div className="rounded-md bg-red-50 p-4 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-red-800">{passwordError}</p>
                    </div>
                  </div>
                </div>
              )}

              {passwordSuccess && (
                <div className="rounded-md bg-green-50 p-4 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-800">{passwordSuccess}</p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit}>
                <div className="space-y-6">
                  <div>
                    <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      現在のパスワード
                    </label>
                    <div className="mt-1">
                      <input
                        type="password"
                        name="current-password"
                        id="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      新しいパスワード
                    </label>
                    <div className="mt-1">
                      <input
                        type="password"
                        name="new-password"
                        id="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      新しいパスワード（確認）
                    </label>
                    <div className="mt-1">
                      <input
                        type="password"
                        name="confirm-password"
                        id="confirm-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  <div>
                    <button
                      type="submit"
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                      パスワードを変更
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* API設定 */}
          {activeTab === 'api' && (
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">API設定</h3>
              
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md mb-6">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  APIキーを使用すると、NextDock APIにプログラムからアクセスできます。キーは機密情報として扱い、公開リポジトリにコミットしないでください。
                </p>
              </div>

              <div className="mb-6">
                <label htmlFor="api-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  APIキー
                </label>
                <div className="flex">
                  <input
                    type={showApiKey ? "text" : "password"}
                    id="api-key"
                    value={apiKey}
                    readOnly
                    className="shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md bg-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="ml-2 inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    {showApiKey ? '隠す' : '表示'}
                  </button>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={generateNewApiKey}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  新しいAPIキーを生成
                </button>
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  APIキーをコピー
                </button>
              </div>
            </div>
          )}

          {/* 連携サービス設定 */}
          {activeTab === 'integrations' && (
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">連携サービス</h3>
              
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md mb-6">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  NextDockと連携するサードパーティサービスを管理します。
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-md">
                  <div className="flex items-center">
                    <FiGithub className="h-8 w-8 text-gray-700 dark:text-gray-300" />
                    <div className="ml-4">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">GitHub</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">リポジトリとブランチへのアクセス</p>
                    </div>
                  </div>
                  <GitHubConnect />
                </div>

                {/* 他の連携サービスもここに追加可能 */}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 