'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FaRocket, FaCloud, FaServer, FaGithub } from 'react-icons/fa';
import { appsApi } from '../../lib/api';
import { App } from '../../types';

export default function Dashboard() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const appsData = await appsApi.getApps();
        setApps(appsData);
      } catch (err: any) {
        setError(err.message || 'アプリの読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchApps();
  }, []);

  // ローディング状態の表示
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // エラー状態の表示
  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <div className="text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ダッシュボード</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">アプリケーションの状態と最近のデプロイを確認できます</p>
      </div>

      {/* アプリ概要カード */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FaRocket className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">アプリ総数</dt>
                <dd>
                  <div className="text-lg font-medium text-gray-900 dark:text-white">{apps.length}</div>
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FaCloud className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">実行中アプリ</dt>
                <dd>
                  <div className="text-lg font-medium text-gray-900 dark:text-white">
                    {apps.filter(app => app.status === 'running').length}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FaServer className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">カスタムドメイン</dt>
                <dd>
                  <div className="text-lg font-medium text-gray-900 dark:text-white">
                    {apps.filter(app => app.domainType === 'custom').length}
                  </div>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      {/* 最近のアプリ */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">アプリ一覧</h2>
          <Link 
            href="/dashboard/apps/new"
            className="btn-primary"
          >
            新規アプリデプロイ
          </Link>
        </div>

        {apps.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 text-center">
            <p className="text-gray-500 dark:text-gray-400">アプリがまだありません。新しいアプリをデプロイして始めましょう。</p>
          </div>
        ) : (
          <div className="overflow-hidden bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">アプリ名</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">URL</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ステータス</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">最終デプロイ</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">アクション</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {apps.map((app) => (
                    <tr key={app.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{app.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-blue-600 dark:text-blue-400">
                          <a href={app.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {app.url}
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          app.status === 'running' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {app.lastDeployedAt ? new Date(app.lastDeployedAt).toLocaleString() : '未デプロイ'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link href={`/dashboard/apps/${app.id}`} className="text-primary-600 hover:text-primary-900 dark:hover:text-primary-400 mr-4">詳細</Link>
                        <button className="text-red-600 hover:text-red-900 dark:hover:text-red-400">
                          {app.status === 'running' ? '停止' : '起動'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 新しいアプリをデプロイ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">新しいアプリをデプロイ</h2>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FaGithub className="h-10 w-10 text-gray-800 dark:text-white" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">GitHubからインポート</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                GitHubのリポジトリからアプリケーションをインポートしてデプロイします。
              </p>
            </div>
            <div className="ml-auto">
              <Link 
                href="/dashboard/apps/new"
                className="btn-primary"
              >
                インポート
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
