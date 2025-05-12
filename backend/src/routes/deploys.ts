import { Router } from 'express';
import deploysController from '../controllers/deploysController';
import { authenticate } from '../middleware/auth';

const router = Router();

// すべてのルートで認証が必要
router.use(authenticate);

// アプリのデプロイ履歴を取得
router.get('/app/:appId', deploysController.getDeployHistory);

// 特定のデプロイの詳細を取得
router.get('/app/:appId/deploy/:deployId', deploysController.getDeployDetails);

// 新しいデプロイをトリガー
router.post('/app/:appId', deploysController.triggerDeploy);

// デプロイのログを取得
router.get('/app/:appId/deploy/:deployId/logs', deploysController.getDeployLogs);

// リポジトリURLから直接デプロイ（新規アプリ作成）
router.post('/repository', deploysController.deployFromRepository);

export default router;
