# WordPress共存セットアップチェックリスト

## 🚀 FileZillaアップロード手順

### 1. サーバー接続確認
- [ ] FileZillaでFTPサーバーに接続
- [ ] WordPressがインストールされているディレクトリを確認

### 2. ディレクトリ作成
- [ ] WordPressと同じ階層に `community` フォルダを作成
- [ ] 例: `public_html/community/` または `public_html/wp-content/community/`

### 3. ファイルアップロード
以下のファイルを `community` フォルダにアップロード：

**必須ファイル:**
- [ ] index.html
- [ ] script.js
- [ ] styles.css
- [ ] apply.html
- [ ] certified-event-system.html
- [ ] event-calendar-page.html
- [ ] faq.html
- [ ] faq-starter.html
- [ ] faq-vol1.html
- [ ] faq-vol2.html
- [ ] faq-vol3.html
- [ ] faq-vol4.html
- [ ] faq-vol5.html
- [ ] faq-tournament.html
- [ ] guideline.html
- [ ] privacy.html
- [ ] sitemap.xml
- [ ] robots.txt
- [ ] .htaccess (htaccess-for-wordpress.txtの内容を使用)

**アップロード不要ファイル:**
- [ ] Code.gs (Google Apps Script用)
- [ ] SETUP.md
- [ ] CONTENT-UPDATE-GUIDE.md
- [ ] WORDPRESS-FORMS.md
- [ ] htaccess-for-wordpress.txt (設定用)

### 4. .htaccess設定
- [ ] `htaccess-for-wordpress.txt` の内容を `.htaccess` として保存
- [ ] `community` フォルダのルートに配置

## ⚙️ WordPress側の設定

### 1. パーマリンク設定確認
- [ ] WordPress管理画面 > 設定 > パーマリンク設定
- [ ] 問題が発生する場合は「基本」に変更

### 2. サブディレクトリ設定（推奨）
WordPressをサブディレクトリに移動することを推奨：
- [ ] WordPressを `/wordpress/` に移動
- [ ] コミュニティサイトを `/community/` に配置
- [ ] これによりURL競合を回避

## 🔧 URL確認

アップロード後、以下のURLでアクセス確認：
- [ ] `https://ドメイン名/community/`
- [ ] `https://ドメイン名/community/index.html`
- [ ] `https://ドメイン名/community/faq.html`
- [ ] `https://ドメイン名/community/apply.html`

## 🔒 セキュリティ確認

### 1. アクセス制限
- [ ] 機密情報が含まれていないことを確認
- [ ] 不要なファイルがアップロードされていないことを確認

### 2. WordPressとの分離
- [ ] WordPressの `.htaccess` がコミュニティサイトに影響していないことを確認
- [ ] セッション管理が混在していないことを確認

## 📝 Google Apps Script設定

### 1. ウェブアプリURL確認
- [ ] Google Apps ScriptのウェブアプリURLを確認
- [ ] `script.js` の `GAS_WEB_APP_URL` が正しいことを確認

### 2. スクリプトプロパティ設定
- [ ] FORM_TOKEN が設定されている
- [ ] RECAPTCHA_SECRET_KEY (必要な場合)
- [ ] NG_WORDS_EXTRA (必要な場合)

## 🎨 表示確認

### 1. 基本表示
- [ ] トップページが正しく表示される
- [ ] ナビゲーションが機能する
- [ ] スタイルが適用されている

### 2. フォーム機能
- [ ] 申請フォームが表示される
- [ ] FAQフォームが表示される
- [ ] 送信テストを行う

### 3. カレンダー機能
- [ ] イベントカレンダーが表示される
- [ ] データが正しく読み込まれる

## 🆟 トラブルシューティング

### スタイルが適用されない場合
- [ ] `styles.css` のパスを確認
- [ ] ブラウザキャッシュをクリア

### フォームが送信できない場合
- [ ] Google Apps ScriptのURLを確認
- [ ] CORS設定を確認

### WordPressと競合する場合
- [ ] WordPressをサブディレクトリに移動
- [ ] またはコミュニティサイトをサブドメインに配置

## 📞 サポート

問題が発生した場合：
1. ブラウザのコンソールエラーを確認
2. サーバーのエラーログを確認
3. WordPressのプラグインを一時的に無効化して確認
