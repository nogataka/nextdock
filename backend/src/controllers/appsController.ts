import { Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { AuthenticatedRequest, App, EnvVar, AppError } from '../types';
import dockerService from '../services/dockerService';
import githubService from '../services/githubService';

dotenv.config();

// Supabaseクライアントの初期化
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// アプリ一覧取得
export const getApps = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    // テーブル名を変更
    const { data, error } = await supabase
      .from('nextdock_apps')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.status(200).json({
      apps: data || [],
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to fetch apps',
    });
  }
};

// アプリ詳細取得
export const getApp = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    // アプリ情報を取得 - テーブル名を変更
    const { data: appData, error: appError } = await supabase
      .from('nextdock_apps')
      .select('*')
      .eq('id', id)
      .single();
    
    if (appError) throw appError;
    
    // アプリが存在しない場合
    if (!appData) {
      throw new AppError('App not found', 404);
    }
    
    // アプリが現在のユーザーに所有されているか確認
    if (appData.user_id !== req.user.id) {
      throw new AppError('You do not have permission to access this app', 403);
    }
    
    // 最新のデプロイ情報を取得 - テーブル名を変更
    const { data: deployData, error: deployError } = await supabase
      .from('nextdock_deploys')
      .select('*')
      .eq('app_id', id)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (deployError) throw deployError;
    
    // 環境変数を取得 - テーブル名を変更
    const { data: envData, error: envError } = await supabase
      .from('nextdock_environment_variables')
      .select('key, value')
      .eq('app_id', id);
    
    if (envError) throw envError;
    
    // 環境変数の値をマスクする
    const maskedEnvs = (envData || []).map(env => ({
      key: env.key,
      value: '********', // 値をマスク
    }));
    
    res.status(200).json({
      app: appData,
      deployments: deployData || [],
      environment: maskedEnvs || [],
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to fetch app details',
    });
  }
};

// 新規アプリ作成
export const createApp = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name, repository, branch, buildMethod, domainType, customDomain, envVars } = req.body;
  
  if (!name || !repository || !branch) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Name, repository, and branch are required',
    });
    return;
  }
  
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    // GitHubトークンを取得 - テーブル名を変更
    const { data: userData, error: userError } = await supabase
      .from('nextdock_users')
      .select('github_token')
      .eq('id', req.user.id)
      .single();
    
    if (userError) throw userError;
    if (!userData || !userData.github_token) {
      throw new AppError('GitHub account not connected', 400);
    }
    
    // リポジトリの存在確認
    const repoExists = await githubService.checkRepository(repository, userData.github_token);
    
    if (!repoExists) {
      throw new AppError('Repository not found or not accessible', 400);
    }
    
    // サブドメイン生成（カスタムドメインがない場合）
    const subdomain = customDomain || `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${uuidv4().substring(0, 8)}`;
    
    // アプリレコードを作成 - テーブル名を変更
    const { data: appData, error: appError } = await supabase
      .from('nextdock_apps')
      .insert([
        {
          id: uuidv4(),
          user_id: req.user.id,
          name,
          repository,
          branch,
          build_method: buildMethod || 'auto',
          domain_type: domainType || 'auto',
          custom_domain: customDomain || null,
          subdomain,
          status: 'created',
        },
      ])
      .select()
      .single();
    
    if (appError) throw appError;
    if (!appData) throw new AppError('App creation failed', 500);
    
    // 環境変数を保存（あれば）- テーブル名を変更
    if (envVars && Array.isArray(envVars) && envVars.length > 0) {
      const envVarsToInsert = envVars.map(env => ({
        id: uuidv4(),
        app_id: appData.id,
        key: env.key,
        value: env.value,
      }));
      
      const { error: envError } = await supabase
        .from('nextdock_environment_variables')
        .insert(envVarsToInsert);
      
      if (envError) throw envError;
    }
    
    // デプロイをキュー
    // 実際の実装では、ここでデプロイキューにタスクを追加するか、
    // 別のサービスを呼び出してデプロイを開始します
    
    res.status(201).json({
      message: 'App created successfully',
      app: appData,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to create app',
    });
  }
};

// アプリ更新
export const updateApp = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, branch, buildMethod, domainType, customDomain, envVars } = req.body;
  
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    // アプリが存在するか確認 - テーブル名を変更
    const { data: existingApp, error: fetchError } = await supabase
      .from('nextdock_apps')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError) throw fetchError;
    
    if (!existingApp) {
      throw new AppError('App not found', 404);
    }
    
    // 権限チェック
    if (existingApp.user_id !== req.user.id) {
      throw new AppError('You do not have permission to update this app', 403);
    }
    
    // 更新するフィールドを準備
    const updates: Partial<App> = {};
    if (name) updates.name = name;
    if (branch) updates.branch = branch;
    if (buildMethod) updates.build_method = buildMethod as App['build_method'];
    if (domainType) updates.domain_type = domainType as App['domain_type'];
    if (customDomain !== undefined) updates.custom_domain = customDomain || null;
    
    // アプリを更新 - テーブル名を変更
    const { data: updatedApp, error: updateError } = await supabase
      .from('nextdock_apps')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    if (!updatedApp) throw new AppError('App update failed', 500);
    
    // 環境変数を更新（あれば）- テーブル名を変更
    if (envVars && Array.isArray(envVars)) {
      // 既存の環境変数を削除
      const { error: deleteError } = await supabase
        .from('nextdock_environment_variables')
        .delete()
        .eq('app_id', id);
      
      if (deleteError) throw deleteError;
      
      // 新しい環境変数を挿入
      if (envVars.length > 0) {
        const envVarsToInsert = envVars.map(env => ({
          id: uuidv4(),
          app_id: id,
          key: env.key,
          value: env.value,
        }));
        
        const { error: insertError } = await supabase
          .from('nextdock_environment_variables')
          .insert(envVarsToInsert);
        
        if (insertError) throw insertError;
      }
    }
    
    res.status(200).json({
      message: 'App updated successfully',
      app: updatedApp,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to update app',
    });
  }
};

// アプリ削除
export const deleteApp = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    // アプリが存在するか確認 - テーブル名を変更
    const { data: existingApp, error: fetchError } = await supabase
      .from('nextdock_apps')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError) throw fetchError;
    
    if (!existingApp) {
      throw new AppError('App not found', 404);
    }
    
    // 権限チェック
    if (existingApp.user_id !== req.user.id) {
      throw new AppError('You do not have permission to delete this app', 403);
    }
    
    console.log(`Deleting app with ID: ${id}`);

    // Dockerコンテナを停止して削除
    if (existingApp.container_id) {
      try {
        console.log(`Stopping and removing container: ${existingApp.container_id}`);
        await dockerService.stopAndRemoveContainer(existingApp.container_id);
      } catch (containerError: any) {
        console.error('Error stopping/removing container:', containerError);
        // コンテナ削除エラーは無視して処理を続行
      }
    }
    
    // RPCの代わりに、直接関連リソースを削除
    // 1. まず環境変数を削除
    console.log('Deleting environment variables');
    const { error: envDeleteError } = await supabase
      .from('nextdock_environment_variables')
      .delete()
      .eq('app_id', id);
    
    if (envDeleteError) {
      console.error('Error deleting environment variables:', envDeleteError);
    }
    
    // 2. デプロイを削除
    console.log('Deleting deployments');
    const { error: deployDeleteError } = await supabase
      .from('nextdock_deploys')
      .delete()
      .eq('app_id', id);
    
    if (deployDeleteError) {
      console.error('Error deleting deployments:', deployDeleteError);
    }
    
    // 3. 最後にアプリ本体を削除
    console.log('Deleting app record');
    const { error: appDeleteError } = await supabase
      .from('nextdock_apps')
      .delete()
      .eq('id', id);
    
    if (appDeleteError) throw appDeleteError;
    
    console.log('App deleted successfully');
    res.status(200).json({
      message: 'App deleted successfully',
    });
  } catch (error: any) {
    console.error('Error in deleteApp:', error);
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to delete app',
    });
  }
};

// アプリの停止/起動
export const toggleAppStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { action } = req.body; // 'start' または 'stop'
  
  if (!action || (action !== 'start' && action !== 'stop')) {
    res.status(400).json({
      error: 'Bad Request',
      message: "Action must be 'start' or 'stop'",
    });
    return;
  }
  
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    // アプリが存在するか確認 - テーブル名を変更
    const { data: existingApp, error: fetchError } = await supabase
      .from('nextdock_apps')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError) throw fetchError;
    
    if (!existingApp) {
      throw new AppError('App not found', 404);
    }
    
    // 権限チェック
    if (existingApp.user_id !== req.user.id) {
      throw new AppError('You do not have permission to manage this app', 403);
    }
    
    // アプリのステータスを更新
    const newStatus = action === 'start' ? 'running' : 'stopped';
    
    // Dockerコンテナを開始/停止
    if (existingApp.container_id) {
      try {
        if (action === 'start') {
          await dockerService.startContainer(existingApp.container_id);
        } else {
          await dockerService.stopContainer(existingApp.container_id);
        }
      } catch (containerError: any) {
        // コンテナが見つからない場合など
        console.error('Docker container error:', containerError);
        
        if (action === 'stop') {
          // 停止の場合はエラーを無視してステータスのみ更新
          console.log('Ignoring container error for stop action and updating status only');
        } else {
          // 開始の場合はデプロイが必要であることを伝える
          throw new AppError('Container not found or invalid. Please deploy the application first.', 400);
        }
      }
    } else if (action === 'start') {
      // コンテナIDがない場合
      if (existingApp.last_deployed_at) {
        // 以前にデプロイされたことがある場合は再デプロイを促す
        throw new AppError('No container exists for this app. Please redeploy the application.', 400);
      } else {
        // 一度もデプロイされていない場合
        throw new AppError('This app has not been deployed yet. Please deploy the application first.', 400);
      }
    }
    
    // アプリのステータスを更新 - テーブル名を変更
    const { data: updatedApp, error: updateError } = await supabase
      .from('nextdock_apps')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    if (!updatedApp) throw new AppError('App status update failed', 500);
    
    res.status(200).json({
      message: `App ${action === 'start' ? 'started' : 'stopped'} successfully`,
      app: updatedApp,
    });
  } catch (error: any) {
    console.error('Error toggling app status:', error);
    res.status(error.statusCode || 500).json({
      error: error.name || 'Internal Server Error',
      message: error.message || 'Failed to update app status',
    });
  }
};

export default {
  getApps,
  getApp,
  createApp,
  updateApp,
  deleteApp,
  toggleAppStatus,
};
