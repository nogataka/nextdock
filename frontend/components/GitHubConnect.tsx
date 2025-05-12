'use client';

import { useState, useEffect } from 'react';
import { FiGithub } from 'react-icons/fi';
import { githubApi } from '../lib/api';

interface GitHubConnectProps {
  onConnected?: () => void;
  buttonClassName?: string;
  textConnected?: string;
  textNotConnected?: string;
}

export default function GitHubConnect({
  onConnected,
  buttonClassName = "inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200",
  textConnected = '再連携',
  textNotConnected = '連携する'
}: GitHubConnectProps) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const connected = await githubApi.checkGithubConnection();
        setIsConnected(connected);
        if (connected && onConnected) {
          onConnected();
        }
      } catch (error) {
        console.error('GitHubコネクション確認エラー:', error);
        setIsConnected(false);
      } finally {
        setChecking(false);
      }
    };

    checkConnection();
  }, [onConnected]);

  const handleGitHubConnect = () => {
    // 開発環境でGitHub Client IDが設定されていない場合はモック処理を行う
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    if (!clientId || clientId === 'あなたのGitHubクライアントID') {
      console.warn('GitHub Client IDが設定されていません。開発モードで動作します。');
      // 開発用のダミー画面に遷移
      window.location.href = '/auth/github-callback?token=dev_mock_token';
      return;
    }
    
    const githubOAuthUrl = process.env.NEXT_PUBLIC_GITHUB_OAUTH_URL || 
      'https://github.com/login/oauth/authorize';
    
    // GitHubのOAuth認証URLを生成
    // バックエンドのコールバックURLを使用する
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const redirectUri = `${API_URL}/api/auth/github/callback`;
    const scope = 'repo';
    const authUrl = `${githubOAuthUrl}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
    
    // GitHubの認証ページにリダイレクト
    window.location.href = authUrl;
  };

  return (
    <button
      type="button"
      onClick={handleGitHubConnect}
      disabled={checking}
      className={buttonClassName}
    >
      <FiGithub className="mr-1" />
      {checking ? '確認中...' : isConnected ? textConnected : textNotConnected}
    </button>
  );
} 