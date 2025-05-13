import Docker from 'dockerode';
import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { promisify } from 'util';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { DockerBuildOptions, EnvVar, AppError } from '../types';
import { exec } from 'child_process';
import { PORT_RANGE_START, PORT_RANGE_END } from '../config';
import { checkNextjsProject } from './githubService';

dotenv.config();

const execPromise = promisify(exec);

// Dockerクライアントの初期化
const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
});

/**
 * Dockerfileの存在を確認する
 * @param repoPath レポジトリのパス
 * @returns Dockerfileが存在するかどうか
 */
export const checkDockerfile = async (repoPath: string): Promise<boolean> => {
  try {
    console.log(`Checking for Dockerfile in: ${repoPath}`);
    
    // ディレクトリの内容をリスト
    const files = await fs.readdir(repoPath);
    console.log(`Files in repository (${files.length}):`, files);
    
    // 標準のDockerfileをチェック
    const standardPath = path.join(repoPath, 'Dockerfile');
    let standardExists = false;
    
    try {
      await fs.access(standardPath);
      // ファイルの内容をログ出力
      const dockerfileContent = await fs.readFile(standardPath, 'utf8');
      console.log(`Dockerfile content:\n${dockerfileContent}`);
      standardExists = true;
    } catch (err) {
      console.log(`Standard Dockerfile not found at ${standardPath}`);
    }
    
    // 大文字小文字を区別せずにDockerfileを検索
    if (!standardExists) {
      for (const file of files) {
        if (file.toLowerCase() === 'dockerfile') {
          const altPath = path.join(repoPath, file);
          console.log(`Found alternative Dockerfile: ${altPath}`);
          
          // ファイルの内容をログ出力
          const dockerfileContent = await fs.readFile(altPath, 'utf8');
          console.log(`Alternative Dockerfile content:\n${dockerfileContent}`);
          
          return true;
        }
      }
    }
    
    return standardExists;
  } catch (error) {
    console.error('Error checking for Dockerfile:', error);
    return false;
  }
};

// Next.js用のDockerfileを生成
export const generateNextjsDockerfile = async (repoPath: string): Promise<string> => {
  const dockerfilePath = path.join(repoPath, 'Dockerfile');
  
  // Next.js用のDockerfileテンプレート
  const dockerfile = `
# ベースイメージ
FROM node:18-alpine AS builder

# 作業ディレクトリを設定
WORKDIR /app

# パッケージファイルをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci

# すべてのファイルをコピー
COPY . .

# Next.jsアプリケーションをビルド
RUN npm run build

# 本番環境用イメージ
FROM node:18-alpine AS runner

# 作業ディレクトリを設定
WORKDIR /app

# 本番環境用の依存関係のみをインストール
COPY package*.json ./
RUN npm ci --only=production

# ビルドされたアプリケーションをコピー
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# ポート開放と環境変数
EXPOSE 80
ENV PORT=80

# アプリケーションを起動
CMD ["npm", "start"]
`;

  // Dockerfileを書き込み
  await fs.writeFile(dockerfilePath, dockerfile);
  console.log(`Generated Next.js Dockerfile at ${dockerfilePath}`);
  console.log(`Dockerfile configuration: EXPOSE 80 and ENV PORT=80`);
  
  return dockerfilePath;
};

// Dockerイメージをビルド
export const buildImage = async (
  repoPath: string,
  imageTag: string,
  buildMethod: string,
  envVars: EnvVar[] = []
): Promise<string> => {
  try {
    console.log(`BEGIN buildImage - repoPath: ${repoPath}, imageTag: ${imageTag}, buildMethod: ${buildMethod}`);
    
    // Dockerfileの存在を確認
    const hasDockerfile = await checkDockerfile(repoPath);
    console.log(`Dockerfile exists: ${hasDockerfile}`);
    
    // Dockerfileがなく、Next.js用のビルドメソッドが選択されていれば生成
    if (!hasDockerfile) {
      console.log(`No Dockerfile found in ${repoPath}. Build method: ${buildMethod}`);
      
      if (buildMethod === 'nextjs' || buildMethod === 'auto') {
        console.log('Generating Next.js Dockerfile...');
        await generateNextjsDockerfile(repoPath);
        console.log('Next.js Dockerfile generated successfully');
        
        // 生成後に再確認
        const hasGeneratedDockerfile = await checkDockerfile(repoPath);
        console.log(`Generated Dockerfile exists: ${hasGeneratedDockerfile}`);
        
        if (!hasGeneratedDockerfile) {
          throw new Error('Failed to generate Dockerfile');
        }
      } else {
        // Dockerfileが必要なのにない場合は明確なエラーメッセージを表示
        throw new Error(`Cannot locate specified Dockerfile: Dockerfile in ${repoPath}. Please add a Dockerfile to your repository or choose 'auto' or 'nextjs' build method.`);
      }
    } else {
      console.log(`Dockerfile found in ${repoPath}`);
    }
    
    // ビルド引数（環境変数などを含む）
    const buildArgs: Record<string, string> = {};
    envVars.forEach(env => {
      buildArgs[env.key] = env.value;
    });
    console.log(`Build args: ${Object.keys(buildArgs).length} environment variables`);
    
    // ビルドするファイルを取得
    console.log('Preparing build context for Docker daemon');
    const files = await fs.readdir(repoPath);
    console.log(`Found ${files.length} files/directories in build context`);
    
    // Dockerイメージをビルド
    console.log('Starting Docker build...');
    return new Promise<string>((resolve, reject) => {
      docker.buildImage({
        context: repoPath,
        src: ['.']  // すべてのファイルを含める
      }, {
        t: imageTag,
        buildargs: buildArgs,
      }, (err: any, stream: any) => {
        if (err) {
          console.error('Docker build error:', err);
          return reject(err);
        }
        
        if (!stream) {
          console.error('Docker build stream not available');
          return reject(new Error('Build stream not available'));
        }
        
        // 進行状況のログを表示
        console.log('Docker build in progress...');
        
        // ビルドログを処理
        docker.modem.followProgress(
          stream,
          (err: any, res: any) => {
            if (err) {
              console.error('Docker build failed:', err);
              return reject(err);
            }
            console.log('Docker build completed successfully');
            console.log(`Image created: ${imageTag}`);
            resolve(imageTag);
          },
          (event: any) => {
            // 進行状況のイベントを処理
            if (event.stream) {
              process.stdout.write(event.stream);
            }
          }
        );
      });
    });
  } catch (error) {
    console.error('Error building Docker image:', error);
    throw error;
  } finally {
    console.log('END buildImage');
  }
};

// Dockerコンテナを実行
export const runContainer = async (
  imageTag: string, 
  subdomain: string, 
  envVars: EnvVar[] = []
): Promise<string> => {
  try {
    // コンテナ名を生成
    const containerName = `nextdock-${subdomain}`;
    
    // 環境変数を整形
    const env = envVars.map(e => `${e.key}=${e.value}`);
    
    // 必要なNginx Proxy環境変数が設定されているか確認
    const baseDomain = process.env.BASE_DOMAIN || 'nextdock.dev';
    const appDomain = `${subdomain}.${baseDomain}`;
    
    const requiredEnvKeys = ['VIRTUAL_HOST', 'VIRTUAL_PORT', 'LETSENCRYPT_HOST', 'LETSENCRYPT_EMAIL'];
    const missingEnvKeys = requiredEnvKeys.filter(key => !envVars.some(env => env.key === key));
    
    // 不足している環境変数を追加
    if (missingEnvKeys.length > 0) {
      console.log(`Adding missing Nginx Proxy environment variables: ${missingEnvKeys.join(', ')}`);
      
      if (!envVars.some(env => env.key === 'VIRTUAL_HOST')) {
        env.push(`VIRTUAL_HOST=${appDomain}`);
      }
      
      if (!envVars.some(env => env.key === 'VIRTUAL_PORT')) {
        env.push(`VIRTUAL_PORT=80`);
      }
      
      if (!envVars.some(env => env.key === 'LETSENCRYPT_HOST')) {
        env.push(`LETSENCRYPT_HOST=${appDomain}`);
      }
      
      if (!envVars.some(env => env.key === 'LETSENCRYPT_EMAIL')) {
        env.push(`LETSENCRYPT_EMAIL=${process.env.DEFAULT_EMAIL || 'admin@'}`);
      }
    }
    
    // Dockerfileでの設定を確認するためのログ
    console.log(`Starting container from image: ${imageTag}`);
    console.log(`Container will be named: ${containerName}`);
    console.log(`Environment variables count: ${env.length}`);
    
    // nginx-proxyと同じネットワークを使用
    const networkMode = process.env.DOCKER_NETWORK || 'repo_nextdock-network';
    console.log(`Using network: ${networkMode}`);
    
    // コンテナを作成
    const container = await docker.createContainer({
      Image: imageTag,
      name: containerName,
      Env: env,
      ExposedPorts: {
        '80/tcp': {},
      },
      HostConfig: {
        PortBindings: {
          // ランダムなホストポートを割り当て
          '80/tcp': [{ HostPort: '0' }],
        },
        // リソース制限（オプション）
        Memory: 512 * 1024 * 1024, // 512MB
        MemorySwap: 1024 * 1024 * 1024, // 1GB
        NanoCpus: 1000000000, // 1 CPU
        RestartPolicy: {
          Name: 'always',
        },
        // nginx-proxyと同じネットワークに接続
        NetworkMode: networkMode,
      },
      // コンテナラベル（管理用）
      Labels: {
        'com.nextdock.app': subdomain,
        'com.nextdock.type': 'app',
      },
    });
    
    // コンテナを起動
    await container.start();
    
    // 割り当てられたポートを取得
    const containerInfo = await container.inspect();
    const port = containerInfo.NetworkSettings.Ports['80/tcp'] ? 
      containerInfo.NetworkSettings.Ports['80/tcp'][0].HostPort : null;
    
    if (!port) {
      throw new Error('Failed to get container port');
    }
    
    console.log(`Container started successfully. Port mapping: Host ${port} -> Container 80`);
    console.log(`App will be available at: https://${appDomain}`);
    
    return container.id;
  } catch (error) {
    console.error('Error running Docker container:', error);
    throw error;
  }
};

// コンテナを起動
export const startContainer = async (containerId: string): Promise<void> => {
  if (!containerId) return;
  
  try {
    const container = docker.getContainer(containerId);
    await container.start();
  } catch (error) {
    console.error('Error starting container:', error);
    throw error;
  }
};

// コンテナを停止
export const stopContainer = async (containerId: string): Promise<void> => {
  if (!containerId) return;
  
  try {
    const container = docker.getContainer(containerId);
    await container.stop();
  } catch (error) {
    console.error('Error stopping container:', error);
    throw error;
  }
};

// コンテナを再起動
export const restartContainer = async (containerId: string): Promise<void> => {
  if (!containerId) return;
  
  try {
    const container = docker.getContainer(containerId);
    await container.restart();
  } catch (error) {
    console.error('Error restarting container:', error);
    throw error;
  }
};

// コンテナを停止して削除
export const stopAndRemoveContainer = async (containerId: string): Promise<void> => {
  if (!containerId) return;
  
  try {
    const container = docker.getContainer(containerId);
    
    // コンテナが実行中かどうかを確認
    const containerInfo = await container.inspect();
    
    if (containerInfo.State.Running) {
      // コンテナを停止
      await container.stop();
    }
    
    // コンテナを削除
    await container.remove();
  } catch (error: any) {
    // コンテナが存在しないなどのエラーは無視
    if (error.statusCode !== 404) {
      console.error('Error removing container:', error);
      throw error;
    }
  }
};

// コンテナのログを取得
export const getContainerLogs = async (
  containerId: string, 
  options: { tail?: number; follow?: boolean; stdout?: boolean; stderr?: boolean } = {}
): Promise<string> => {
  if (!containerId) return '';
  
  try {
    const container = docker.getContainer(containerId);
    
    // dockerode用に型を修正
    const mergedOptions: any = {
      tail: options.tail || 100,
      stdout: options.stdout !== false,
      stderr: options.stderr !== false
    };
    
    // followオプションがtrueの場合に限り明示的に設定
    if (options.follow === true) {
      mergedOptions.follow = true;
    }
    
    // ログを取得
    const logs = await container.logs(mergedOptions) as unknown as Buffer;
    
    // バッファをテキストに変換
    return logs.toString('utf8');
  } catch (error) {
    console.error('Error getting container logs:', error);
    throw error;
  }
};

// Gitがインストールされているか確認
export const checkGitInstalled = async (): Promise<boolean> => {
  try {
    // シェルコマンドでgitのバージョンを確認
    const { stdout } = await execPromise('git --version');
    console.log(`Git installed: ${stdout.trim()}`);
    return true;
  } catch (error) {
    console.error('Git is not installed:', error);
    return false;
  }
};

// Gitをインストール（Alpineベースのイメージ用）
export const installGitAlpine = async (dockerfilePath: string): Promise<void> => {
  try {
    // Dockerfileを読み込む
    let dockerfileContent = await fs.readFile(dockerfilePath, 'utf8');
    
    // すでにgitのインストールが含まれているか確認
    if (dockerfileContent.includes('apk add --no-cache git')) {
      console.log('Git installation already included in Dockerfile');
      return;
    }
    
    // gitインストールコマンドを追加
    dockerfileContent = dockerfileContent.replace(
      /FROM\s+.*?(?:alpine|Alpine).*?\n/,
      '$&RUN apk add --no-cache git\n'
    );
    
    // 修正したDockerfileを保存
    await fs.writeFile(dockerfilePath, dockerfileContent);
    console.log('Added git installation to Alpine-based Dockerfile');
  } catch (error) {
    console.error('Failed to modify Dockerfile for git installation:', error);
    throw error;
  }
};

// Gitをインストール（Debian/Ubuntuベースのイメージ用）
export const installGitDebian = async (dockerfilePath: string): Promise<void> => {
  try {
    // Dockerfileを読み込む
    let dockerfileContent = await fs.readFile(dockerfilePath, 'utf8');
    
    // すでにgitのインストールが含まれているか確認
    if (dockerfileContent.includes('apt-get') && dockerfileContent.includes('git')) {
      console.log('Git installation already included in Dockerfile');
      return;
    }
    
    // gitインストールコマンドを追加
    if (dockerfileContent.includes('apt-get update')) {
      // apt-get updateが既にある場合は、そのコマンドにgitを追加
      dockerfileContent = dockerfileContent.replace(
        /RUN\s+apt-get\s+update.*?(?:install|-y)/,
        '$& git'
      );
    } else {
      // apt-get updateがない場合は、新しいRUNコマンドを追加
      dockerfileContent = dockerfileContent.replace(
        /FROM\s+.*?\n/,
        '$&RUN apt-get update && apt-get install -y git\n'
      );
    }
    
    // 修正したDockerfileを保存
    await fs.writeFile(dockerfilePath, dockerfileContent);
    console.log('Added git installation to Debian/Ubuntu-based Dockerfile');
  } catch (error) {
    console.error('Failed to modify Dockerfile for git installation:', error);
    throw error;
  }
};

// Dockerfileにgitインストールを追加
export const ensureGitInstalled = async (repoPath: string): Promise<void> => {
  const dockerfilePath = path.join(repoPath, 'Dockerfile');
  
  try {
    // Dockerfileの内容を読み込む
    const dockerfileContent = await fs.readFile(dockerfilePath, 'utf8');
    
    // ベースイメージを確認
    if (dockerfileContent.toLowerCase().includes('alpine')) {
      await installGitAlpine(dockerfilePath);
    } else {
      await installGitDebian(dockerfilePath);
    }
  } catch (error) {
    console.error('Error ensuring git is installed:', error);
    throw error;
  }
};

export default {
  checkDockerfile,
  generateNextjsDockerfile,
  buildImage,
  runContainer,
  startContainer,
  stopContainer,
  restartContainer,
  stopAndRemoveContainer,
  getContainerLogs,
  checkGitInstalled,
  ensureGitInstalled,
};
