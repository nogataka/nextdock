import { Router } from 'express';
import domainsController from '../controllers/domainsController';
import { authenticate } from '../middleware/auth';

const router = Router();

// すべてのルートで認証が必要
router.use(authenticate);

// アプリのドメイン設定を取得
router.get('/app/:appId', domainsController.getDomainSettings);

// カスタムドメインを追加
router.post('/app/:appId', domainsController.addCustomDomain);

// カスタムドメインを検証
router.post('/app/:appId/domain/:domainId/verify', domainsController.verifyCustomDomain);

// カスタムドメインを削除
router.delete('/app/:appId/domain/:domainId', domainsController.removeCustomDomain);

// プライマリドメインを設定
router.put('/app/:appId/primary', domainsController.setPrimaryDomain);

export default router;
