'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { deploysApi } from '../../../../../../lib/api';
import { Deploy } from '../../../../../../types';
import { FiArrowLeft, FiRefreshCw, FiDownload } from 'react-icons/fi';

interface DeployDetailsProps {
  params: {
    id: string;
    deployId: string;
  };
}

export default function DeployDetails({ params }: DeployDetailsProps) {
  const router = useRouter();
  const [deploy, setDeploy] = useState<Deploy | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDeployDetails = async () => {
    try {
      setLoading(true);
      const deployData = await deploysApi.getDeployDetails(params.id, params.deployId);
      setDeploy(deployData);
      
      // デプロイログも取得
      const logsData = await deploysApi.getDeployLogs(params.id, params.deployId);
      setLogs(logsData.logs || '');
      setLastUpdated(new Date());
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching deploy details:', err);
      setError(err.response?.data?.message || 'デプロイ情報の取得に失敗しました');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeployDetails();
  }, [params.id, params.deployId]);

  // ログをダウンロード
  const downloadLogs = () => {
    if (!logs) return;
    
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deploy-${params.deployId}-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ステータスに応じた色を返す
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-500 bg-green-100';
      case 'failed':
        return 'text-red-500 bg-red-100';
      case 'in_progress':
        return 'text-blue-500 bg-blue-100';
      case 'pending':
        return 'text-yellow-500 bg-yellow-100';
      default:
        return 'text-gray-500 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        <p>{error}</p>
        <Link href={`/dashboard/apps/${params.id}`} className="text-red-700 font-bold mt-2 inline-block">
          アプリに戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <Link 
            href={`/dashboard/apps/${params.id}`}
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-2"
          >
            <FiArrowLeft className="mr-1" /> アプリに戻る
          </Link>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            デプロイ詳細
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {deploy?.createdAt ? 
              (() => {
                try {
                  return new Date(deploy.createdAt).toLocaleString();
                } catch (e) {
                  console.error("Invalid date format:", deploy.createdAt);
                  return '-';
                }
              })() 
            : '-'}
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={fetchDeployDetails}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
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
            ログをダウンロード
          </button>
        </div>
      </div>

      {/* デプロイ情報 */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500">ステータス</h3>
            <p className={`mt-1 px-2 py-1 rounded inline-block ${getStatusColor(deploy?.status || '')}`}>
              {deploy?.status === 'success' && '成功'}
              {deploy?.status === 'failed' && '失敗'}
              {deploy?.status === 'in_progress' && '進行中'}
              {deploy?.status === 'pending' && '保留中'}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">コミット</h3>
            <p className="mt-1 text-sm text-gray-900">
              {deploy?.commitHash ? `${deploy.commitHash.substring(0, 7)}` : 'N/A'}
              {deploy?.commitMessage && ` - ${deploy.commitMessage}`}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">所要時間</h3>
            <p className="mt-1 text-sm text-gray-900">
              {deploy?.duration || '計算中...'}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">実行者</h3>
            <p className="mt-1 text-sm text-gray-900">{deploy?.initiatedBy || '-'}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">開始時間</h3>
            <p className="mt-1 text-sm text-gray-900">
              {deploy?.createdAt ? 
                (() => {
                  try {
                    return new Date(deploy.createdAt).toLocaleString();
                  } catch (e) {
                    console.error("Invalid date format:", deploy.createdAt);
                    return '-';
                  }
                })() 
              : '-'}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">完了時間</h3>
            <p className="mt-1 text-sm text-gray-900">
              {deploy?.completedAt ? 
                (() => {
                  try {
                    return new Date(deploy.completedAt).toLocaleString();
                  } catch (e) {
                    console.error("Invalid date format:", deploy.completedAt);
                    return '-';
                  }
                })() 
              : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* ログ表示エリア */}
      <div className="mt-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">デプロイログ</h3>
        <div className="bg-black text-green-400 font-mono text-sm p-4 rounded-lg h-[500px] overflow-y-auto whitespace-pre-wrap">
          {logs ? (
            logs
          ) : (
            <div className="flex justify-center items-center h-full">
              <div className="text-gray-500">ログはありません</div>
            </div>
          )}
        </div>
        {lastUpdated && (
          <p className="mt-2 text-xs text-gray-500 text-right">
            最終更新: {lastUpdated.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
} 