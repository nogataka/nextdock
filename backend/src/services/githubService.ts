import axios from 'axios';
import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { GithubBranch, AppError, CommitInfo } from '../types';

dotenv.config();

// GitHub APIのベースURL
const GITHUB_API_URL = 'https://api.github.com';

// リポジトリの存在を確認
export const checkRepository = async (repoFullName: string, accessToken: string): Promise<boolean> => {
  try {
    const response = await axios.get(`${GITHUB_API_URL}/repos/${repoFullName}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

// リポジトリのブランチを取得
export const getRepositoryBranches = async (repoFullName: string, accessToken: string): Promise<GithubBranch[]> => {
  try {
    const response = await axios.get(`${GITHUB_API_URL}/repos/${repoFullName}/branches`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching repository branches:', error);
    throw error;
  }
};

// リポジトリをクローン
export const cloneRepository = async (
  repositoryUrl: string,
  branch: string = 'main',
  targetPath: string
): Promise<CommitInfo> => {
  try {
    console.log(`BEGIN cloneRepository to ${targetPath}`);
    console.log(`Repository URL: ${repositoryUrl}`);
    console.log(`Branch: ${branch}`);
    
    // URLの形式を検証
    if (!repositoryUrl.includes('github.com')) {
      console.error(`Invalid repository URL format: ${repositoryUrl}`);
      console.error('URLにはgithub.comドメインが含まれている必要があります');
      throw new Error(`Invalid repository URL: ${repositoryUrl} - URL must include github.com domain`);
    }
    
    if (!repositoryUrl.endsWith('.git')) {
      console.warn(`Warning: Repository URL does not end with .git: ${repositoryUrl}`);
      repositoryUrl = `${repositoryUrl}.git`;
      console.log(`Modified repository URL: ${repositoryUrl}`);
    }
    
    // ディレクトリが存在するか確認し、存在する場合は削除
    try {
      await fs.access(targetPath);
      console.log(`Target path ${targetPath} already exists, removing...`);
      await fs.rm(targetPath, { recursive: true, force: true });
      console.log(`Successfully removed existing directory: ${targetPath}`);
    } catch (error) {
      // ディレクトリが存在しない場合は問題ない
      console.log(`Target path ${targetPath} does not exist, will create it`);
    }

    // 親ディレクトリが存在することを確認
    const parentDir = path.dirname(targetPath);
    try {
      await fs.access(parentDir);
      console.log(`Parent directory exists: ${parentDir}`);
    } catch (error) {
      console.log(`Creating parent directory: ${parentDir}`);
      await fs.mkdir(parentDir, { recursive: true });
    }

    // ディレクトリを作成
    await fs.mkdir(targetPath, { recursive: true });
    console.log(`Created target directory: ${targetPath}`);

    // Git操作の初期化
    const git: SimpleGit = simpleGit();
    console.log(`Initialized git client, starting clone...`);

    // リポジトリをクローン
    console.log(`Cloning ${repositoryUrl} to ${targetPath}...`);
    await git.clone(repositoryUrl, targetPath, ['--depth', '1', '--branch', branch]);
    console.log(`Successfully cloned repository to ${targetPath}`);

    // ファイル一覧を取得（デバッグ用）
    try {
      const files = await fs.readdir(targetPath);
      console.log(`Files in cloned repository (${files.length} items):`);
      for (const file of files) {
        const filePath = path.join(targetPath, file);
        const stats = await fs.stat(filePath);
        console.log(`- ${file} (${stats.isDirectory() ? 'directory' : 'file'})`);
      }
    } catch (err) {
      console.error(`Error listing repository files:`, err);
    }

    // 最新のコミット情報を取得
    console.log(`Getting latest commit info...`);
    const gitInDir = simpleGit(targetPath);
    const log = await gitInDir.log({ maxCount: 1 });
    
    if (log.latest) {
      console.log(`Latest commit: ${log.latest.hash} - ${log.latest.message}`);
      return {
        hash: log.latest.hash,
        message: log.latest.message,
        date: log.latest.date,
        author: log.latest.author_name
      };
    }
    
    console.log(`No commit info found, returning defaults`);
    return {
      hash: 'unknown',
      message: 'No commit info available',
      date: new Date().toISOString(),
      author: 'unknown'
    };
  } catch (error: any) {
    console.error(`Error cloning repository:`, error);
    throw new Error(`Failed to clone repository: ${error.message}`);
  } finally {
    console.log(`END cloneRepository`);
  }
};

// package.jsonの存在を確認してNext.jsプロジェクトかどうかを判定
export const checkNextjsProject = async (repoPath: string): Promise<boolean> => {
  try {
    // package.jsonの存在を確認
    const packageJsonPath = path.join(repoPath, 'package.json');
    const packageJsonExists = await fs.access(packageJsonPath)
      .then(() => true)
      .catch(() => false);
    
    if (!packageJsonExists) {
      return false;
    }
    
    // package.jsonの内容を読み込み
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);
    
    // Next.jsがdependenciesに含まれているか確認
    return !!(
      (packageJson.dependencies && packageJson.dependencies.next) ||
      (packageJson.devDependencies && packageJson.devDependencies.next)
    );
  } catch (error) {
    console.error('Error checking Next.js project:', error);
    return false;
  }
};

// リポジトリにwebhookを追加
export const addWebhook = async (
  repoFullName: string, 
  accessToken: string, 
  webhookUrl: string
): Promise<any> => {
  try {
    const response = await axios.post(
      `${GITHUB_API_URL}/repos/${repoFullName}/hooks`,
      {
        name: 'web',
        active: true,
        events: ['push'],
        config: {
          url: webhookUrl,
          content_type: 'json',
          insecure_ssl: '0',
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error adding webhook to repository:', error);
    throw error;
  }
};

export default {
  checkRepository,
  getRepositoryBranches,
  cloneRepository,
  checkNextjsProject,
  addWebhook,
};
