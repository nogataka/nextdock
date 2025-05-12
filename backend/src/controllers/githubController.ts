import { Request, Response } from 'express';
import axios from 'axios';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { AuthenticatedRequest, AppError, GithubRepository } from '../types';

dotenv.config();

// Supabaseクライアントの初期化
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// GitHub APIのベースURL
const GITHUB_API_URL = 'https://api.github.com';

// ユーザーのGitHubリポジトリを取得
export const getRepositories = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    // ユーザーのGitHubトークンを取得 - テーブル名を変更
    const { data: userData, error: userError } = await supabase
      .from('nextdock_users')
      .select('github_token')
      .eq('id', req.user.id)
      .single();
    
    if (userError || !userData || !userData.github_token) {
      throw new AppError('GitHub account not connected', 401);
    }
    
    // GitHubからリポジトリを取得
    const response = await axios.get(`${GITHUB_API_URL}/user/repos`, {
      headers: {
        'Authorization': `Bearer ${userData.github_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
      params: {
        sort: 'updated',
        per_page: 100,
      },
    });
    
    // 必要なリポジトリ情報だけを抽出
    const repositories = response.data.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      default_branch: repo.default_branch,
      updated_at: repo.updated_at,
      language: repo.language,
      private: repo.private,
    }));
    
    res.status(200).json({
      repositories,
    });
  } catch (error: any) {
    if (error.response && error.response.status === 401) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'GitHub token is invalid or expired',
      });
      return;
    }
    
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to fetch repositories',
    });
  }
};

// リポジトリのブランチを取得
export const getBranches = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { repoName } = req.params;
  
  if (!repoName) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Repository name is required',
    });
    return;
  }
  
  try {
    // URLからデコードする
    const decodedRepoName = decodeURIComponent(repoName);
    
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    console.log(`Fetching branches for repository: ${decodedRepoName}`);
    console.log(`User ID: ${req.user.id}`);
    
    // ユーザーのGitHubトークンを取得 - テーブル名を変更
    const { data: userData, error: userError } = await supabase
      .from('nextdock_users')
      .select('github_token')
      .eq('id', req.user.id)
      .single();
    
    if (userError) {
      console.error('Error fetching user data from Supabase:', userError);
      throw new AppError('Failed to fetch user data', 500);
    }
    
    if (!userData || !userData.github_token) {
      console.error('GitHub token not found for user:', req.user.id);
      throw new AppError('GitHub account not connected', 401);
    }
    
    console.log(`GitHub token found for user. Token starts with: ${userData.github_token.substring(0, 5)}...`);
    
    // GitHubからブランチを取得
    const response = await axios.get(`${GITHUB_API_URL}/repos/${decodedRepoName}/branches`, {
      headers: {
        'Authorization': `Bearer ${userData.github_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    // ブランチ情報を抽出
    const branches = response.data.map((branch: any) => ({
      name: branch.name,
      commit: branch.commit.sha,
    }));
    
    console.log(`Successfully fetched ${branches.length} branches for repository: ${decodedRepoName}`);
    
    res.status(200).json({
      branches,
    });
  } catch (error: any) {
    console.error('Error fetching branches:', error);
    
    if (error.response) {
      console.error('GitHub API error:', {
        status: error.response.status,
        data: error.response.data,
      });
    }
    
    if (error.response && error.response.status === 404) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Repository not found',
      });
      return;
    }
    
    if (error.response && error.response.status === 401) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'GitHub token is invalid or expired',
      });
      return;
    }
    
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to fetch branches',
    });
  }
};

// GitHubウェブフックを処理（自動デプロイ用）
export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  const { body, headers } = req;
  const event = headers['x-github-event'];
  
  // プッシュイベントのみを処理
  if (event !== 'push') {
    res.status(200).json({
      message: 'Event ignored',
    });
    return;
  }
  
  try {
    const repository = body.repository.full_name;
    const branch = body.ref.replace('refs/heads/', '');
    
    // このリポジトリとブランチに関連するアプリを検索 - テーブル名を変更
    const { data: apps, error } = await supabase
      .from('nextdock_apps')
      .select('id, user_id, auto_deploy')
      .eq('repository', repository)
      .eq('branch', branch)
      .eq('auto_deploy', true);
    
    if (error) throw error;
    
    if (!apps || apps.length === 0) {
      res.status(200).json({
        message: 'No matching apps configured for auto-deploy',
      });
      return;
    }
    
    // 各アプリのデプロイをキュー
    const deployPromises = apps.map(async (app) => {
      // デプロイレコードを作成 - テーブル名を変更
      await supabase
        .from('nextdock_deploys')
        .insert([
          {
            id: uuidv4(),
            app_id: app.id,
            status: 'pending',
            logs: 'Auto-deployment queued from GitHub webhook...',
            initiated_by: app.user_id,
            commit_hash: body.after,
            commit_message: body.commits[0]?.message || 'Webhook triggered deploy',
          },
        ]);
      
      // 実際の実装では、ここでデプロイキューにタスクを追加します
    });
    
    await Promise.all(deployPromises);
    
    res.status(200).json({
      message: `Auto-deploy triggered for ${apps.length} app(s)`,
    });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    
    // GitHubへのレスポンスなので、エラーでも200を返す
    res.status(200).json({
      message: 'Webhook received, but error occurred during processing',
    });
  }
};

export default {
  getRepositories,
  getBranches,
  handleWebhook,
};
