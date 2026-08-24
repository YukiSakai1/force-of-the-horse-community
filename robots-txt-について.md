# robots.txt について（community フォルダには置かないでください）

## 結論
このフォルダの中に `robots.txt` を入れて FileZilla でアップロードしても、
検索エンジンのクローラーはそれを見に来ません。**robots.txt はドメインの
一番トップ（`https://force-of-the-horse.com/robots.txt`）にあるものだけが
有効**という仕様のためです。

## 今のWordPress側の robots.txt を確認する
1. ブラウザで `https://force-of-the-horse.com/robots.txt` を開く
2. 中身が表示されればWordPress側で既に生成されています
   （多くの場合、SEOプラグイン（Yoast SEO、All in One SEO など）が自動生成しています）

## sitemap.xml を検索エンジンに知らせたい場合
このフォルダの sitemap.xml（`https://force-of-the-horse.com/community/sitemap.xml`
としてアップロードする想定）は、以下のどちらかの方法で検索エンジンに知らせられます。

- **方法A（推奨・簡単）**：Google Search Console に手動でこのURLを登録する
  （プロパティ画面の「サイトマップ」メニューから追加）
- **方法B**：WordPress側の robots.txt にこの1行を追記してもらう
  （WordPress管理者に依頼、またはSEOプラグインの設定画面から追加）
  ```
  Sitemap: https://force-of-the-horse.com/community/sitemap.xml
  ```

いずれにしても、community フォルダの中に robots.txt を置く必要はありません。
