'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { App } from '../../../types';
import { appsApi } from '../../../lib/api';
import { FiPlus, FiExternalLink, FiGitBranch, FiClock, FiActivity } from 'react-icons/fi';

export default function AppsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchApps = async () => {
      setLoading(true);
      try {
        const appsData = await appsApi.getApps();
        console.log('アプリ一覧を取得しました:', appsData);
        if (appsData && appsData.length > 0) {
          console.log('最初のアプリのlastDeployedAt:', appsData[0].lastDeployedAt);
        }
        setApps(appsData);
      } catch (error) {
        console.error('アプリ一覧の取得に失敗しました:', error);
        setError('アプリ一覧の取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };

    fetchApps();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800';
      case 'stopped':
        return 'bg-gray-100 text-gray-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'building':
      case 'deploying':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="py-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4 my-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">アプリ一覧</h2>
        <Link
          href="/dashboard/apps/new"
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          <FiPlus className="-ml-1 mr-2 h-5 w-5" />
          新規アプリ作成
        </Link>
      </div>

      {apps.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">まだアプリがありません</p>
          <Link
            href="/dashboard/apps/new"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            <FiPlus className="-ml-1 mr-2 h-5 w-5" />
            最初のアプリを作成する
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <div
              key={app.id}
              className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg transition-shadow hover:shadow-md cursor-pointer"
              onClick={() => router.push(`/dashboard/apps/${app.id}`)}
            >
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">{app.name}</h3>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                      app.status
                    )}`}
                  >
                    {app.status === 'running' && '稼働中'}
                    {app.status === 'stopped' && '停止中'}
                    {app.status === 'failed' && '失敗'}
                    {app.status === 'building' && 'ビルド中'}
                    {app.status === 'created' && '作成済み'}
                  </span>
                </div>
                <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <FiExternalLink className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                  <p className="truncate">
                    {app.customDomain || `${app.subdomain}.${process.env.NEXT_PUBLIC_BASE_DOMAIN || 'nextdock.app'}`}
                  </p>
                </div>
                <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <FiGitBranch className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                  <p className="truncate">{app.repository} ({app.branch})</p>
                </div>
                <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <FiClock className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                  <p>最終更新: {app.lastDeployedAt ? 
                    (() => {
                      try {
                        return new Date(app.lastDeployedAt).toLocaleDateString('ja-JP');
                      } catch (e) {
                        console.error("Invalid date format:", app.lastDeployedAt);
                        return '未デプロイ';
                      }
                    })() 
                  : '未デプロイ'}</p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-4 sm:px-6">
                <div className="text-sm">
                  <Link
                    href={`/dashboard/apps/${app.id}`}
                    className="font-medium text-primary-600 hover:text-primary-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    詳細を表示
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 