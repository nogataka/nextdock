import { Router } from 'express';
import appsController from '../controllers/appsController';
import { authenticate } from '../middleware/auth';

const router = Router();

// すべてのルートで認証が必要
router.use(authenticate);

// アプリ一覧取得
router.get('/', appsController.getApps);

// アプリ詳細取得
router.get('/:id', appsController.getApp);

// 新規アプリ作成
router.post('/', appsController.createApp);

// アプリ更新
router.put('/:id', appsController.updateApp);

// アプリ削除
router.delete('/:id', appsController.deleteApp);

// アプリの停止/起動
router.post('/:id/status', appsController.toggleAppStatus);

export default router;
