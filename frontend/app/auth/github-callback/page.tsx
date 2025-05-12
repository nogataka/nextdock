'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import axios from 'axios';

export default function GitHubCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('GitHubアカウントとの連携中...');

  useEffect(() => {
    const connectGitHub = async () => {
      try {
        const token = searchParams.get('token');
        
        if (!token) {
          setStatus('error');
          setMessage('GitHubからの認証トークンが見つかりませんでした。');
          return;
        }

        if (!user) {
          setStatus('error');
          setMessage('ユーザーがログインしていません。先にログインしてください。');
          setTimeout(() => {
            router.push('/auth/signin');
          }, 2000);
          return;
        }

        // 開発モード対応 - モックトークンの場合はAPIコールをスキップ
        if (token === 'dev_mock_token') {
          console.log('開発モード: GitHubとの連携をシミュレートします');
          setStatus('success');
          setMessage('開発モード: GitHubアカウントとの連携をシミュレートしました');
          setTimeout(() => {
            router.push('/dashboard/settings');
          }, 2000);
          return;
        }

        // バックエンドのAPIを呼び出してGitHubトークンを保存
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const response = await axios.post(
          `${API_URL}/api/auth/github/connect`,
          { githubToken: token },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        if (response.status === 200) {
          setStatus('success');
          setMessage('GitHubアカウントの連携に成功しました！');
          // 成功後にダッシュボードの設定ページにリダイレクト
          setTimeout(() => {
            router.push('/dashboard/settings');
          }, 2000);
        } else {
          throw new Error('GitHubアカウントの連携に失敗しました。');
        }
      } catch (error) {
        console.error('GitHub連携エラー:', error);
        setStatus('error');
        setMessage('GitHubアカウントの連携中にエラーが発生しました。再度お試しください。');
      }
    };

    connectGitHub();
  }, [router, searchParams, user]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            GitHub連携
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {status === 'loading' && 'GitHubアカウントと連携しています...'}
            {status === 'success' && 'GitHubアカウントの連携に成功しました！'}
            {status === 'error' && 'GitHubアカウントの連携に失敗しました。'}
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <div className={`flex items-center justify-center ${
            status === 'loading' ? 'text-primary-600' : 
            status === 'success' ? 'text-green-600' : 
            'text-red-600'
          }`}>
            {status === 'loading' && (
              <svg className="animate-spin h-10 w-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {status === 'success' && (
              <svg className="h-10 w-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {status === 'error' && (
              <svg className="h-10 w-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {message}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 