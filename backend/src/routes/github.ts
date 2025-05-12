import { Router } from 'express';
import githubController from '../controllers/githubController';
import { authenticate } from '../middleware/auth';

const router = Router();

// ユーザーのGitHubリポジトリを取得（認証が必要）
router.get('/repositories', authenticate, githubController.getRepositories);

// リポジトリのブランチを取得（認証が必要）
router.get('/repositories/:repoName/branches', authenticate, githubController.getBranches);

// GitHubウェブフックを処理（認証不要）
router.post('/webhook', githubController.handleWebhook);

export default router;
