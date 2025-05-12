import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { User, AuthenticatedRequest, AppError } from '../types';
import axios from 'axios';

dotenv.config();

// Supabaseクライアントの初期化
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// JWTトークン生成関数
const generateToken = (user: User): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AppError('JWT secret is not configured', 500);
  }
  
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    jwtSecret,
    { expiresIn: '7d' }
  );
};

// ユーザー登録
export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, name } = req.body;
  
  if (!email || !password || !name) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Email, password, and name are required',
    });
    return;
  }
  
  try {
    // Supabaseで認証
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (authError) throw authError;
    if (!authData.user) throw new AppError('User creation failed', 500);
    
    // ユーザープロファイルを作成 - テーブル名を変更
    const { data: userData, error: userError } = await supabase
      .from('nextdock_users')
      .insert([
        {
          id: authData.user.id,
          email,
          name,
          role: 'user',
        },
      ])
      .select();
    
    if (userError) throw userError;
    if (!userData || userData.length === 0) throw new AppError('User profile creation failed', 500);
    
    // JWTトークンを生成
    const token = generateToken(userData[0] as User);
    
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: userData[0].id,
        email: userData[0].email,
        name: userData[0].name,
      },
      token,
    });
  } catch (error: any) {
    if (error.code === '23505') { // PostgreSQLの一意制約違反エラーコード
      res.status(409).json({
        error: 'Conflict',
        message: 'Email already in use',
      });
      return;
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
};

// ログイン
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Email and password are required',
    });
    return;
  }
  
  try {
    // Supabaseで認証
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (authError) throw authError;
    if (!authData.user) throw new AppError('Login failed', 401);
    
    // ユーザー情報を取得 - テーブル名を変更
    const { data: userData, error: userError } = await supabase
      .from('nextdock_users')
      .select('id, email, name, role')
      .eq('id', authData.user.id)
      .single();
    
    if (userError) throw userError;
    if (!userData) throw new AppError('User not found', 404);
    
    // JWTトークンを生成
    const token = generateToken(userData as User);
    
    res.status(200).json({
      message: 'Login successful',
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
      },
      token,
    });
  } catch (error: any) {
    if (error.message === 'Invalid login credentials') {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
      return;
    }
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
};

// ユーザープロフィール取得
export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    // テーブル名を変更
    const { data, error } = await supabase
      .from('nextdock_users')
      .select('id, email, name, role')
      .eq('id', req.user.id)
      .single();
    
    if (error) throw error;
    if (!data) throw new AppError('User not found', 404);
    
    res.status(200).json({
      user: data,
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
};

// GitHub OAuth認証（GitHubからのコールバック処理）
export const githubCallback = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.query;
  
  if (!code || typeof code !== 'string') {
    res.status(400).json({
      error: 'Bad Request',
      message: 'GitHub authorization code is required',
    });
    return;
  }
  
  try {
    // GitHubのアクセストークンを取得
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new AppError('GitHub client credentials are not configured', 500);
    }
    
    // GitHubのアクセストークンエンドポイントにリクエストを送信
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );
    
    // アクセストークンを取得
    if (!tokenResponse.data.access_token) {
      throw new AppError('Failed to get GitHub access token', 500);
    }
    
    const accessToken = tokenResponse.data.access_token;
    
    // フロントエンドにリダイレクト
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/github-callback?token=${accessToken}`);
  } catch (error: any) {
    console.error('GitHub OAuth error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'GitHub authentication failed',
    });
  }
};

// GitHubアカウントとの連携
export const connectGithub = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || !req.user.id) {
      throw new AppError('Unauthorized', 401);
    }
    
    const { githubToken } = req.body;
    
    if (!githubToken) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'GitHub token is required',
      });
      return;
    }
    
    console.log(`Connecting GitHub account for user: ${req.user.id}`);
    console.log(`GitHub token starts with: ${githubToken.substring(0, 5)}...`);
    
    // トークンが有効かテスト
    try {
      const testResponse = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });
      
      console.log('GitHub token validation successful:', {
        login: testResponse.data.login,
        id: testResponse.data.id,
      });
    } catch (error: any) {
      console.error('GitHub token validation failed:', error.message);
      if (error.response) {
        console.error('GitHub API error details:', {
          status: error.response.status,
          data: error.response.data,
        });
      }
      
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid GitHub token',
      });
      return;
    }
    
    // GitHubトークンをユーザーレコードに保存 - テーブル名を変更
    const { data, error } = await supabase
      .from('nextdock_users')
      .update({ github_token: githubToken })
      .eq('id', req.user.id)
      .select();
    
    if (error) {
      console.error('Supabase update error:', error);
      throw new AppError('Failed to update user record', 500);
    }
    
    if (!data || data.length === 0) {
      console.error('No user record was updated');
      throw new AppError('Failed to update user record', 500);
    }
    
    console.log('GitHub account connected successfully for user:', req.user.id);
    
    res.status(200).json({
      message: 'GitHub account connected successfully',
      user: {
        id: data[0].id,
        email: data[0].email,
        name: data[0].name,
        githubToken: true, // トークン自体は返さず、存在を示すフラグだけ返す
      },
    });
  } catch (error: any) {
    console.error('Error connecting GitHub account:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
};

export default {
  register,
  login,
  getProfile,
  githubCallback,
  connectGithub,
};
