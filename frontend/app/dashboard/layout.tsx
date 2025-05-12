'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaHome, FaRocket, FaServer, FaCog, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  // 未認証ユーザーをログインページにリダイレクト
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin');
    }
  }, [user, loading, router]);

  // ローディング中またはユーザーがない場合はローディング表示
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* ナビゲーションバー */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/dashboard" className="text-2xl font-bold text-primary-600">
                  NextDock
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <button className="ml-3 p-1 rounded-full text-gray-500 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                <span className="sr-only">プロフィールを見る</span>
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">
                    {user?.name?.substring(0, 1) || 'U'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* サイドバー */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="h-full flex flex-col">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <nav className="mt-5 flex-1 px-2 space-y-1">
                <Link
                  href="/dashboard"
                  className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-900"
                >
                  <FaHome className="mr-3 h-5 w-5 text-gray-500 dark:text-gray-400" />
                  ダッシュボード
                </Link>
                <Link
                  href="/dashboard/apps"
                  className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <FaRocket className="mr-3 h-5 w-5 text-gray-500 dark:text-gray-400" />
                  アプリ一覧
                </Link>
                <Link
                  href="/dashboard/domains"
                  className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <FaServer className="mr-3 h-5 w-5 text-gray-500 dark:text-gray-400" />
                  ドメイン設定
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <FaCog className="mr-3 h-5 w-5 text-gray-500 dark:text-gray-400" />
                  設定
                </Link>
              </nav>
            </div>
            <div className="flex-shrink-0 flex border-t border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center">
                <button
                  onClick={logout}
                  className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 w-full"
                >
                  <FaSignOutAlt className="mr-3 h-5 w-5 text-gray-500 dark:text-gray-400" />
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 overflow-auto">
          <main className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
