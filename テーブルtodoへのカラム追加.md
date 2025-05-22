良い質問です。Prisma を使って既存のテーブル（今回の場合 `Todo`）にカラムを追加したい場合、**`schema.prisma` を編集してマイグレーションを作成・適用する**、というステップになります。

---

## ✅ 手順：`Todo` にカラムを追加する流れ

### ① `schema.prisma` を編集

例えば、`description` というカラム（任意の説明）を追加したいとします：

```prisma
model Todo {
  id          Int      @id @default(autoincrement())
  title       String
  description String?  // ← 新しく追加されたカラム（null許容）
  completed   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

* `String?` とすることで、**既存のデータへの影響を避けられる**（null を許容する）
* もし `String` にすると、既存レコードに値が必要なので注意

---

### ② マイグレーションを作成・適用

```bash
npx prisma migrate dev --name add-description-to-todo
```

* `migrate dev` は Prisma がスキーマの変更点を検出し、SQLite に反映
* `--name` には分かりやすい名前をつけましょう（履歴管理のため）

---

### ③ Prisma Client を再生成（通常 migrate dev が自動でやってくれる）

```bash
npx prisma generate
```

これで TypeScript 側でも新しいカラムが補完されます。

---

## 📌 補足：null を許容しないカラムを追加したいとき

例：

```prisma
priority Int  // 追加したいが null 非許容
```

この場合は、**既存のデータに対して初期値を与えるか、default値を指定する必要があります**：

```prisma
priority Int @default(0)
```

または、`migrate` 時にエラーになるのを防ぐために、手動でマイグレーション SQL を編集することもできます。

---

## 🔍 マイグレーションの確認

マイグレーション後にこのようなファイルができます：

```
prisma/migrations/
  └─ 20250518120000_add-description-to-todo/
      └─ migration.sql
```

この中に、SQLite の `ALTER TABLE` 文などが自動で記述されます。

---

## ✅ まとめ

| 手順                                            | 説明                       |
| ----------------------------------------------- | -------------------------- |
| ① schema.prisma を編集                          | 新しいカラムをモデルに追加 |
| ② `npx prisma migrate dev --name xxx`           | DBに変更を適用             |
| ③ `npx prisma generate`（自動実行されることも） | Prisma Client を再生成     |

必要に応じて、Studio (`npx prisma studio`) で GUI による確認も可能です。

---

他にも「カラム削除」「型変更」「別テーブル追加」なども Prisma ではスムーズにできます。必要ならそれも説明します。
