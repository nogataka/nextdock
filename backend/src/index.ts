import express, { Request, Response, NextFunction } from 'express';
import 'express-async-errors';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

// ルーターのインポート
import authRouter from './routes/auth';
import appsRouter from './routes/apps';
import deploysRouter from './routes/deploys';
import domainsRouter from './routes/domains';
import githubRouter from './routes/github';
import { ErrorResponse, AppError } from './types';

// 設定の読み込み
dotenv.config();

// アプリケーションの初期化
const app = express();
const PORT = process.env.PORT || 3001;

// ミドルウェアの設定
app.use(cors({
  origin: (origin, callback) => {
    // 開発環境ではすべてのオリジンを許可
    if (!origin || process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // 許可するオリジンのリスト
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      process.env.BASE_DOMAIN ? `http://${process.env.BASE_DOMAIN}` : null,
      process.env.BASE_DOMAIN ? `https://${process.env.BASE_DOMAIN}` : null,
      // サブドメインも許可
      process.env.BASE_DOMAIN ? new RegExp(`^https?://.*\\.${process.env.BASE_DOMAIN.replace(/\./g, '\\.')}$`) : null
    ].filter(Boolean);
    
    // オリジンが許可リストに含まれているか、または正規表現にマッチするか確認
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return allowedOrigin === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(morgan('dev'));

// ルーティングの設定
app.use('/api/auth', authRouter);
app.use('/api/apps', appsRouter);
app.use('/api/deploys', deploysRouter);
app.use('/api/domains', domainsRouter);
app.use('/api/github', githubRouter);

// ルートエンドポイント
app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'NextDock API',
    version: '0.1.0',
  });
});

// 404エラーハンドリング
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource could not be found',
  } as ErrorResponse);
});

// グローバルエラーハンドリング
app.use((err: Error | AppError, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  
  // エラーレスポンスを整形
  const statusCode = 'statusCode' in err ? err.statusCode : 500;
  const errorMessage = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: err.name || 'Error',
    message: errorMessage,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  } as ErrorResponse);
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`NextDock API server is running on port ${PORT}`);
});

export default app;
