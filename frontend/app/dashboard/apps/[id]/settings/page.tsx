'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiSave, FiGlobe, FiCode, FiGithub, FiTrash } from 'react-icons/fi';
import { appsApi, environmentApi } from '../../../../../lib/api';
import { App, EnvVar } from '../../../../../types';
import Link from 'next/link';

interface AppSettingsProps {
  params: {
    id: string;
  };
}

export default function AppSettings({ params }: AppSettingsProps) {
  const router = useRouter();
  const [app, setApp] = useState<App | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // フォーム状態
  const [name, setName] = useState('');
  const [repository, setRepository] = useState('');
  const [branch, setBranch] = useState('');
  const [buildMethod, setBuildMethod] = useState<'auto' | 'dockerfile' | 'nextjs'>('auto');
  const [autoDeploy, setAutoDeploy] = useState(false);
  const [customDomain, setCustomDomain] = useState('');
  const [saving, setSaving] = useState(false);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  useEffect(() => {
    const fetchApp = async () => {
      try {
        setLoading(true);
        const appData = await appsApi.getApp(params.id);
        setApp(appData.app);
        
        // フォーム初期値を設定
        setName(appData.app.name);
        setRepository(appData.app.repository);
        setBranch(appData.app.branch);
        setBuildMethod(appData.app.buildMethod);
        setAutoDeploy(appData.app.autoDeploy);
        setCustomDomain(appData.app.customDomain || '');
        
        // 環境変数を取得
        setEnvVars(appData.environment);
        
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'アプリ情報の取得に失敗しました');
        setLoading(false);
      }
    };
    
    fetchApp();
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!app) return;
    
    try {
      setSaving(true);
      
      await appsApi.updateApp(app.id, {
        name,
        branch,
        buildMethod: buildMethod,
        autoDeploy,
        customDomain: customDomain || undefined
      });
      
      // 変更を反映
      const updatedAppData = await appsApi.getApp(app.id);
      setApp(updatedAppData.app);
      
      setSaving(false);
      // 成功メッセージを表示
      alert('アプリ設定を保存しました');
    } catch (err: any) {
      setError(err.message || '設定の保存に失敗しました');
      setSaving(false);
    }
  };

  const addEnvironmentVariable = async () => {
    if (!newEnvKey || !newEnvValue || !app) return;
    
    try {
      await environmentApi.addEnvironmentVariable(app.id, {
        key: newEnvKey,
        value: newEnvValue
      });
      
      // 更新された環境変数リストを取得
      const vars = await environmentApi.getEnvironmentVariables(app.id);
      setEnvVars(vars);
      
      // フォームをクリア
      setNewEnvKey('');
      setNewEnvValue('');
    } catch (err: any) {
      setError(err.message || '環境変数の追加に失敗しました');
    }
  };

  const deleteEnvironmentVariable = async (id: string) => {
    if (!app) return;
    
    try {
      await environmentApi.deleteEnvironmentVariable(app.id, id);
      
      // 更新された環境変数リストを取得
      const vars = await environmentApi.getEnvironmentVariables(app.id);
      setEnvVars(vars);
    } catch (err: any) {
      setError(err.message || '環境変数の削除に失敗しました');
    }
  };

  const handleDelete = async () => {
    if (!app) return;
    
    // 確認ダイアログ
    if (!confirm('本当にこのアプリを削除しますか？この操作は取り消せません。')) {
      return;
    }
    
    try {
      await appsApi.deleteApp(app.id);
      router.push('/dashboard/apps');
    } catch (err: any) {
      setError(err.message || 'アプリの削除に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>{error || 'アプリが見つかりません'}</p>
        <Link href="/dashboard/apps" className="text-red-700 font-bold mt-2 inline-block">
          アプリ一覧に戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{app.name} - 設定</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            アプリケーションの各種設定を変更できます
          </p>
        </div>
        <Link
          href={`/dashboard/apps/${app.id}`}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          アプリに戻る
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
        <form onSubmit={handleSubmit}>
          <div className="px-4 py-5 sm:p-6">
            <div className="grid grid-cols-1 gap-6">
              {/* 基本設定 */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">基本設定</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      アプリ名
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* リポジトリ設定 */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">リポジトリ設定</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="repository" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      GitHub リポジトリ
                    </label>
                    <input
                      type="text"
                      id="repository"
                      value={repository}
                      onChange={(e) => setRepository(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      placeholder="owner/repo"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      例: username/repository または https://github.com/username/repository
                    </p>
                  </div>

                  <div>
                    <label htmlFor="branch" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      ブランチ
                    </label>
                    <input
                      type="text"
                      id="branch"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      placeholder="main"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="buildMethod" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      ビルド方法
                    </label>
                    <select
                      id="buildMethod"
                      value={buildMethod}
                      onChange={(e) => setBuildMethod(e.target.value as any)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      required
                    >
                      <option value="auto">自動検出</option>
                      <option value="dockerfile">Dockerfile</option>
                      <option value="nextjs">Next.js</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      自動検出: リポジトリ内のDockerfileを使用するか、Next.jsプロジェクトの場合は自動的にDockerfileを生成します
                    </p>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="autoDeploy"
                      checked={autoDeploy}
                      onChange={(e) => setAutoDeploy(e.target.checked)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="autoDeploy" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      リポジトリの変更を自動的にデプロイする
                    </label>
                  </div>
                </div>
              </div>

              {/* ドメイン設定 */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">ドメイン設定</h3>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      自動生成ドメイン
                    </label>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {app.subdomain}.{process.env.NEXT_PUBLIC_BASE_DOMAIN || 'nextdock.app'}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="customDomain" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      カスタムドメイン（オプション）
                    </label>
                    <input
                      type="text"
                      id="customDomain"
                      value={customDomain}
                      onChange={(e) => setCustomDomain(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      placeholder="example.com"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      カスタムドメインを使用する場合は、DNSの設定も必要です
                    </p>
                  </div>
                </div>
              </div>

              {/* 環境変数 */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">環境変数</h3>
                <div className="mt-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    アプリケーションで使用する環境変数を設定します。変更後は再デプロイが必要です。
                  </p>

                  {/* 環境変数リスト */}
                  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg mb-4">
                    <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                            キー
                          </th>
                          <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                            値
                          </th>
                          <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                            <span className="sr-only">削除</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {envVars.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                              環境変数がありません
                            </td>
                          </tr>
                        ) : (
                          envVars.map((env) => (
                            <tr key={env.id}>
                              <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                                {env.key}
                              </td>
                              <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                                {env.value}
                              </td>
                              <td className="py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                <button
                                  type="button"
                                  onClick={() => deleteEnvironmentVariable(env.id!)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  削除
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 新しい環境変数を追加 */}
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                    <div className="md:col-span-3">
                      <label htmlFor="newEnvKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        キー
                      </label>
                      <input
                        type="text"
                        id="newEnvKey"
                        value={newEnvKey}
                        onChange={(e) => setNewEnvKey(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        placeholder="KEY_NAME"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label htmlFor="newEnvValue" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        値
                      </label>
                      <input
                        type="text"
                        id="newEnvValue"
                        value={newEnvValue}
                        onChange={(e) => setNewEnvValue(e.target.value)}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                        placeholder="value"
                      />
                    </div>
                    <div className="md:col-span-1 flex items-end">
                      <button
                        type="button"
                        onClick={addEnvironmentVariable}
                        disabled={!newEnvKey || !newEnvValue}
                        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed w-full"
                      >
                        追加
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 危険なアクション */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                <h3 className="text-lg font-medium text-red-600">危険な操作</h3>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <FiTrash className="mr-2 h-5 w-5" />
                    アプリを削除
                  </button>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    この操作は取り消せません。アプリケーション、デプロイメント履歴、環境変数などすべてのデータが削除されます。
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 text-right sm:px-6">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  保存中...
                </>
              ) : (
                <>
                  <FiSave className="mr-2 h-5 w-5" />
                  設定を保存
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 