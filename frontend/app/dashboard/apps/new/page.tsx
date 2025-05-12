'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaGithub, FaDocker, FaRocket } from 'react-icons/fa';
import { githubApi, appsApi } from '../../../../lib/api';
import { GithubRepository, GithubBranch, EnvVar } from '../../../../types';
import GitHubConnect from '../../../../components/GitHubConnect';

export default function NewApp() {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [repositories, setRepositories] = useState<GithubRepository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GithubRepository | null>(null);
  const [branches, setBranches] = useState<GithubBranch[]>([]);
  const [githubConnected, setGithubConnected] = useState<boolean>(false);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);

  // フォーム状態
  const [formData, setFormData] = useState({
    name: '',
    repository: '',
    branch: 'main' as string,
    buildMethod: 'auto' as 'auto' | 'dockerfile' | 'nextjs',
    domainType: 'auto' as 'auto' | 'custom',
    customDomain: '',
    autoDeploy: true,
    envVars: [] as EnvVar[],
  });

  // 環境変数用の一時状態
  const [newEnvKey, setNewEnvKey] = useState<string>('');
  const [newEnvValue, setNewEnvValue] = useState<string>('');

  // GitHubリポジトリを取得
  const fetchRepositories = async () => {
    setLoadingRepos(true);
    setError(null);
    try {
      const repos = await githubApi.getRepositories();
      setRepositories(repos);
      setGithubConnected(true);
    } catch (err: any) {
      setError('GitHubリポジトリの取得に失敗しました。GitHub連携を確認してください。');
      setGithubConnected(false);
    } finally {
      setLoadingRepos(false);
    }
  };

  // リポジトリが選択されたときにブランチを取得
  const fetchBranches = async (repoFullName: string) => {
    try {
      console.log(`Fetching branches for repository: ${repoFullName}`);
      const branchData = await githubApi.getBranches(repoFullName);
      setBranches(branchData);
      
      // デフォルトのブランチをセット（mainが無ければ最初のブランチ）
      const defaultBranch = branchData.find(b => b.name === 'main') || branchData[0];
      if (defaultBranch) {
        setFormData(prev => ({ ...prev, branch: defaultBranch.name }));
      }
    } catch (err: any) {
      console.error('Error fetching branches:', err);
      setError('ブランチの取得に失敗しました。');
    }
  };

  // リポジトリが選択されたときの処理
  const handleSelectRepository = (repo: GithubRepository) => {
    console.log('Selected repository:', repo);
    setSelectedRepo(repo);
    setFormData(prev => ({
      ...prev,
      repository: repo.full_name,
      name: repo.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    }));
    fetchBranches(repo.full_name);
  };

  // 環境変数の追加
  const addEnvVar = () => {
    if (newEnvKey.trim() && newEnvValue.trim()) {
      setFormData(prev => ({
        ...prev,
        envVars: [...prev.envVars, { key: newEnvKey.trim(), value: newEnvValue.trim() }],
      }));
      setNewEnvKey('');
      setNewEnvValue('');
    }
  };

  // 環境変数の削除
  const removeEnvVar = (index: number) => {
    setFormData(prev => ({
      ...prev,
      envVars: prev.envVars.filter((_, i) => i !== index),
    }));
  };

  // フォーム送信
  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // ドメインタイプがcustomで、カスタムドメインが指定されていない場合はエラー
      if (formData.domainType === 'custom' && !formData.customDomain) {
        throw new Error('カスタムドメインを指定してください。');
      }

      // アプリ作成APIを呼び出し
      const response = await appsApi.createApp({
        name: formData.name,
        repository: formData.repository,
        branch: formData.branch,
        buildMethod: formData.buildMethod,
        domainType: formData.domainType,
        customDomain: formData.domainType === 'custom' ? formData.customDomain : undefined,
        envVars: formData.envVars,
      });

      // 成功したらアプリ詳細ページにリダイレクト
      router.push(`/dashboard/apps/${response.app.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'アプリの作成に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  // ステップの変更
  const goToNextStep = () => {
    setStep(prev => prev + 1);
  };

  const goToPrevStep = () => {
    setStep(prev => prev - 1);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">新規アプリデプロイ</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">
          GitHubリポジトリからアプリケーションをインポートし、Dockerでデプロイします
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 p-4 rounded-md">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* ステップ1: GitHubリポジトリ選択 */}
      <div className={`card mb-6 ${step !== 1 ? 'opacity-50' : ''}`}>
        <div className="flex items-center mb-6">
          <div className="flex-shrink-0">
            <span className="flex items-center justify-center h-10 w-10 rounded-md bg-primary-500 text-white">
              1
            </span>
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              GitHubリポジトリを選択
            </h3>
          </div>
        </div>

        {step === 1 && (
          <>
            {/* GitHubリポジトリ選択 */}
            <div className="mb-6">
              <div className="flex items-center mb-4">
                <button 
                  className="btn-primary flex items-center"
                  onClick={fetchRepositories}
                  disabled={loadingRepos}
                >
                  <FaGithub className="mr-2" />
                  {loadingRepos ? 'GitHubリポジトリを取得中...' : 'GitHubリポジトリを取得'}
                </button>
              </div>

              {!githubConnected && !loadingRepos && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                    GitHubアカウントと連携すると、リポジトリの一覧が表示されます。
                  </p>
                  <GitHubConnect 
                    onConnected={fetchRepositories}
                    buttonClassName="btn-primary flex items-center"
                    textNotConnected="GitHubと連携する"
                  />
                </div>
              )}

              {/* リポジトリ一覧 */}
              {githubConnected && repositories.length > 0 && (
                <div className="max-h-60 overflow-y-auto mb-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {repositories.map(repo => (
                      <li 
                        key={repo.id} 
                        className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                          selectedRepo?.id === repo.id ? 'bg-blue-50 dark:bg-blue-900' : ''
                        }`}
                        onClick={() => handleSelectRepository(repo)}
                      >
                        <div className="flex items-center">
                          <FaGithub className="mr-3 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{repo.full_name}</div>
                            <div className="text-xs text-gray-500">
                              {repo.description || 'No description'} · 最終更新: {new Date(repo.updated_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {githubConnected && selectedRepo && (
                <div className="flex justify-end">
                  <button 
                    className="btn-primary"
                    onClick={goToNextStep}
                  >
                    次へ
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ステップ2: ビルド設定 */}
      <div className={`card mb-6 ${step !== 2 ? 'opacity-50' : ''}`}>
        <div className="flex items-center mb-6">
          <div className="flex-shrink-0">
            <span className="flex items-center justify-center h-10 w-10 rounded-md bg-primary-500 text-white">
              2
            </span>
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              ビルド設定
            </h3>
          </div>
        </div>

        {step === 2 && (
          <div className="mb-6">
            <div className="mb-4">
              <label htmlFor="appName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                アプリ名
              </label>
              <input
                type="text"
                id="appName"
                className="input"
                placeholder="例: my-nextjs-app"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* ビルド方法 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ビルド方法
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div
                  className={`border rounded-lg p-4 cursor-pointer ${
                    formData.buildMethod === 'auto' 
                      ? 'border-primary-500 bg-primary-50 dark:bg-gray-700' 
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                  onClick={() => setFormData(prev => ({ ...prev, buildMethod: 'auto' }))}
                >
                  <div className="flex items-center mb-2">
                    <FaRocket className="mr-2 text-primary-500 dark:text-primary-400" />
                    <div className="font-medium">自動検出</div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Dockerfileがある場合はそれを使用し、ない場合はNext.js用のDockerfileを自動生成します。ほとんどのプロジェクトに推奨します。
                  </p>
                </div>
                
                <div
                  className={`border rounded-lg p-4 cursor-pointer ${
                    formData.buildMethod === 'dockerfile' 
                      ? 'border-primary-500 bg-primary-50 dark:bg-gray-700' 
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                  onClick={() => setFormData(prev => ({ ...prev, buildMethod: 'dockerfile' }))}
                >
                  <div className="flex items-center mb-2">
                    <FaDocker className="mr-2 text-primary-500 dark:text-primary-400" />
                    <div className="font-medium">Dockerfile</div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    リポジトリのルートに存在するDockerfileを使用します。カスタムビルド設定が必要な場合に選択してください。<strong>注意: このオプションを選択する場合は、リポジトリにDockerfileが必要です。</strong>
                  </p>
                </div>
                
                <div
                  className={`border rounded-lg p-4 cursor-pointer ${
                    formData.buildMethod === 'nextjs' 
                      ? 'border-primary-500 bg-primary-50 dark:bg-gray-700' 
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                  onClick={() => setFormData(prev => ({ ...prev, buildMethod: 'nextjs' }))}
                >
                  <div className="flex items-center mb-2">
                    <svg className="mr-2 h-5 w-5 text-primary-500 dark:text-primary-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.572 0c-.176 0-.31.001-.358.007a19.76 19.76 0 0 0-.364.033C7.443.346 4.25 2.185 2.228 5.012a11.875 11.875 0 0 0-2.119 5.243c-.096.659-.108.854-.108 1.747s.012 1.089.108 1.748c.652 4.506 3.86 8.292 8.209 9.695.779.25 1.6.422 2.534.525.363.04 1.935.04 2.299 0 1.611-.178 2.977-.577 4.323-1.264.207-.106.247-.134.219-.158-.02-.013-.9-1.193-1.955-2.62l-1.919-2.592-2.404-3.558a338.739 338.739 0 0 0-2.422-3.556c-.009-.002-.018 1.579-.023 3.51-.007 3.38-.01 3.515-.052 3.595a.426.426 0 0 1-.206.214c-.075.037-.14.044-.495.044H7.81l-.108-.068a.438.438 0 0 1-.157-.171l-.05-.106.006-4.703.007-4.705.072-.092a.645.645 0 0 1 .174-.143c.096-.047.134-.051.54-.051.478 0 .558.018.682.154.035.038 1.337 1.999 2.895 4.361a10760.433 10760.433 0 0 0 4.735 7.17l1.9 2.879.096-.063a12.317 12.317 0 0 0 2.466-2.163 11.944 11.944 0 0 0 2.824-6.134c.096-.66.108-.854.108-1.748 0-.893-.012-1.088-.108-1.747-.652-4.506-3.859-8.292-8.208-9.695a12.597 12.597 0 0 0-2.499-.523A33.119 33.119 0 0 0 11.573 0zm4.069 7.217c.347 0 .408.005.486.047a.473.473 0 0 1 .237.277c.018.06.023 1.365.018 4.304l-.006 4.218-.744-1.14-.746-1.14v-3.066c0-1.982.01-3.097.023-3.15a.478.478 0 0 1 .233-.296c.096-.05.13-.054.5-.054z" />
                    </svg>
                    <div className="font-medium">Next.js</div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Next.js用の最適化されたDockerfileを自動生成します。Next.jsプロジェクトで独自のDockerfileがない場合に推奨します。
                  </p>
                </div>
              </div>
              
              <div className="mt-3 p-3 bg-yellow-50 text-yellow-700 rounded-md text-sm">
                <p><strong>ヒント:</strong> 'Dockerfile'オプションを選択した場合は、リポジトリのルートディレクトリにDockerfileが存在する必要があります。存在しない場合はデプロイに失敗します。不明な場合は「自動検出」を選択してください。</p>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="branch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ブランチ
              </label>
              <select 
                id="branch" 
                className="input"
                value={formData.branch}
                onChange={(e) => setFormData(prev => ({ ...prev, branch: e.target.value }))}
              >
                {branches.map(branch => (
                  <option key={branch.name} value={branch.name}>{branch.name}</option>
                ))}
              </select>
            </div>

            <div className="flex justify-between">
              <button 
                className="btn-secondary"
                onClick={goToPrevStep}
              >
                戻る
              </button>
              <button 
                className="btn-primary"
                onClick={goToNextStep}
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ステップ3: 環境設定 */}
      <div className={`card mb-6 ${step !== 3 ? 'opacity-50' : ''}`}>
        <div className="flex items-center mb-6">
          <div className="flex-shrink-0">
            <span className="flex items-center justify-center h-10 w-10 rounded-md bg-primary-500 text-white">
              3
            </span>
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              環境設定
            </h3>
          </div>
        </div>

        {step === 3 && (
          <div className="mb-6">
            <div className="mb-4">
              <label htmlFor="domainType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ドメイン
              </label>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    id="domain-auto"
                    name="domain-type"
                    type="radio"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    checked={formData.domainType === 'auto'}
                    onChange={() => setFormData(prev => ({ ...prev, domainType: 'auto' }))}
                  />
                  <label htmlFor="domain-auto" className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    自動生成サブドメイン（{formData.name}.nextdock.app）
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="domain-custom"
                    name="domain-type"
                    type="radio"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    checked={formData.domainType === 'custom'}
                    onChange={() => setFormData(prev => ({ ...prev, domainType: 'custom' }))}
                  />
                  <label htmlFor="domain-custom" className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    カスタムドメイン
                  </label>
                </div>
              </div>
            </div>

            {formData.domainType === 'custom' && (
              <div className="mb-4">
                <label htmlFor="customDomain" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  カスタムドメイン
                </label>
                <input
                  type="text"
                  id="customDomain"
                  className="input"
                  placeholder="例: myapp.example.com"
                  value={formData.customDomain}
                  onChange={(e) => setFormData(prev => ({ ...prev, customDomain: e.target.value }))}
                />
                <p className="mt-1 text-sm text-gray-500">
                  DNSレコードの設定が必要です。デプロイ後に詳細な設定手順が表示されます。
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                環境変数
              </label>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                {formData.envVars.length > 0 && (
                  <div className="mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="text-left pb-2">キー</th>
                          <th className="text-left pb-2">値</th>
                          <th className="pb-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.envVars.map((env, index) => (
                          <tr key={index}>
                            <td className="py-1 pr-2">{env.key}</td>
                            <td className="py-1 pr-2">********</td>
                            <td className="py-1">
                              <button
                                type="button"
                                onClick={() => removeEnvVar(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                削除
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    className="input"
                    placeholder="キー（例: API_URL）"
                    value={newEnvKey}
                    onChange={(e) => setNewEnvKey(e.target.value)}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="値"
                    value={newEnvValue}
                    onChange={(e) => setNewEnvValue(e.target.value)}
                  />
                </div>
                <button 
                  className="btn-secondary text-sm"
                  onClick={addEnvVar}
                  disabled={!newEnvKey.trim() || !newEnvValue.trim()}
                >
                  + 環境変数を追加
                </button>
                <p className="mt-2 text-sm text-gray-500">
                  機密情報は暗号化して保存されます。
                </p>
              </div>
            </div>

            <div className="flex justify-between">
              <button 
                className="btn-secondary"
                onClick={goToPrevStep}
              >
                戻る
              </button>
              <button 
                className="btn-primary"
                onClick={goToNextStep}
              >
                次へ
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ステップ4: デプロイ設定 */}
      <div className={`card mb-6 ${step !== 4 ? 'opacity-50' : ''}`}>
        <div className="flex items-center mb-6">
          <div className="flex-shrink-0">
            <span className="flex items-center justify-center h-10 w-10 rounded-md bg-primary-500 text-white">
              4
            </span>
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              デプロイ設定
            </h3>
          </div>
        </div>

        {step === 4 && (
          <div className="mb-6">
            <div className="mb-4">
              <div className="flex items-center mb-1">
                <input
                  id="auto-deploy"
                  name="auto-deploy"
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  checked={formData.autoDeploy}
                  onChange={(e) => setFormData(prev => ({ ...prev, autoDeploy: e.target.checked }))}
                />
                <label htmlFor="auto-deploy" className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  自動デプロイを有効にする
                </label>
              </div>
              <p className="text-sm text-gray-500 ml-6">
                選択したブランチへのプッシュ時に自動的にデプロイします。
              </p>
            </div>

            <div className="mt-8">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">設定の確認</h4>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <dl className="divide-y divide-gray-200 dark:divide-gray-600">
                  <div className="py-2 grid grid-cols-3">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">アプリ名</dt>
                    <dd className="text-sm text-gray-900 dark:text-white col-span-2">{formData.name}</dd>
                  </div>
                  <div className="py-2 grid grid-cols-3">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">リポジトリ</dt>
                    <dd className="text-sm text-gray-900 dark:text-white col-span-2">{formData.repository}</dd>
                  </div>
                  <div className="py-2 grid grid-cols-3">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">ブランチ</dt>
                    <dd className="text-sm text-gray-900 dark:text-white col-span-2">{formData.branch}</dd>
                  </div>
                  <div className="py-2 grid grid-cols-3">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">ビルド方法</dt>
                    <dd className="text-sm text-gray-900 dark:text-white col-span-2">
                      {formData.buildMethod === 'auto' && '自動検出'}
                      {formData.buildMethod === 'dockerfile' && 'Dockerfileを使用'}
                      {formData.buildMethod === 'nextjs' && 'Next.js専用ビルド'}
                    </dd>
                  </div>
                  <div className="py-2 grid grid-cols-3">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">ドメイン</dt>
                    <dd className="text-sm text-gray-900 dark:text-white col-span-2">
                      {formData.domainType === 'auto' 
                        ? `${formData.name}.nextdock.app` 
                        : formData.customDomain}
                    </dd>
                  </div>
                  <div className="py-2 grid grid-cols-3">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">環境変数</dt>
                    <dd className="text-sm text-gray-900 dark:text-white col-span-2">
                      {formData.envVars.length > 0 
                        ? `${formData.envVars.length}個の環境変数が設定されています` 
                        : '設定されていません'}
                    </dd>
                  </div>
                  <div className="py-2 grid grid-cols-3">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">自動デプロイ</dt>
                    <dd className="text-sm text-gray-900 dark:text-white col-span-2">
                      {formData.autoDeploy ? '有効' : '無効'}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button 
                className="btn-secondary"
                onClick={goToPrevStep}
              >
                戻る
              </button>
              <button 
                className="btn-primary flex items-center"
                onClick={handleSubmit}
                disabled={loading}
              >
                <FaRocket className="mr-2" />
                {loading ? 'デプロイ中...' : 'デプロイする'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-4 mb-6">
        <Link href="/dashboard" className="btn-secondary">
          キャンセル
        </Link>
      </div>
    </div>
  );
}
