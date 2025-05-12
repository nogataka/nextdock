import { Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { AuthenticatedRequest, User, AppError } from '../types';

dotenv.config();

// JWTペイロードの型
interface TokenPayload extends JwtPayload {
  id: string;
  email: string;
}

// Supabaseクライアントの初期化
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// JWT検証ミドルウェア
export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // リクエストヘッダーからトークンを取得
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication token is required', 401);
    }
    
    const token = authHeader.split(' ')[1];
    
    // JWTシークレットが設定されていることを確認
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new AppError('JWT secret is not configured', 500);
    }
    
    // トークンを検証
    const decoded = jwt.verify(token, jwtSecret) as TokenPayload;
    
    // ユーザー情報をリクエストに追加
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: '',  // Supabaseから取得後に更新
    };
    
    // Supabaseでユーザーの存在確認 - テーブル名を変更
    const { data, error } = await supabase
      .from('nextdock_users')
      .select('id, email, name, role')
      .eq('id', decoded.id)
      .single();
    
    if (error || !data) {
      throw new AppError('User not found', 401);
    }
    
    // ユーザーの詳細情報を追加
    req.user = data as User;
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
      return;
    }
    
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: 'Unauthorized',
        message: error.message,
      });
      return;
    }
    
    next(error);
  }
};

// 管理者権限チェックミドルウェア
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Admin privileges required',
    });
    return;
  }
  
  next();
};

export default {
  authenticate,
  requireAdmin,
};
