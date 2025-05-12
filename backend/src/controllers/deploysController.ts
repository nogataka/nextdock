import { Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { AuthenticatedRequest, AppError } from '../types';
import githubService from '../services/githubService';
import dockerService from '../services/dockerService';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

// Supabaseクライアントの初期化
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// アプリのデプロイ履歴を取得
export const getDeployHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { appId } = req.params;
  
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    // アプリが存在するか確認し、所有権をチェック - テーブル名を変更
    const { data: app, error: appError } = await supabase
      .from('nextdock_apps')
      .select('user_id')
      .eq('id', appId)
      .single();
    
    if (appError || !app) {
      throw new AppError('App not found', 404);
    }
    
    if (app.user_id !== req.user.id) {
      throw new AppError('You do not have permission to access this app', 403);
    }
    
    // デプロイ履歴を取得 - テーブル名を変更
    const { data: deploys, error: deploysError } = await supabase
      .from('nextdock_deploys')
      .select('*')
      .eq('app_id', appId)
      .order('created_at', { ascending: false });
    
    if (deploysError) throw deploysError;
    
    res.status(200).json({
      deploys: deploys || [],
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to fetch deploy history',
    });
  }
};

// 特定のデプロイの詳細を取得
export const getDeployDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { appId, deployId } = req.params;
  
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    // アプリが存在するか確認し、所有権をチェック - テーブル名を変更
    const { data: app, error: appError } = await supabase
      .from('nextdock_apps')
      .select('user_id')
      .eq('id', appId)
      .single();
    
    if (appError || !app) {
      throw new AppError('App not found', 404);
    }
    
    if (app.user_id !== req.user.id) {
      throw new AppError('You do not have permission to access this app', 403);
    }
    
    // デプロイ詳細を取得 - テーブル名を変更
    const { data: deploy, error: deployError } = await supabase
      .from('nextdock_deploys')
      .select('*')
      .eq('id', deployId)
      .eq('app_id', appId)
      .single();
    
    if (deployError || !deploy) {
      throw new AppError('Deploy not found', 404);
    }
    
    res.status(200).json({
      deploy,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to fetch deploy details',
    });
  }
};

// リポジトリURLを修正して、GitHub URLを完全な形式にする
const getFullGitHubUrl = (repoUrl: string): string => {
  if (!repoUrl.startsWith('https://')) {
    // ドメインが含まれていない場合は追加
    return `https://github.com/${repoUrl}.git`;
  } else if (!repoUrl.endsWith('.git')) {
    // .gitが含まれていない場合は追加
    return `${repoUrl}.git`;
  }
  return repoUrl;
};

// 新しいデプロイをトリガー
export const triggerDeploy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { appId } = req.params;
  
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    // アプリが存在するか確認し、所有権をチェック - テーブル名を変更
    const { data: app, error: appError } = await supabase
      .from('nextdock_apps')
      .select('*')
      .eq('id', appId)
      .single();
    
    if (appError || !app) {
      throw new AppError('App not found', 404);
    }
    
    if (app.user_id !== req.user.id) {
      throw new AppError('You do not have permission to deploy this app', 403);
    }
    
    // 環境変数を取得 - テーブル名を変更
    const { data: envVars, error: envError } = await supabase
      .from('nextdock_environment_variables')
      .select('key, value')
      .eq('app_id', appId);
    
    if (envError) throw envError;
    
    // デプロイレコードを作成 - テーブル名を変更
    const deployId = uuidv4();
    const { data: deploy, error: createError } = await supabase
      .from('nextdock_deploys')
      .insert([
        {
          id: deployId,
          app_id: appId,
          status: 'pending',
          logs: 'Deployment queued...',
          initiated_by: req.user.id,
        },
      ])
      .select()
      .single();
    
    if (createError) throw createError;
    if (!deploy) throw new AppError('Failed to create deploy record', 500);
    
    // 非同期でデプロイを開始
    // 実際の実装では、ここでデプロイキューにタスクを追加するか、
    // 別のサービスを呼び出してデプロイを開始します
    // この例では、擬似的に非同期処理を行います
    (async () => {
      try {
        // GitHubトークンを取得 - テーブル名を変更
        const { data: userData, error: userError } = await supabase
          .from('nextdock_users')
          .select('github_token')
          .eq('id', req.user?.id || '')
          .single();
          
        if (!req.user || userError || !userData || !userData.github_token) {
          throw new Error('GitHub token not found');
        }

        // デプロイステータスを「進行中」に更新
        await supabase
          .from('nextdock_deploys')
          .update({ status: 'in_progress', logs: 'Deployment started...\n' })
          .eq('id', deployId);
        
        // リポジトリURLを適切な形式に変換
        const fullRepositoryUrl = getFullGitHubUrl(app.repository);
        console.log(`Original repository URL: ${app.repository}`);
        console.log(`Full repository URL: ${fullRepositoryUrl}`);

        // ログ更新
        await supabase
          .from('nextdock_deploys')
          .update({ 
            logs: `Deployment started...\nPreparing to clone repository: ${fullRepositoryUrl} (branch: ${app.branch})\n` 
          })
          .eq('id', deployId);
        
        // GitHubからリポジトリをクローン
        const repoPath = `/tmp/repos/${appId}`;
        const commitInfo = await githubService.cloneRepository(fullRepositoryUrl, app.branch, repoPath);
        
        // ログを更新
        await supabase
          .from('nextdock_deploys')
          .update({
            logs: `Repository cloned. Commit: ${commitInfo.hash} - ${commitInfo.message}\n`,
            commit_hash: commitInfo.hash,
            commit_message: commitInfo.message,
          })
          .eq('id', deployId);
        
        // Dockerfileの存在を確認（大文字小文字の区別なく）
        console.log(`Checking for Dockerfile in ${repoPath} with any case sensitivity`);
        let hasDockerfile = await dockerService.checkDockerfile(repoPath);
        
        // 大文字小文字が異なるDockerfileを探す
        if (!hasDockerfile) {
          try {
            const files = await fs.readdir(repoPath);
            console.log(`Files in repository (${files.length}):`, files);
            
            // 大文字小文字を区別せずDockerfileという名前を持つファイルを探す
            const dockerfileAlternatives = files.filter(f => 
              f.toLowerCase() === 'dockerfile' && f !== 'Dockerfile'
            );
            
            if (dockerfileAlternatives.length > 0) {
              console.log(`Found alternative Dockerfile: ${dockerfileAlternatives[0]}`);
              
              // 正しい名前に変更
              const altPath = path.join(repoPath, dockerfileAlternatives[0]);
              const correctPath = path.join(repoPath, 'Dockerfile');
              await fs.rename(altPath, correctPath);
              console.log(`Renamed ${altPath} to ${correctPath}`);
              
              // 名前を変更したので、もう一度チェック
              hasDockerfile = await dockerService.checkDockerfile(repoPath);
              console.log(`After renaming, Dockerfile exists: ${hasDockerfile}`);
            }
          } catch (fsError) {
            console.error('Error searching for alternative Dockerfile:', fsError);
          }
        }
        
        // ビルドメソッドの決定
        const buildMethod = hasDockerfile ? 'dockerfile' : (app.build_method || 'auto');
        console.log(`Using build method: ${buildMethod} (Dockerfile found: ${hasDockerfile})`);
        
        // Dockerイメージをビルド
        const imageTag = `nextdock/${appId}:${deployId}`;
        
        // 進捗ログを追加
        await supabase
          .from('nextdock_deploys')
          .update({
            logs: `Repository cloned. Commit: ${commitInfo.hash} - ${commitInfo.message}\nPreparing to build Docker image with method: ${buildMethod}...\n`,
          })
          .eq('id', deployId);
        
        await dockerService.buildImage(repoPath, imageTag, buildMethod, envVars || []);
        
        // ログを更新
        await supabase
          .from('nextdock_deploys')
          .update({
            logs: `Docker image built successfully.\nStarting container...\n`,
          })
          .eq('id', deployId);
        
        // 既存のコンテナを停止・削除（存在する場合）
        if (app.container_id) {
          await dockerService.stopAndRemoveContainer(app.container_id);
        }
        
        // 新しいコンテナを作成・起動
        const containerId = await dockerService.runContainer(imageTag, app.subdomain, envVars || []);
        
        // アプリとデプロイのステータスを更新
        await supabase
          .from('nextdock_apps')
          .update({
            status: 'running',
            container_id: containerId,
            last_deployed_at: new Date().toISOString(),
          })
          .eq('id', appId);
        
        const baseUrl = process.env.BASE_DOMAIN || 'nextdock.app';
        const appUrl = app.custom_domain || `https://${app.subdomain}.${baseUrl}`;
        
        await supabase
          .from('nextdock_deploys')
          .update({
            status: 'success',
            logs: `Deployment successful!\nApp is running at: ${appUrl}\n`,
            completed_at: new Date().toISOString(),
          })
          .eq('id', deployId);
      } catch (error: any) {
        console.error('Deployment failed:', error);
        
        // エラーメッセージをより詳細に
        let errorMessage = `Deployment failed: ${error.message}\n`;
        
        // Dockerfileが見つからない場合の特別なガイダンス
        if (error.message && error.message.includes('Cannot locate specified Dockerfile')) {
          errorMessage += `\nリポジトリにDockerfileが見つかりませんでした。以下の対処法を試してください：\n`;
          errorMessage += `1. リポジトリにDockerfileを追加する\n`;
          errorMessage += `2. アプリ設定でビルド方法を 'auto' または 'nextjs' に変更する\n`;
          errorMessage += `3. package.jsonファイルが正しく配置されているか確認する\n`;
        }
        
        // デプロイ失敗を記録
        await supabase
          .from('nextdock_deploys')
          .update({
            status: 'failed',
            logs: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq('id', deployId);
      }
    })();
    
    res.status(202).json({
      message: 'Deployment triggered',
      deploy: {
        id: deploy.id,
        status: deploy.status,
        created_at: deploy.created_at,
      },
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to trigger deployment',
    });
  }
};

// デプロイのログを取得
export const getDeployLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { appId, deployId } = req.params;
  
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    // アプリが存在するか確認し、所有権をチェック - テーブル名を変更
    const { data: app, error: appError } = await supabase
      .from('nextdock_apps')
      .select('user_id')
      .eq('id', appId)
      .single();
    
    if (appError || !app) {
      throw new AppError('App not found', 404);
    }
    
    if (app.user_id !== req.user.id) {
      throw new AppError('You do not have permission to access this app', 403);
    }
    
    // デプロイログを取得 - テーブル名を変更
    const { data: deploy, error: deployError } = await supabase
      .from('nextdock_deploys')
      .select('logs, status')
      .eq('id', deployId)
      .eq('app_id', appId)
      .single();
    
    if (deployError || !deploy) {
      throw new AppError('Deploy not found', 404);
    }
    
    res.status(200).json({
      logs: deploy.logs,
      status: deploy.status,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to fetch deploy logs',
    });
  }
};

// 利用可能なポートを見つける
const findAvailablePort = async (start: number = 3002, end: number = 4000): Promise<number> => {
  const { data: apps } = await supabase
    .from('nextdock_apps')
    .select('port')
    .not('port', 'is', null);
  
  const usedPorts = apps ? apps.map(app => app.port) : [];
  
  for (let port = start; port <= end; port++) {
    if (!usedPorts.includes(port)) {
      return port;
    }
  }
  
  throw new Error('No available ports found');
};

// ユニークなサブドメイン名を生成
const generateUniqueSubdomain = async (baseName: string): Promise<string> => {
  // 英数字とハイフンのみを許可し、先頭と末尾のハイフンを削除
  let sanitizedName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '');
  
  // 空の場合はランダムな文字列を使用
  if (!sanitizedName) {
    sanitizedName = `app-${Math.random().toString(36).substring(2, 8)}`;
  }
  
  // サブドメインの存在確認
  const { data: existingApp } = await supabase
    .from('nextdock_apps')
    .select('id')
    .eq('subdomain', sanitizedName)
    .maybeSingle();
  
  // 既存のサブドメインがある場合、ランダムな文字列を追加
  if (existingApp) {
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    sanitizedName = `${sanitizedName}-${randomSuffix}`;
  }
  
  return sanitizedName;
};

// リポジトリURLから直接デプロイ（新規アプリ作成）
export const deployFromRepository = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    const { 
      repositoryUrl, 
      branch = 'main', 
      appName, 
      buildMethod = 'auto', 
      envVars = [] 
    } = req.body;
    
    if (!repositoryUrl) {
      throw new AppError('Repository URL is required', 400);
    }
    
    // リポジトリURLを適切な形式に変換
    const fullRepositoryUrl = getFullGitHubUrl(repositoryUrl);
    
    // サブドメイン名を生成（appNameをベースに）
    const subdomain = await generateUniqueSubdomain(appName || path.basename(repositoryUrl, '.git'));
    
    // 利用可能なポートを見つける
    const port = await findAvailablePort(
      parseInt(process.env.PORT_RANGE_START || '3002'), 
      parseInt(process.env.PORT_RANGE_END || '4000')
    );
    
    // ドメイン名の取得
    const baseDomain = process.env.BASE_DOMAIN || 'nextdock.c1x.biz';
    const appDomain = `${subdomain}.${baseDomain}`;
    
    // 新しいアプリレコードを作成
    const appId = uuidv4();
    const { data: app, error: appError } = await supabase
      .from('nextdock_apps')
      .insert([
        {
          id: appId,
          user_id: req.user.id,
          name: appName || subdomain,
          repository: repositoryUrl,
          branch,
          subdomain,
          port,
          status: 'pending',
          build_method: buildMethod,
        },
      ])
      .select()
      .single();
    
    if (appError || !app) {
      throw new AppError('Failed to create app', 500);
    }
    
    // Nginx Proxy用の環境変数を追加
    const proxyEnvVars = [
      { key: 'VIRTUAL_HOST', value: appDomain },
      { key: 'VIRTUAL_PORT', value: '80' },
      { key: 'LETSENCRYPT_HOST', value: appDomain },
      { key: 'LETSENCRYPT_EMAIL', value: process.env.DEFAULT_EMAIL || 'admin@nextdock.c1x.biz' }
    ];
    
    // 環境変数を保存
    const allEnvVars = [...envVars, ...proxyEnvVars];
    if (allEnvVars.length > 0) {
      const { error: envError } = await supabase
        .from('nextdock_environment_variables')
        .insert(
          allEnvVars.map(env => ({
            app_id: appId,
            key: env.key,
            value: env.value,
            is_secret: env.key.includes('SECRET') || env.key.includes('KEY')
          }))
        );
      
      if (envError) {
        console.error('Failed to save environment variables:', envError);
      }
    }
    
    // デプロイレコードを作成
    const deployId = uuidv4();
    const { data: deploy, error: createError } = await supabase
      .from('nextdock_deploys')
      .insert([
        {
          id: deployId,
          app_id: appId,
          status: 'pending',
          logs: 'Deployment queued...',
          initiated_by: req.user.id,
        },
      ])
      .select()
      .single();
    
    if (createError || !deploy) {
      throw new AppError('Failed to create deploy record', 500);
    }
    
    // 非同期でデプロイを開始
    (async () => {
      try {
        // GitHubトークンを取得
        const { data: userData, error: userError } = await supabase
          .from('nextdock_users')
          .select('github_token')
          .eq('id', req.user?.id || '')
          .single();
          
        if (!req.user || userError || !userData || !userData.github_token) {
          throw new Error('GitHub token not found');
        }

        // デプロイステータスを「進行中」に更新
        await supabase
          .from('nextdock_deploys')
          .update({ status: 'in_progress', logs: 'Deployment started...\n' })
          .eq('id', deployId);
        
        // ログ更新
        await supabase
          .from('nextdock_deploys')
          .update({ 
            logs: `Deployment started...\nPreparing to clone repository: ${fullRepositoryUrl} (branch: ${branch})\n` 
          })
          .eq('id', deployId);
        
        // GitHubからリポジトリをクローン
        const repoPath = `/tmp/repos/${appId}`;
        const commitInfo = await githubService.cloneRepository(fullRepositoryUrl, branch, repoPath);
        
        // ログを更新
        await supabase
          .from('nextdock_deploys')
          .update({
            logs: `Repository cloned. Commit: ${commitInfo.hash} - ${commitInfo.message}\n`,
            commit_hash: commitInfo.hash,
            commit_message: commitInfo.message,
          })
          .eq('id', deployId);
        
        // Dockerfileの存在を確認
        let hasDockerfile = await dockerService.checkDockerfile(repoPath);
        
        // 大文字小文字が異なるDockerfileを探す
        if (!hasDockerfile) {
          try {
            const files = await fs.readdir(repoPath);
            
            // 大文字小文字を区別せずDockerfileという名前を持つファイルを探す
            const dockerfileAlternatives = files.filter(f => 
              f.toLowerCase() === 'dockerfile' && f !== 'Dockerfile'
            );
            
            if (dockerfileAlternatives.length > 0) {
              // 正しい名前に変更
              const altPath = path.join(repoPath, dockerfileAlternatives[0]);
              const correctPath = path.join(repoPath, 'Dockerfile');
              await fs.rename(altPath, correctPath);
              
              // 名前を変更したので、もう一度チェック
              hasDockerfile = await dockerService.checkDockerfile(repoPath);
            }
          } catch (fsError) {
            console.error('Error searching for alternative Dockerfile:', fsError);
          }
        }
        
        // ビルドメソッドの決定
        const finalBuildMethod = hasDockerfile ? 'dockerfile' : (buildMethod || 'auto');
        
        // Dockerイメージをビルド
        const imageTag = `nextdock/${appId}:${deployId}`;
        
        // 進捗ログを追加
        await supabase
          .from('nextdock_deploys')
          .update({
            logs: `Repository cloned. Commit: ${commitInfo.hash} - ${commitInfo.message}\nPreparing to build Docker image with method: ${finalBuildMethod}...\n`,
          })
          .eq('id', deployId);
        
        await dockerService.buildImage(repoPath, imageTag, finalBuildMethod, allEnvVars);
        
        // ログを更新
        await supabase
          .from('nextdock_deploys')
          .update({
            logs: `Docker image built successfully.\nStarting container...\n`,
          })
          .eq('id', deployId);
        
        // 新しいコンテナを作成・起動
        const containerId = await dockerService.runContainer(imageTag, subdomain, allEnvVars);
        
        // アプリとデプロイのステータスを更新
        await supabase
          .from('nextdock_apps')
          .update({
            status: 'running',
            container_id: containerId,
            last_deployed_at: new Date().toISOString(),
          })
          .eq('id', appId);
        
        const appUrl = `https://${appDomain}`;
        
        await supabase
          .from('nextdock_deploys')
          .update({
            status: 'success',
            logs: `Deployment successful!\nApp is running at: ${appUrl}\n`,
            completed_at: new Date().toISOString(),
          })
          .eq('id', deployId);
      } catch (error: any) {
        console.error('Deployment failed:', error);
        
        // エラーメッセージをより詳細に
        let errorMessage = `Deployment failed: ${error.message}\n`;
        
        // Dockerfileが見つからない場合の特別なガイダンス
        if (error.message && error.message.includes('Cannot locate specified Dockerfile')) {
          errorMessage += `\nリポジトリにDockerfileが見つかりませんでした。以下の対処法を試してください：\n`;
          errorMessage += `1. リポジトリにDockerfileを追加する\n`;
          errorMessage += `2. アプリ設定でビルド方法を 'auto' または 'nextjs' に変更する\n`;
          errorMessage += `3. package.jsonファイルが正しく配置されているか確認する\n`;
        }
        
        // デプロイ失敗を記録
        await supabase
          .from('nextdock_deploys')
          .update({
            status: 'failed',
            logs: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq('id', deployId);
        
        // アプリのステータスも更新
        await supabase
          .from('nextdock_apps')
          .update({
            status: 'failed',
          })
          .eq('id', appId);
      }
    })();
    
    res.status(202).json({
      message: 'App creation and deployment triggered',
      app: {
        id: app.id,
        name: app.name,
        subdomain,
        url: `https://${appDomain}`,
      },
      deploy: {
        id: deploy.id,
        status: deploy.status,
      },
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to deploy from repository',
    });
  }
};

export default {
  getDeployHistory,
  getDeployDetails,
  triggerDeploy,
  getDeployLogs,
  deployFromRepository,
};
