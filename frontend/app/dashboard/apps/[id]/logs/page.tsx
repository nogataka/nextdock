'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { appsApi } from '../../../../../lib/api';
import { App } from '../../../../../types';
import { FiRefreshCw, FiDownload } from 'react-icons/fi';

interface LogsPageProps {
  params: {
    id: string;
  };
}

export default function LogsPage({ params }: LogsPageProps) {
  const router = useRouter();
  const [app, setApp] = useState<App | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ログをフェッチする関数
  const fetchLogs = async () => {
    try {
      if (!app) return;
      // フロントエンドのApp型定義のcontainerIdとバックエンドのcontainer_idの両方に対応
      if (!app.containerId && !app.container_id) {
        console.log('コンテナIDが見つかりません。App:', app);
        return;
      }
      
      const response = await appsApi.getContainerLogs(app.id);
      setLogs(response.logs);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'ログの取得に失敗しました');
    }
  };

  // アプリ情報を取得
  useEffect(() => {
    const fetchAppData = async () => {
      try {
        setLoading(true);
        const appData = await appsApi.getApp(params.id);
        setApp(appData.app);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'アプリ情報の取得に失敗しました');
        setLoading(false);
      }
    };
    
    fetchAppData();
  }, [params.id]);

  // アプリ情報が取得できたらログを取得
  useEffect(() => {
    if (app) {
      fetchLogs();
    }
  }, [app]);

  // 自動更新の設定
  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        fetchLogs();
      }, 5000); // 5秒ごとに更新
    } else if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, app]);

  // ログが更新されたらスクロールを一番下に移動
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // ログをダウンロード
  const downloadLogs = () => {
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `app-${app?.name}-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error && !app) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>{error}</p>
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{app?.name} - ログ</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            アプリケーションのコンテナログを表示します
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => fetchLogs()}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            disabled={loading || !app?.containerId}
          >
            <FiRefreshCw className="mr-2 h-4 w-4" />
            更新
          </button>
          <button
            onClick={downloadLogs}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            disabled={!logs}
          >
            <FiDownload className="mr-2 h-4 w-4" />
            ダウンロード
          </button>
          <Link
            href={`/dashboard/apps/${app?.id}`}
            className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            アプリに戻る
          </Link>
        </div>
      </div>

      {/* コントロールパネル */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mb-4 flex justify-between items-center">
        <div className="flex items-center">
          <div className="relative inline-block w-10 mr-2 align-middle select-none">
            <input
              type="checkbox"
              id="auto-refresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
            />
            <label
              htmlFor="auto-refresh"
              className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"
            ></label>
          </div>
          <label htmlFor="auto-refresh" className="text-sm text-gray-700 dark:text-gray-300">
            自動更新 (5秒)
          </label>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {lastUpdated && `最終更新: ${lastUpdated.toLocaleString()}`}
        </div>
      </div>

      {/* ログ表示エリア */}
      <div className="bg-black text-green-400 font-mono text-sm p-4 rounded-lg h-[600px] overflow-y-auto whitespace-pre-wrap">
        {!app?.containerId && !app?.container_id ? (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-yellow-300 mb-4">コンテナが実行されていないため、ログは利用できません。</p>
            <p className="text-gray-400">アプリを起動するか、デプロイしてください。</p>
            {app && (
              <pre className="mt-4 text-xs text-gray-500 overflow-auto max-h-[300px]">
                デバッグ情報:
                {JSON.stringify({
                  id: app.id,
                  name: app.name,
                  status: app.status,
                  containerId: app.containerId,
                  container_id: app.container_id,
                  lastDeployedAt: app.lastDeployedAt
                }, null, 2)}
              </pre>
            )}
          </div>
        ) : logs ? (
          <>
            {logs}
            {app && (
              <pre className="mt-4 text-xs text-gray-500 border-t border-gray-700 pt-2">
                デバッグ情報: コンテナID={app.containerId || app.container_id}
              </pre>
            )}
          </>
        ) : error ? (
          <div className="text-red-400">{error}</div>
        ) : (
          <div className="flex justify-center items-center h-full">
            <div className="animate-pulse text-gray-500">ログを取得中...</div>
          </div>
        )}
        <div ref={logsEndRef} />
      </div>

      {/* スタイルを追加 */}
      <style jsx>{`
        .toggle-checkbox:checked {
          right: 0;
          border-color: #68D391;
        }
        .toggle-checkbox:checked + .toggle-label {
          background-color: #68D391;
        }
        .toggle-label {
          transition: background-color 0.2s ease;
        }
      `}</style>
    </div>
  );
} 