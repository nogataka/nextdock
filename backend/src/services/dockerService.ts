import axios from 'axios';
import simpleGit, { SimpleGit } from 'simple-git';
import Docker from 'dockerode';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { promisify } from 'util';
import { exec } from 'child_process';
import { GithubBranch, AppError, CommitInfo, EnvVar } from '../types';

dotenv.config();

const execPromise = promisify(exec);

// Dockerクライアントの初期化
const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
});

// 外部コマンド実行関数
async function executeDockerCommand(command: string): Promise<string> {
  try {
    console.log(`実行コマンド: ${command}`);
    const { stdout, stderr } = await execPromise(command);
    if (stderr && !stderr.includes('warning')) {
      console.error(`コマンドエラー: ${stderr}`);
    }
    return stdout.trim();
  } catch (error: any) {
    console.error(`コマンド実行エラー: ${error.message}`);
    throw error;
  }
}

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
    
    console.log(`BEGIN runContainer - imageTag: ${imageTag}, containerName: ${containerName}`);
    
    // 環境変数を整形
    const env = envVars.map(e => `${e.key}=${e.value}`);
    
    // 必要なNginx Proxy環境変数が設定されているか確認
    const baseDomain = process.env.BASE_DOMAIN || 'nextdock.org';
    const appDomain = `${subdomain}.${baseDomain}`;
    
    // カスタムドメインを検出（VIRTUAL_HOSTから）
    let customDomain = '';
    const virtualHostEnv = envVars.find(e => e.key === 'VIRTUAL_HOST');
    if (virtualHostEnv && virtualHostEnv.value) {
      if (!virtualHostEnv.value.endsWith(`.${baseDomain}`)) {
        customDomain = virtualHostEnv.value;
        console.log(`カスタムドメインを検出: ${customDomain}`);
      }
    }
    
    // 必要な環境変数が設定されているか確認
    const requiredEnvKeys = ['VIRTUAL_HOST', 'VIRTUAL_PORT'];
    
    // 不足している環境変数を追加
    if (!envVars.some(env => env.key === 'VIRTUAL_HOST')) {
      env.push(`VIRTUAL_HOST=${appDomain}`);
    }
    
    if (!envVars.some(env => env.key === 'VIRTUAL_PORT')) {
      env.push(`VIRTUAL_PORT=80`);
    }
    
    // Nginxネットワークの設定
    // Docker Composeのプロジェクト名を考慮したネットワーク名を使用
    const networkMode = process.env.DOCKER_NETWORK || 'nextdock_nextdock-network';
    console.log(`使用ネットワーク: ${networkMode}`);
    
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
          '80/tcp': [{ HostPort: '0' }],
        },
        Memory: 512 * 1024 * 1024, // 512MB
        MemorySwap: 1024 * 1024 * 1024, // 1GB
        NanoCpus: 1000000000, // 1 CPU
        RestartPolicy: {
          Name: 'always',
        },
        NetworkMode: networkMode,
      },
      Labels: {
        'com.nextdock.app': subdomain,
        'com.nextdock.type': 'app',
        'com.nextdock.custom_domain': customDomain || 'false',
      },
    });
    
    // コンテナを起動
    await container.start();
    console.log(`コンテナを起動しました: ${containerName}`);
    
    // カスタムドメインの証明書を発行（必要な場合）
    if (customDomain) {
      try {
        console.log(`カスタムドメイン ${customDomain} の証明書を確認/発行します`);
        
        // ステージング環境を使用するかどうか（デフォルトは本番環境）
        const useStaging = process.env.USE_LETSENCRYPT_STAGING === 'true';
        const letsEncryptServer = useStaging ? 'letsencrypt_test' : 'letsencrypt';
        
        if (useStaging) {
          console.log('Let\'s Encryptのステージング環境を使用します。証明書はブラウザに信頼されません。');
        }
        
        // 証明書がすでに存在するか確認
        const checkCertCmd = `docker exec acme sh -c "cd /root/.acme.sh && ./acme.sh --list --server ${letsEncryptServer} | grep -q ${customDomain} || echo 'not_found'"`;
        const certCheckResult = await executeDockerCommand(checkCertCmd);
        
        if (certCheckResult.includes('not_found')) {
          console.log(`証明書が見つかりません。新規発行します: ${customDomain}`);
          
          // 証明書発行コマンド
          const issueCertCmd = `docker exec acme sh -c "cd /root/.acme.sh && ./acme.sh --issue --dns dns_cf -d ${customDomain} --server ${letsEncryptServer} --cert-home /root/.acme.sh --dnssleep 60 --force"`;
          await executeDockerCommand(issueCertCmd);
          
          // 証明書ディレクトリを動的に検索
          console.log(`証明書ディレクトリを検索中...`);
          let certDir = '';
          
          try {
            // 複数の可能性のある場所を確認
            console.log('複数の可能性のある場所を確認しています...');
            const possibleDirs = [
              `/root/.acme.sh/${customDomain}_ecc`,
              `/root/.acme.sh/${customDomain}`,
              `/root/.acme.sh/certs`
            ];
            
            // 各ディレクトリを確認
            for (const dir of possibleDirs) {
              const dirExists = await executeDockerCommand(`docker exec acme sh -c "[ -d '${dir}' ] && echo 'exists' || echo 'not_found'"`);
              if (dirExists.includes('exists')) {
                // このディレクトリに証明書ファイルがあるか確認
                const hasFiles = await executeDockerCommand(
                  `docker exec acme sh -c "[ -f '${dir}/${customDomain}.key' ] || [ -f '${dir}/fullchain.cer' ] || [ -f '${dir}/${customDomain}.cer' ] && echo 'has_files' || echo 'no_files'"`
                );
                
                if (hasFiles.includes('has_files')) {
                  certDir = dir;
                  console.log(`証明書ファイルを含むディレクトリが見つかりました: ${certDir}`);
                  break;
                } else {
                  console.log(`ディレクトリは存在しますが、証明書ファイルがありません: ${dir}`);
                }
              }
            }
            
            // ディレクトリが見つからない場合はファイルから検索
            if (!certDir) {
              console.log('証明書ディレクトリが見つかりません。ファイルから検索します...');
              // まず、ファイル名から証明書ディレクトリを検索
              const certFileSearch = await executeDockerCommand(`docker exec acme sh -c "find /root/.acme.sh -name '*.key' -o -name '*.cer' | grep ${customDomain} | head -n 1 || echo ''"`);
              
              if (certFileSearch && certFileSearch.trim() !== '') {
                // ファイルからディレクトリ名を取得
                certDir = await executeDockerCommand(`docker exec acme sh -c "dirname ${certFileSearch.trim()}"`);
                console.log(`証明書ファイルから見つかったディレクトリ: ${certDir.trim()}`);
              } else {
                // ディレクトリ名から検索
                const dirSearch = await executeDockerCommand(`docker exec acme sh -c "find /root/.acme.sh -type d -name '*${customDomain}*' | head -n 1 || echo ''"`);
                
                if (dirSearch && dirSearch.trim() !== '') {
                  certDir = dirSearch.trim();
                  console.log(`ディレクトリ名から見つかったディレクトリ: ${certDir}`);
                }
              }
            }
            
            // 証明書ディレクトリが見つからない場合
            if (!certDir || certDir.trim() === '') {
              console.error(`証明書ディレクトリが見つかりません。ディレクトリ構造を確認します...`);
              await executeDockerCommand(`docker exec acme sh -c "find /root/.acme.sh -type d | sort"`);
              throw new Error(`証明書ディレクトリが見つかりません: ${customDomain}`);
            }
            
            console.log(`証明書ディレクトリ: ${certDir.trim()}`);
            
            // 証明書をnginx-proxyが期待する場所にコピー
            console.log(`証明書を適切な場所にインストールします: ${customDomain}`);
            await executeDockerCommand(`docker exec acme sh -c "mkdir -p /root/.acme.sh/certs"`);
            
            // キーファイルと証明書ファイルを検索
            console.log('キーファイルと証明書ファイルを検索中...');
            
            // キーファイルを検索
            let keyFile = '';
            const keyFilePatterns = [
              `${certDir.trim()}/${customDomain}.key`,
              `${certDir.trim()}/*.key`
            ];
            
            for (const pattern of keyFilePatterns) {
              try {
                const result = await executeDockerCommand(`docker exec acme sh -c "ls ${pattern} 2>/dev/null | head -n 1 || echo ''"`);
                if (result && result.trim() !== '') {
                  keyFile = result.trim();
                  console.log(`キーファイルが見つかりました: ${keyFile}`);
                  break;
                }
              } catch (e) {
                console.log(`パターン ${pattern} でキーファイルが見つかりませんでした`);
              }
            }
            
            if (!keyFile) {
              try {
                const findResult = await executeDockerCommand(`docker exec acme sh -c "find ${certDir.trim()} -name '*.key' | head -n 1 || echo ''"`);
                if (findResult && findResult.trim() !== '') {
                  keyFile = findResult.trim();
                  console.log(`検索によりキーファイルが見つかりました: ${keyFile}`);
                }
              } catch (e) {
                console.error(`キーファイルの検索に失敗しました: ${e}`);
              }
            }
            
            // 証明書ファイルを検索
            let certFile = '';
            const certFilePatterns = [
              `${certDir.trim()}/fullchain.cer`,
              `${certDir.trim()}/${customDomain}.cer`,
              `${certDir.trim()}/${customDomain}.crt`,
              `${certDir.trim()}/*.cer`,
              `${certDir.trim()}/*.crt`
            ];
            
            for (const pattern of certFilePatterns) {
              try {
                const result = await executeDockerCommand(`docker exec acme sh -c "ls ${pattern} 2>/dev/null | head -n 1 || echo ''"`);
                if (result && result.trim() !== '') {
                  certFile = result.trim();
                  console.log(`証明書ファイルが見つかりました: ${certFile}`);
                  break;
                }
              } catch (e) {
                console.log(`パターン ${pattern} で証明書ファイルが見つかりませんでした`);
              }
            }
            
            if (!certFile) {
              try {
                const findResult = await executeDockerCommand(`docker exec acme sh -c "find ${certDir.trim()} -name '*.cer' -o -name '*.crt' | head -n 1 || echo ''"`);
                if (findResult && findResult.trim() !== '') {
                  certFile = findResult.trim();
                  console.log(`検索により証明書ファイルが見つかりました: ${certFile}`);
                }
              } catch (e) {
                console.error(`証明書ファイルの検索に失敗しました: ${e}`);
              }
            }
            
            // ファイルが見つかった場合はコピー
            if (keyFile && keyFile.trim() !== '' && certFile && certFile.trim() !== '') {
              console.log('証明書ファイルをコピーします...');
              await executeDockerCommand(`docker exec acme sh -c "cp ${keyFile} /root/.acme.sh/certs/${customDomain}.key && echo 'キーファイルをコピーしました' || echo 'キーファイルのコピーに失敗しました'"`);
              await executeDockerCommand(`docker exec acme sh -c "cp ${certFile} /root/.acme.sh/certs/${customDomain}.crt && echo '証明書ファイルをコピーしました' || echo '証明書ファイルのコピーに失敗しました'"`);
              
              // 権限を設定
              console.log('証明書の権限を設定中...');
              await executeDockerCommand(`docker exec acme sh -c "chmod 644 /root/.acme.sh/certs/${customDomain}.key /root/.acme.sh/certs/${customDomain}.crt 2>/dev/null && echo '権限を設定しました' || echo '権限の設定に失敗しました'"`);
              
              // Nginxを再起動
              console.log('Nginxを再起動して証明書を適用中...');
              await executeDockerCommand('docker restart nginx-proxy');
              console.log('証明書のインストールが完了しました');
            } else {
              console.error('証明書ファイルが見つかりません:');
              console.error(`キーファイル: ${keyFile || 'なし'}`);
              console.error(`証明書ファイル: ${certFile || 'なし'}`);
              throw new Error('必要な証明書ファイルが見つかりません');
            }
          } catch (error) {
            console.error(`証明書の設定中にエラーが発生しました: ${error}`);
            throw error;
          }
        } else {
          console.log(`証明書はすでに存在します: ${customDomain}`);
          
          // 既存の証明書が正しくインストールされているか確認
          const certInstalledCmd = `docker exec acme sh -c "ls -la /root/.acme.sh/certs/${customDomain}.crt || echo 'not_installed'"`;
          const certInstalled = await executeDockerCommand(certInstalledCmd);
          
          if (certInstalled.includes('not_installed')) {
            console.log(`証明書は存在しますが、インストールされていません。インストールします...`);
            
            try {
              // まず、ファイル名から証明書ディレクトリを検索
              const certFileSearch = await executeDockerCommand(`docker exec acme sh -c "find /root/.acme.sh -name '*.key' -o -name '*.cer' | grep ${customDomain} | head -n 1"`);
              let certDir = '';
              
              if (certFileSearch && certFileSearch.trim() !== '') {
                // ファイルからディレクトリ名を取得
                certDir = await executeDockerCommand(`docker exec acme sh -c "dirname ${certFileSearch.trim()}"`);
                console.log(`証明書ディレクトリが見つかりました: ${certDir.trim()}`);
              } else {
                // ディレクトリ名から検索
                const dirSearch = await executeDockerCommand(`docker exec acme sh -c "find /root/.acme.sh -type d -name '*${customDomain}*' | head -n 1"`);
                
                if (dirSearch && dirSearch.trim() !== '') {
                  certDir = dirSearch.trim();
                  console.log(`証明書ディレクトリが見つかりました: ${certDir}`);
                }
              }
              
              if (certDir && certDir.trim() !== '') {
                // 証明書ファイルの存在を確認
                console.log(`証明書ファイルを確認中...`);
                const certFiles = await executeDockerCommand(`docker exec acme sh -c "ls -la ${certDir.trim()}"`);
                console.log(`証明書ディレクトリの内容:\n${certFiles}`);
                
                // 証明書をコピー
                await executeDockerCommand(`docker exec acme sh -c "mkdir -p /root/.acme.sh/certs"`);
                
                // キーファイルを検索
                let keyFile = '';
                try {
                  keyFile = await executeDockerCommand(`docker exec acme sh -c "find ${certDir.trim()} -name '*.key' | head -n 1"`);
                } catch (e) {
                  console.error(`キーファイルの検索に失敗しました: ${e}`);
                }
                
                // 証明書ファイルを検索
                let certFile = '';
                try {
                  certFile = await executeDockerCommand(`docker exec acme sh -c "find ${certDir.trim()} -name '*.cer' -o -name '*.crt' | head -n 1"`);
                } catch (e) {
                  console.error(`証明書ファイルの検索に失敗しました: ${e}`);
                }
                
                // ファイルが見つかった場合はコピー
                if (keyFile && keyFile.trim() !== '') {
                  await executeDockerCommand(`docker exec acme sh -c "cp ${keyFile.trim()} /root/.acme.sh/certs/${customDomain}.key || echo 'キーファイルのコピーに失敗しました'"`);
                } else {
                  console.error(`キーファイルが見つかりません`);
                }
                
                if (certFile && certFile.trim() !== '') {
                  await executeDockerCommand(`docker exec acme sh -c "cp ${certFile.trim()} /root/.acme.sh/certs/${customDomain}.crt || echo '証明書ファイルのコピーに失敗しました'"`);
                } else {
                  console.error(`証明書ファイルが見つかりません`);
                }
                
                // 権限を設定
                await executeDockerCommand(`docker exec acme sh -c "chmod 644 /root/.acme.sh/certs/${customDomain}.key /root/.acme.sh/certs/${customDomain}.crt 2>/dev/null || true"`);
                
                // Nginxを再起動
                await executeDockerCommand('docker restart nginx-proxy');
              } else {
                console.error(`証明書ディレクトリが見つかりません: ${customDomain}`);
              }
            } catch (error) {
              console.error(`既存の証明書のインストール中にエラーが発生しました: ${error}`);
            }
          }
        }
      } catch (certError: any) {
        console.error(`証明書発行エラー: ${certError.message}`);
        console.error('証明書発行の詳細ログを確認するには:');
        const useStaging = process.env.USE_LETSENCRYPT_STAGING === 'true';
        const letsEncryptServer = useStaging ? 'letsencrypt_test' : 'letsencrypt';
        console.error(`docker exec acme sh -c "cd /root/.acme.sh && ./acme.sh --issue --dns dns_cf -d ${customDomain} --server ${letsEncryptServer} --cert-home /root/.acme.sh --dnssleep 60 --force --debug"`);
        // 証明書発行に失敗してもコンテナ起動は続行
      }
    }
    
    // コンテナ情報を取得
    const containerInfo = await container.inspect();
    const port = containerInfo.NetworkSettings.Ports['80/tcp'] ? 
      containerInfo.NetworkSettings.Ports['80/tcp'][0].HostPort : null;
    
    if (!port) {
      console.warn('コンテナポートの取得に失敗しました');
    } else {
      console.log(`ポートマッピング: ホスト ${port} -> コンテナ 80`);
    }
    
    // URLを表示
    const protocol = process.env.USE_SSL === 'true' ? 'https' : 'http';
    const url = customDomain ? 
      `${protocol}://${customDomain}` : 
      `${protocol}://${appDomain}`;
    
    console.log(`アプリは次のURLで利用可能: ${url}`);
    console.log(`END runContainer - container ID: ${container.id}`);
    
    return container.id;
  } catch (error: any) {
    console.error('Dockerコンテナ実行エラー:', error);
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
  checkRepository,
  getRepositoryBranches,
  cloneRepository,
  checkNextjsProject,
  addWebhook,
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