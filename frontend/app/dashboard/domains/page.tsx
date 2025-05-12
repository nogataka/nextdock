'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { App } from '../../../types';
import { appsApi } from '../../../lib/api';
import { FiGlobe, FiCheck, FiX, FiSettings } from 'react-icons/fi';

export default function DomainsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const appsData = await appsApi.getApps();
        setApps(appsData);
      } catch (err: any) {
        console.error('Failed to fetch apps:', err);
        setError('アプリの取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };

    fetchApps();
  }, []);

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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">ドメイン設定</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          カスタムドメインの設定や自動生成されたサブドメインの管理ができます。
        </p>
      </div>

      {apps.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">まだアプリがありません</p>
          <Link
            href="/dashboard/apps/new"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            最初のアプリを作成する
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
              アプリのドメイン
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              各アプリのドメイン設定を管理します。
            </p>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {apps.map((app) => (
                <li key={app.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FiGlobe className="h-5 w-5 text-gray-400" />
                      <p className="ml-2 text-sm font-medium text-gray-900 dark:text-white">{app.name}</p>
                    </div>
                    <Link
                      href={`/dashboard/apps/${app.id}/settings`}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200"
                    >
                      <FiSettings className="-ml-0.5 mr-2 h-4 w-4" />
                      設定
                    </Link>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        自動生成ドメイン: <span className="ml-1 font-medium">{app.subdomain}.{process.env.NEXT_PUBLIC_BASE_DOMAIN || 'nextdock.app'}</span>
                      </p>
                    </div>
                    <div className="mt-2 sm:mt-0">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        アクティブ
                      </span>
                    </div>
                  </div>
                  {app.customDomain && (
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          カスタムドメイン: <span className="ml-1 font-medium">{app.customDomain}</span>
                        </p>
                      </div>
                      <div className="mt-2 sm:mt-0">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <FiCheck className="-ml-0.5 mr-1.5 h-3 w-3" />
                          検証済み
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      プライマリドメイン: <span className="font-medium">{app.domainType === 'custom' && app.customDomain ? app.customDomain : `${app.subdomain}.${process.env.NEXT_PUBLIC_BASE_DOMAIN || 'nextdock.app'}`}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
} 