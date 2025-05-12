'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaExternalLinkAlt, FaHistory, FaCog, FaTrash, FaPlay, FaStop, FaRedo } from 'react-icons/fa';
import { appsApi, deploysApi } from '../../../../lib/api';
import { App, Deploy, EnvVar } from '../../../../types';

interface AppDetailsProps {
  params: {
    id: string;
  };
}

export default function AppDetail({ params }: AppDetailsProps) {
  const router = useRouter();
  const [app, setApp] = useState<App | null>(null);
  const [deployments, setDeployments] = useState<Deploy[]>([]);
  const [environment, setEnvironment] = useState<EnvVar[]>([]);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // アプリデータを取得
  useEffect(() => {
    const fetchAppData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { app: appData, deployments: deploymentsData, environment: envData } = await appsApi.getApp(params.id);
        setApp(appData);
        setDeployments(deploymentsData);
        setEnvironment(envData);
        
        // 最新デプロイのログを取得（ある場合）
        if (deploymentsData.length > 0) {
          try {
            const logData = await deploysApi.getDeployLogs(params.id, deploymentsData[0].id);
            setLogs(logData.logs);
          } catch (err) {
            console.error('Failed to fetch logs:', err);
            setLogs('ログの取得に失敗しました。');
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.message || 'アプリ情報の取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };

    fetchAppData();
  }, [params.id]);

  // アプリの起動/停止
  const handleToggleAppStatus = async () => {
    if (!app) return;
    
    setActionLoading(true);
    try {
      const action = app.status === 'running' ? 'stop' : 'start';
      const { app: updatedApp } = await appsApi.toggleAppStatus(app.id, action);
      setApp(updatedApp);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || `アプリの${app.status === 'running' ? '停止' : '起動'}に失敗しました。`;
      setError(errorMessage);
      
      // コンテナが見つからないエラーの場合、デプロイを促すメッセージを表示
      if (errorMessage.includes('Container not found') || 
          errorMessage.includes('deploy') || 
          errorMessage.includes('デプロイ')) {
        
        // 3秒後にエラーメッセージをクリア
        setTimeout(() => {
          setError('アプリをデプロイしてください。右上の再デプロイボタン（↻）を押してアプリをデプロイできます。');
        }, 3000);
      }
    } finally {
      setActionLoading(false);
    }
  };

  // アプリの再デプロイ
  const handleRedeploy = async () => {
    if (!app) return;
    
    setActionLoading(true);
    try {
      const response = await deploysApi.triggerDeploy(app.id);
      // 最新のデプロイ情報を取得するためにページをリロード
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.message || 'デプロイの開始に失敗しました。');
      setActionLoading(false);
    }
  };

  // アプリの削除
  const handleDeleteApp = async () => {
    if (!app) return;
    
    // 削除の確認
    if (!window.confirm(`アプリ「${app.name}」を削除してもよろしいですか？この操作は元に戻せません。`)) {
      return;
    }
    
    setActionLoading(true);
    setError(null); // エラーをクリア
    
    try {
      console.log(`Deleting app with ID: ${app.id}`);
      await appsApi.deleteApp(app.id);
      console.log('App deleted successfully, redirecting to dashboard');
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Error deleting app:', err);
      const errorMessage = err.response?.data?.message || 'アプリの削除に失敗しました。';
      setError(`削除エラー: ${errorMessage}`);
      // エラーが発生した場合はアクションローディングをオフにする
      setActionLoading(false);
    }
  };

  // ローディング中は読み込み表示
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // エラー表示
  if (error && !app) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <div className="text-red-700">{error}</div>
      </div>
    );
  }

  // アプリが存在しない場合
  if (!app) {
    return (
      <div className="bg-yellow-50 p-4 rounded-md">
        <div className="text-yellow-700">アプリが見つかりませんでした。</div>
      </div>
    );
  }

  // アプリが一度もデプロイされていない場合のバナー表示
  const showDeployBanner = !app.lastDeployedAt || error?.includes('デプロイ') || error?.includes('deploy');

  return (
    <div>
      {showDeployBanner && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 p-4 rounded-md mb-6 flex items-center">
          <FaRedo className="h-5 w-5 mr-3 text-blue-500" />
          <div>
            <p className="font-medium">アプリをデプロイしてください</p>
            <p className="text-sm">このアプリは初回デプロイが必要です。右上の再デプロイボタン (↻) をクリックしてデプロイを開始してください。</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {app.name}
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400 flex items-center">
            <span className="mr-2">リポジトリ: {app.repository}</span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              app.status === 'running' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}>
              {app.status}
            </span>
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
          <a
            href={app.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary flex items-center"
          >
            <span>サイトを開く</span>
            <FaExternalLinkAlt className="ml-2 h-4 w-4" />
          </a>
          <div className="flex gap-2">
            <button 
              className="btn-secondary"
              onClick={handleToggleAppStatus}
              disabled={actionLoading}
              title={app.status === 'running' ? 'アプリを停止' : 'アプリを起動'}
            >
              {app.status === 'running' ? <FaStop className="h-4 w-4" /> : <FaPlay className="h-4 w-4" />}
            </button>
            <button 
              className="btn-secondary bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200"
              onClick={handleRedeploy}
              disabled={actionLoading}
              title="アプリを再デプロイ（初回デプロイにも使用）"
            >
              <FaRedo className="h-4 w-4" />
            </button>
            <button 
              className="btn-secondary text-red-600"
              onClick={handleDeleteApp}
              disabled={actionLoading}
              title="アプリを削除"
            >
              <FaTrash className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* アプリ情報 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">概要</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">URL</p>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                <a href={app.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {app.url}
                </a>
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">ステータス</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {app.status === 'running' ? '実行中' : '停止中'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">最終デプロイ</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {app.lastDeployedAt ? new Date(app.lastDeployedAt).toLocaleString() : '未デプロイ'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">リポジトリ</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {app.repository} ({app.branch})
              </p>
            </div>
          </div>
          <div className="mt-6">
            <Link
              href={`/dashboard/apps/${app.id}/settings`}
              className="text-sm font-medium text-primary-600 hover:text-primary-500 flex items-center"
            >
              <FaCog className="mr-1 h-4 w-4" />
              アプリ設定
            </Link>
          </div>
        </div>

        <div className="card col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">デプロイログ</h2>
            <Link
              href={`/dashboard/apps/${app.id}/logs`}
              className="text-sm font-medium text-primary-600 hover:text-primary-500"
            >
              すべて表示
            </Link>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 h-40 overflow-y-auto font-mono text-xs">
            {logs ? (
              logs.split('\n').map((line, index) => (
                <p key={index} className={`text-gray-800 dark:text-gray-200 ${
                  line.includes('success') || line.includes('成功') ? 'text-green-600 dark:text-green-400' : ''
                } ${
                  line.includes('error') || line.includes('failed') || line.includes('失敗') ? 'text-red-600 dark:text-red-400' : ''
                }`}>
                  {line}
                </p>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400">ログがありません。</p>
            )}
          </div>
        </div>
      </div>

      {/* デプロイ履歴 */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">デプロイ履歴</h2>
        </div>
        {deployments.length === 0 ? (
          <div className="text-center p-4">
            <p className="text-gray-500 dark:text-gray-400">デプロイ履歴がありません。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ステータス</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">コミット</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">メッセージ</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">デプロイ日時</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">所要時間</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">アクション</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {deployments.map((deploy) => (
                  <tr key={deploy.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${deploy.status === 'success' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : deploy.status === 'failed'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                        {deploy.status === 'success' ? '成功' : deploy.status === 'failed' ? '失敗' : '進行中'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
                      {deploy.commitHash?.substring(0, 7) || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {deploy.commitMessage || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(deploy.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {deploy.duration || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link 
                        href={`/dashboard/apps/${app.id}/deploys/${deploy.id}`}
                        className="text-primary-600 hover:text-primary-900 dark:hover:text-primary-400"
                      >
                        詳細
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 環境変数 */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">環境変数</h2>
          <Link
            href={`/dashboard/apps/${app.id}/settings`}
            className="text-sm font-medium text-primary-600 hover:text-primary-500"
          >
            編集
          </Link>
        </div>
        {environment.length === 0 ? (
          <div className="text-center p-4">
            <p className="text-gray-500 dark:text-gray-400">環境変数がありません。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">キー</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">値</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {environment.map((env, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {env.key}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      ******** (マスク済み)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
