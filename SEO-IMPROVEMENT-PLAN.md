# SEO改善計画 - Force of the Horse コミュニティサイト

## 📊 現状分析

### ✅ 実装済み
- メタディスクリプション
- sitemap.xml
- robots.txt（基本的な設定）
- 日本語言語設定

### ❌ 改善必要
- メタタグ不足
- 構造化データ未実装
- OGPタグ未実装
- robots.txtのドメイン未設定

## 🎯 優先度別改善策

### 🔴 高優先度（即時実推奨）

#### 1. robots.txtのドメイン修正
**現在:** `Sitemap: https://あなたのドメイン/sitemap.xml`
**修正:** `Sitemap: https://force-of-the-horse.com/community/sitemap.xml`

#### 2. メタタグの追加
- キーワードメタタグ
- オーサーメタタグ
- ビューポートメタタグ

#### 3. 各ページの個別メタ設定
- ページごとの適切なタイトル
- ページごとの個別ディスクリプション

### 🟡 中優先度（近日中に実推奨）

#### 4. 構造化データ（JSON-LD）の実装
- WebSite構造化データ
- BreadcrumbList構造化データ
- FAQPage構造化データ

#### 5. OGPタグの追加
- Facebook、Twitterでのシェア対応
- 適切な画像設定

#### 6. 内部リンク強化
- 関連ページへのリンク
- アンカーテキストの最適化

### 🟢 低優先度（今後の改善）

#### 7. パフォーマンス最適化
- 画像圧縮
- CSS/JSの最適化
- キャッシュ設定

#### 8. コンテンツ強化
- 定期的なコンテンツ更新
- ユーザー生成コンテンツの活用
- イベント情報の充実

## 📝 具体的な実装手順

### 手順1: robots.txt修正
```
User-agent: *
Allow: /

Sitemap: https://force-of-the-horse.com/community/sitemap.xml
```

### 手順2: メタタグ追加
各HTMLファイルの<head>に以下を追加：

```html
<meta name="keywords" content="Force of the Horse,フォースオブザホース,カードゲーム,TCG,公認イベント,大会,FAQ,ルール">
<meta name="author" content="FRAMELUNCH.INC">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="canonical" href="https://force-of-the-horse.com/community/現在のページ">
```

### 手順3: 構造化データ実装
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Force of the Horse コミュニティサイト",
  "url": "https://force-of-the-horse.com/community/",
  "description": "Force of the Horseの公式コミュニティサイト",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://force-of-the-horse.com/community/?s={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
</script>
```

### 手順4: OGPタグ追加
```html
<meta property="og:title" content="Force of the Horse コミュニティサイト">
<meta property="og:description" content="Force of the Horseの公式コミュニティサイト。公認イベント制度、イベントカレンダー、カードのルールFAQなど">
<meta property="og:type" content="website">
<meta property="og:url" content="https://force-of-the-horse.com/community/">
<meta property="og:image" content="https://force-of-the-horse.com/community/images/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
```

## 🎯 キーワード戦略

### 主要キーワード
- Force of the Horse
- フォースオブザホース
- カードゲーム
- TCG
- 公認イベント
- 大会
- FAQ
- ルール

### ロングテールキーワード
- Force of the Horse 大会 参加
- フォースオブザホース カードルール
- TCG 公認イベント 申請
- Force of the Horse FAQ 裁定

## 📊 成功指標（KPI）

### 検索順位
- 主要キーワードでの検索順位
- ロングテールキーワードでの検索順位

### トラフィック
- オーガニック検索トラフィック
- ページビュー数
- セッション数

### エンゲージメント
- 平均セッション時間
- 直帰率
- ページ/セッション

## 🔧 技術的SEOチェックリスト

- [ ] robots.txtのドメイン設定
- [ ] sitemap.xmlの更新
- [ ] メタタグの実装
- [ ] 構造化データの実装
- [ ] OGPタグの実装
- [ ] モバイルフレンドリー確認
- [ ] ページ速度最適化
- [ ] HTTPS設定
- [ ] 内部リンク最適化
- [ ] 404エラー修正

## 📅 実装スケジュール

### 第1週（高優先度）
- robots.txt修正
- メタタグ追加
- sitemap.xml更新

### 第2週（中優先度）
- 構造化データ実装
- OGPタグ追加
- 内部リンク強化

### 第3-4週（低優先度）
- パフォーマンス最適化
- コンテンツ強化
- モニタリング設定
