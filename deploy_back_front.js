//--------------------------------
// フロントエンド＆バックエンドデプロイスクリプト（Docker Compose版）
// 実行例: node deploy_back_front.js https://github.com/username/repo.git main
// 実行例: npm run deploy https://github.com/username/repo.git main
//--------------------------------

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { exec, execSync } = require('child_process');
const { promisify } = require('util');
const dotenv = require('dotenv');

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const execPromise = promisify(exec);

// 環境変数ファイルを読み込む関数
function loadEnvFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const envConfig = dotenv.parse(fs.readFileSync(filePath));
      return envConfig;
    }
  } catch (err) {
    console.error(`環境変数ファイル読み込みエラー: ${filePath}`, err);
  }
  return {};
}

// 環境変数をDocker Compose形式に変換
function formatEnvVarsForCompose(envVars) {
  return Object.entries(envVars)
    .map(([key, value]) => `      - ${key}=${value}`)
    .join('\n');
}

async function runCommand(command, cwd = process.cwd()) {
  console.log(`実行コマンド: ${command} (ディレクトリ: ${cwd})`);
  
  try {
    const { stdout, stderr } = await execPromise(command, { cwd, maxBuffer: 1024 * 1024 * 10 });
    if (stderr) console.error(`警告: ${stderr}`);
    return stdout.trim();
  } catch (error) {
    console.error(`コマンド実行エラー: ${error.message}`);
    throw error;
  }
}

function runCommandSync(command, cwd = process.cwd()) {
  console.log(`同期実行コマンド: ${command} (ディレクトリ: ${cwd})`);
  try {
    return execSync(command, { cwd, stdio: 'inherit', maxBuffer: 1024 * 1024 * 10 });
  } catch (error) {
    console.error(`同期コマンド実行エラー: ${error.message}`);
    throw error;
  }
}

async function main() {
  const [, , repository, branch = 'main'] = process.argv;

  if (!repository) {
    console.error('使用方法: node deploy_back_front.js <リポジトリURL> [ブランチ名]');
    process.exit(1);
  }

  // デフォルトのドメイン設定
  const defaultDomain = 'nextdock.org';
  
  // ドメイン名の入力を求める
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const domainName = await new Promise((resolve) => {
    readline.question(`ドメイン名を入力してください（デフォルト: ${defaultDomain}）: `, (answer) => {
      readline.close();
      return resolve(answer || defaultDomain);
    });
  });

  // SSLの使用を選択
  const rlSSL = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const useSSL = await new Promise((resolve) => {
    rlSSL.question('SSLを使用しますか？ (y/n, デフォルト: y): ', (answer) => {
      rlSSL.close();
      return resolve(answer.toLowerCase() !== 'n');
    });
  });

  console.log(`SSLを${useSSL ? '使用' : '使用しない'}モードでデプロイします`);

  // SSL使用時のメールアドレスを取得
  let email = '';
  let useStaging = false;
  
  if (useSSL) {
    email = await new Promise((resolve) => {
    const rl = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
      rl.question('メールアドレスを入力してください (証明書更新通知用): ', (answer) => {
      rl.close();
        return resolve(answer || 'admin@nextdock.org');
      });
    });
    
    // ステージング環境の使用を選択
    useStaging = await new Promise((resolve) => {
      const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.question('Let\'s Encryptのステージング環境を使用しますか？ (レート制限なし、ブラウザに信頼されない証明書) (y/n, デフォルト: n): ', (answer) => {
        rl.close();
        const useStaging = answer.toLowerCase() === 'y';
        console.log(`Let's Encryptの${useStaging ? 'ステージング' : '本番'}環境を使用します。`);
        return resolve(useStaging);
      });
    });
  }

  // Cloudflare認証情報の取得（SSL使用時のみ）
  let cfKey = '';
  let cfEmail = '';
  
  if (useSSL) {
    // ssl.envファイルから認証情報を読み込む
    const sslEnvCredentials = loadEnvFile(path.join(process.cwd(), 'ssl.env'));
    
    // CF_Key/CF_Email または CF_API_KEY/CF_API_EMAIL のどちらかが存在するか確認
    if ((sslEnvCredentials.CF_Key && sslEnvCredentials.CF_Email) || 
        (sslEnvCredentials.CF_API_KEY && sslEnvCredentials.CF_API_EMAIL)) {
      console.log('ssl.envファイルからCloudflare認証情報を読み込みました');
      
      // CF_Key または CF_API_KEY を優先して使用
      cfKey = sslEnvCredentials.CF_Key || sslEnvCredentials.CF_API_KEY;
      cfEmail = sslEnvCredentials.CF_Email || sslEnvCredentials.CF_API_EMAIL;
    } else {
      // ssl.envファイルが存在しない場合のみ説明を表示
      console.log('\n--- ワイルドカード証明書の設定 ---');
      console.log('ワイルドカード証明書を取得するには、Cloudflareの認証情報が必要です。');
      
      // 認証情報を入力
      cfKey = await new Promise((resolve) => {
        const rl = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        rl.question('Cloudflare Global API Key: ', (answer) => {
          rl.close();
          return resolve(answer);
        });
      });
      
      cfEmail = await new Promise((resolve) => {
        const rl = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout
        });
        rl.question('Cloudflare Email: ', (answer) => {
          rl.close();
          return resolve(answer);
        });
      });
      
      // ssl.envファイルに保存
      console.log('認証情報をssl.envファイルに保存します');
      
      // 既存のssl.envファイルの内容を保持
      let sslEnvContent = '';
      const sslEnvPath = path.join(process.cwd(), 'ssl.env');
      
      if (fs.existsSync(sslEnvPath)) {
        // 既存のファイルがある場合は内容を読み込む
        const existingContent = fs.readFileSync(sslEnvPath, 'utf8');
        
        // 既存の内容から CF_Key と CF_Email 以外の行を保持
        const lines = existingContent.split('\n').filter(line => {
          return !line.startsWith('CF_Key=') && !line.startsWith('CF_Email=');
        });
        
        // 既存の内容を保持
        sslEnvContent = lines.join('\n');
        if (sslEnvContent && !sslEnvContent.endsWith('\n')) {
          sslEnvContent += '\n';
        }
      }
      
      // 新しい認証情報を追加
      sslEnvContent += `CF_Key=${cfKey}\nCF_Email=${cfEmail}\n`;
      
      // ファイルに書き込み
      fs.writeFileSync(sslEnvPath, sslEnvContent);
      console.log('ssl.envファイルを更新しました');
    }
  }

  // APIサブドメインの設定
  const apiSubdomain = 'api';
  const apiDomain = `${apiSubdomain}.${domainName}`;

  // 一意のIDを使用して作業ディレクトリを作成
  const deployId = uuidv4().substring(0, 8);
  const workDir = path.join(process.cwd(), `deploy_${deployId}`);
  
  // Docker Composeプロジェクト名を設定
  const projectName = 'nextdock';
  const networkName = `${projectName}_nextdock-network`;
  
  try {
    // 作業ディレクトリを作成
    console.log(`作業ディレクトリを作成します: ${workDir}`);
    await mkdir(workDir, { recursive: true });
    
    // リポジトリをクローン
    console.log(`リポジトリをクローンします: ${repository} (ブランチ: ${branch})`);
    await runCommand(`git clone --branch ${branch} ${repository} repo`, workDir);
    const repoDir = path.join(workDir, 'repo');
    
    // フロントエンドとバックエンドのディレクトリを確認
    const frontendDir = path.join(repoDir, 'frontend');
    const backendDir = path.join(repoDir, 'backend');
    
    if (!fs.existsSync(frontendDir)) {
      throw new Error('フロントエンドディレクトリが見つかりません');
    }
    
    if (!fs.existsSync(backendDir)) {
      throw new Error('バックエンドディレクトリが見つかりません');
    }
    
    // package.jsonの存在を確認
    if (!fs.existsSync(path.join(frontendDir, 'package.json'))) {
      throw new Error('フロントエンドのpackage.jsonが見つかりません');
    }
    
    if (!fs.existsSync(path.join(backendDir, 'package.json'))) {
      throw new Error('バックエンドのpackage.jsonが見つかりません');
    }
    
    // フロントエンドのDockerfileを修正（ビルドエラー対策）
    console.log('フロントエンドのDockerfileを修正します');
    const frontendDockerfileContent = `FROM node:18-alpine
WORKDIR /app
# gitをインストール
RUN apk add --no-cache git
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
ENV PORT=3000
CMD ["npm", "run", "dev"]`;
    await writeFile(path.join(frontendDir, 'Dockerfile'), frontendDockerfileContent);
    
    // バックエンドのDockerfileを確認
    const backendDockerfilePath = path.join(backendDir, 'Dockerfile');
    if (!fs.existsSync(backendDockerfilePath)) {
      console.log('バックエンドのDockerfileが見つからないため、デフォルトのDockerfileを作成します');
      const backendDockerfileContent = `FROM node:18-alpine
WORKDIR /app
# gitをインストール
RUN apk add --no-cache git
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]`;
      await writeFile(backendDockerfilePath, backendDockerfileContent);
    } else {
      console.log('既存のバックエンドDockerfileを使用します');
      // 既存のDockerfileを更新して確実にビルドステップが含まれるようにする
      const backendDockerfileContent = `FROM node:18-alpine
WORKDIR /app
# gitをインストール
RUN apk add --no-cache git
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]`;
      await writeFile(backendDockerfilePath, backendDockerfileContent);
    }
    
    // 環境変数ファイルを読み込む
    console.log('環境変数ファイルを読み込みます');
    const frontendEnv = loadEnvFile(path.join(process.cwd(), 'frontend.env'));
    const backendEnv = loadEnvFile(path.join(process.cwd(), 'backend.env'));
    
    // フロントエンド環境変数を設定
    let frontendEnvVars = {
      ...frontendEnv,
      'VIRTUAL_HOST': domainName,
      'VIRTUAL_PORT': '3000',
      'NEXT_PUBLIC_BASE_URL': useSSL ? `https://${domainName}` : `http://${domainName}`,
      'NEXT_PUBLIC_API_URL': useSSL ? `https://${apiDomain}` : `http://${apiDomain}`
    };
    
    // バックエンド環境変数を設定
    let backendEnvVars = {
      ...backendEnv,
      'VIRTUAL_HOST': apiDomain,
      'VIRTUAL_PORT': '3001',
      'PORT': '3001',
      'BASE_DOMAIN': domainName,
      'FRONTEND_URL': useSSL ? `https://${domainName}` : `http://${domainName}`,
      'PORT_RANGE_START': '3002',
      'PORT_RANGE_END': '4000',
      'DOCKER_NETWORK': networkName,
      'USE_WILDCARD_CERT': 'true'
    };
    
    // SSL使用時は追加の環境変数を設定
    if (useSSL) {
      // フロントエンドにSSL設定を追加
      frontendEnvVars = {
        ...frontendEnvVars,
        'LETSENCRYPT_HOST': domainName
      };
      
      // バックエンドにSSL設定を追加
      backendEnvVars = {
        ...backendEnvVars,
        'LETSENCRYPT_HOST': apiDomain
      };
    }
    
    // 環境変数をDocker Compose形式に変換
    const frontendEnvCompose = formatEnvVarsForCompose(frontendEnvVars);
    const backendEnvCompose = formatEnvVarsForCompose(backendEnvVars);
    
    // docker-compose.ymlを修正
    console.log('docker-compose.ymlを修正します');
    
    // Docker Compose設定
    let dockerComposeContent;
    
    if (useSSL) {
      // SSL有りのDocker Compose設定
      dockerComposeContent = `version: '3.8'

services:
  nginx-proxy:
    image: jwilder/nginx-proxy
    container_name: nginx-proxy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
      - nginx_certs:/etc/nginx/certs
      - nginx_vhost:/etc/nginx/vhost.d
      - nginx_html:/usr/share/nginx/html
      - nginx_dhparam:/etc/nginx/dhparam
    environment:
      - DHPARAM_GENERATION=false
      - SSL_POLICY=Mozilla-Modern
      - ENABLE_IPV6=true
    restart: always
    networks:
      - nextdock-network

  acme:
    image: neilpang/acme.sh
    container_name: acme
    environment:
      - CF_Key=${cfKey}
      - CF_Email=${cfEmail}
    volumes:
      - nginx_certs:/acme.sh
      - nginx_certs:/etc/nginx/certs
      - /var/run/docker.sock:/var/run/docker.sock
    entrypoint: ["sleep", "infinity"]
    depends_on:
      - nginx-proxy
    restart: always
    networks:
      - nextdock-network

  frontend:
    build:
      context: ./frontend
    environment:
${frontendEnvCompose}
    restart: unless-stopped
    networks:
      - nextdock-network
    expose:
      - "3000"

  backend:
    build:
      context: ./backend
    environment:
${backendEnvCompose}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped
    networks:
      - nextdock-network
    expose:
      - "3001"

volumes:
  nginx_certs:
  nginx_vhost:
  nginx_html:
  nginx_dhparam:

networks:
  nextdock-network:
    driver: bridge`;
    } else {
      // SSL無しのDocker Compose設定
      dockerComposeContent = `version: '3'

services:
  nginx-proxy:
    image: jwilder/nginx-proxy
    container_name: nginx-proxy
    ports:
      - "80:80"
    volumes:
      - /var/run/docker.sock:/tmp/docker.sock:ro
    restart: always
    networks:
      - nextdock-network

  frontend:
    build:
      context: ./frontend
    environment:
${frontendEnvCompose}
    restart: unless-stopped
    networks:
      - nextdock-network
    expose:
      - "3000"

  backend:
    build:
      context: ./backend
    environment:
${backendEnvCompose}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped
    networks:
      - nextdock-network
    expose:
      - "3001"

networks:
  nextdock-network:
    driver: bridge`;
    }
    
    await writeFile(path.join(repoDir, 'docker-compose.yml'), dockerComposeContent);
    
    try {
      // バックエンドのpackage.jsonを確認してビルドスクリプトがあるか確認
      const backendPackageJsonPath = path.join(backendDir, 'package.json');
      const backendPackageJson = JSON.parse(fs.readFileSync(backendPackageJsonPath, 'utf8'));
      
      // ビルドスクリプトが存在しない場合は追加
      if (!backendPackageJson.scripts || !backendPackageJson.scripts.build) {
        console.log('バックエンドのpackage.jsonにビルドスクリプトが見つかりません。追加します。');
        backendPackageJson.scripts = backendPackageJson.scripts || {};
        backendPackageJson.scripts.build = 'tsc';
        fs.writeFileSync(backendPackageJsonPath, JSON.stringify(backendPackageJson, null, 2));
      }
      
      // Docker Composeでビルドして起動
      console.log('Docker Composeでコンテナをビルドします');
      runCommandSync(`docker-compose -p ${projectName} build`, repoDir);
      
      console.log('Docker Composeでコンテナを起動します');
      runCommandSync(`docker-compose -p ${projectName} up -d`, repoDir);
      
      // SSL使用時は ssl.env ファイルをバックエンドディレクトリにコピー
      if (useSSL && fs.existsSync(path.join(process.cwd(), 'ssl.env'))) {
        console.log('ssl.env ファイルをバックエンドディレクトリにコピーします');
        fs.copyFileSync(
          path.join(process.cwd(), 'ssl.env'), 
          path.join(backendDir, 'ssl.env')
        );
        console.log('ssl.env ファイルのコピーが完了しました');
      }
      
      // SSL証明書の発行と設定（SSL使用時のみ）
      if (useSSL) {
        console.log('\nSSL証明書を発行・設定します...');
        // より広いスコープでletsEncryptServer変数を定義
        const letsEncryptServer = useStaging ? 'letsencrypt_test' : 'letsencrypt';
        console.log(`使用するLet's Encryptサーバー: ${letsEncryptServer} (${useStaging ? 'ステージング環境' : '本番環境'})`);
        
        try {
          // 証明書発行コマンド
          console.log('アカウント登録中...');
          await runCommand(`docker exec acme sh -c "cd /acme.sh && ./acme.sh --register-account -m ${email} --server ${letsEncryptServer}"`, repoDir);
                
          console.log('証明書発行中...');
          try {
            const issueCommand = `docker exec acme sh -c "cd /acme.sh && ./acme.sh --issue --dns dns_cf -d ${domainName} -d '*.${domainName}' --server ${letsEncryptServer} --cert-home /acme.sh --dnssleep 60 --force --keylength ec-256"`;
            console.log(`実行コマンド: ${issueCommand}`);
            await runCommand(issueCommand, repoDir);
            console.log('証明書発行コマンド実行完了');

            const installCommand = `docker exec acme sh -c "cd /acme.sh && ./acme.sh --install-cert -d ${domainName} --ecc --cert-file /etc/nginx/certs/${domainName}.crt --key-file /etc/nginx/certs/${domainName}.key"`;
            console.log(`インストールコマンド: ${installCommand}`);
            await runCommand(installCommand, repoDir);
            console.log('証明書インストールコマンド実行完了');

            const reloadCommand = `docker kill -s HUP nginx-proxy`;
            console.log(`リロードコマンド: ${reloadCommand}`);
            await runCommand(reloadCommand, repoDir);
            console.log('リロードコマンド実行完了');

          } catch (issueError) {
            console.error('\n❌ SSL証明書の発行中にエラーが発生しました:', issueError);
            throw issueError;
          }
        } catch (error) {
          console.error('\n❌ SSL証明書の発行中にエラーが発生しました:', error);
        }
      }
      
      console.log(`\n✅ デプロイが完了しました！`);
      const protocol = useSSL ? 'https' : 'http';
      console.log(`メインアプリケーション: ${protocol}://${domainName}`);
      console.log(`APIサーバー: ${protocol}://${apiDomain}`);
      
    } catch (error) {
      console.error(`\nビルドまたは起動中にエラーが発生しました。`);
      throw error;
    }
    
  } catch (error) {
    // 最上位のエラーハンドリング
    console.error(`\n❌ デプロイ失敗: ${error.message}`);
    if (error.message.includes('not found')) {
      console.error('ディレクトリ構造を確認してください:');
    } else if (error.message.includes('npm run build') || error.message.includes('failed to solve')) {
      console.error('ビルドプロセスでエラーが発生しました:');
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error('予期しないエラーが発生しました:', err);
  process.exit(1);
});