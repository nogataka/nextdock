import { Router } from 'express';
import authController from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// ユーザー登録
router.post('/register', authController.register);

// ログイン
router.post('/login', authController.login);

// ユーザープロフィール取得（認証が必要）
router.get('/profile', authenticate, authController.getProfile);

// GitHub OAuth認証コールバック
router.get('/github/callback', authController.githubCallback);

// GitHubアカウント連携（認証が必要）
router.post('/github/connect', authenticate, authController.connectGithub);

export default router;
