# NextDock - Next.jsアプリケーションデプロイプラットフォーム

NextDockは、Next.jsアプリケーションを簡単にデプロイするためのDockerベースのプラットフォームです。GitHubリポジトリからのワンクリックデプロイを実現し、カスタムドメイン設定やSSL証明書の自動発行にも対応しています。

## 機能

- **GitHub連携**: GitHubアカウント認証で簡単にリポジトリをインポート
- **自動DockerfileサポートとNext.js検出**: Dockerfileがない場合でもNext.jsプロジェクトを自動検出して適切なDockerfile生成
- **サブドメイン自動割り当て**: アプリごとに一意のサブドメイン(`app-name.nextdock.org`)を割り当て
- **カスタムドメインサポート**: 独自ドメインの設定と証明書の自動発行
- **SSL自動化**: Let's EncryptとCloudflare DNS認証によるSSL証明書の自動発行・更新
- **環境変数管理**: アプリケーションごとの環境変数設定
- **コンテナ管理**: 起動・停止・再起動などの基本操作
- **ログモニタリング**: コンテナログのリアルタイム表示

## システム構成

### フロントエンド

- **フレームワーク**: Next.js 14
- **認証**: Supabase Auth
- **状態管理**: React Context API
- **UI**: TailwindCSS

### バックエンド

- **サーバー**: Express.js + TypeScript
- **Docker管理**: Dockerode
- **リポジトリ操作**: simple-git
- **データベース**: Supabase
- **認証**: JWT + Supabase Auth

### インフラストラクチャ

- **コンテナオーケストレーション**: Docker Compose
- **リバースプロキシ**: nginx-proxy
- **SSL証明書**: acme.sh（Let's Encrypt）
- **DNS認証**: Cloudflare API

## デプロイアーキテクチャ

NextDockは以下のコンポーネントで構成されています：

1. **nginx-proxy**: リバースプロキシとしてすべてのトラフィックを適切なアプリケーションコンテナにルーティング
2. **acme**: SSL証明書の発行と更新を担当
3. **バックエンドAPI**: アプリケーションのデプロイとコンテナ管理を担当
4. **フロントエンド**: 管理UIを提供
5. **デプロイされたアプリケーション**: ユーザーのNext.jsアプリケーション（各コンテナで実行）

## セットアップ

### 前提条件

- Node.js 14以上
- Docker および Docker Compose
- Cloudflareアカウント（SSL証明書の自動発行用）
- Supabaseアカウント（データベース用）

### インストール手順

1. リポジトリをクローン
    ```bash
    git clone https://github.com/your-username/nextdock.git
    cd nextdock
    ```

2. 環境変数の設定
    ```
    # .env ファイルをバックエンドディレクトリに作成
    SUPABASE_URL=your_supabase_url
    SUPABASE_KEY=your_supabase_key
    JWT_SECRET=your_jwt_secret
    BASE_DOMAIN=nextdock.org
    DOCKER_SOCKET=/var/run/docker.sock
    ```

3. Cloudflare認証情報の設定（SSL用）
    ```
    # ssl.env ファイルを作成
    CF_Key=your_cloudflare_global_api_key
    CF_Email=your_cloudflare_email
    ```

4. システムのデプロイ
    ```bash
    node deploy_back_front.js https://github.com/your-username/nextdock.git main
    ```

## カスタムドメイン設定

カスタムドメインを使用する場合：

1. Cloudflareでドメインを管理
2. ドメインのDNS設定でCNAMEレコードを追加（`your-app.example.com` → `nextdock.org`）
3. アプリケーション管理画面でカスタムドメインを設定

## 開発

### ローカル開発環境のセットアップ

1. フロントエンド
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

2. バックエンド
    ```bash
    cd backend
    npm install
    npm run dev
    ```

## ライセンス

MITライセンス

---

© 2023 NextDock 