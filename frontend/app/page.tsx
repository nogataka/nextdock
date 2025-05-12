import Link from 'next/link';
import { FaGithub, FaDocker, FaRocket } from 'react-icons/fa';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* ナビゲーションバー */}
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-2xl font-bold text-primary-600">NextDock</span>
              </div>
            </div>
            <div className="flex items-center">
              <Link 
                href="/auth/signin"
                className="btn-primary"
              >
                ログイン
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ヒーローセクション */}
      <div className="bg-gradient-to-b from-primary-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
              <span className="block">Push すれば、</span>
              <span className="block text-primary-600">即デプロイ。</span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-300">
              Next.jsアプリをGitHubからワンクリックでインポートし、Dockerを使って即座にビルド＆公開できる「セルフホスティングPaaS」
            </p>
            <div className="mt-10 flex justify-center">
              <div className="mx-2">
                <Link 
                  href="/auth/signup"
                  className="btn-primary text-lg px-8 py-3"
                >
                  今すぐ始める
                </Link>
              </div>
              <div className="mx-2">
                <Link 
                  href="#features"
                  className="btn-secondary text-lg px-8 py-3"
                >
                  詳細を見る
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 特徴セクション */}
      <div id="features" className="py-16 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
              開発者のためのシンプルなデプロイ
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-500 dark:text-gray-300">
              NextDockは、Next.jsアプリケーションを簡単にデプロイするための機能を提供します。
            </p>
          </div>

          <div className="mt-16">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {/* 機能カード1 */}
              <div className="card">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary-500 text-white">
                  <FaGithub className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-white">GitHub連携</h3>
                <p className="mt-2 text-base text-gray-500 dark:text-gray-300">
                  GitHubのOAuth認証経由でリポジトリをインポートし、DockerfileまたはNext.jsプロジェクト構造を自動認識。
                </p>
              </div>

              {/* 機能カード2 */}
              <div className="card">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary-500 text-white">
                  <FaDocker className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-white">Dockerビルド自動化</h3>
                <p className="mt-2 text-base text-gray-500 dark:text-gray-300">
                  Dockerfileがある場合はそれを使用、ない場合はテンプレートから自動生成（Next.js用）してビルド。
                </p>
              </div>

              {/* 機能カード3 */}
              <div className="card">
                <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary-500 text-white">
                  <FaRocket className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-medium text-gray-900 dark:text-white">デプロイ管理</h3>
                <p className="mt-2 text-base text-gray-500 dark:text-gray-300">
                  デプロイ履歴、ビルドログ、公開URL、環境変数の設定などが可能。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* フッター */}
      <footer className="bg-white dark:bg-gray-900 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
          <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
            <p className="text-center text-base text-gray-400">
              &copy; {new Date().getFullYear()} NextDock. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
