- [mcpサーバ](#mcpサーバ)
- [作成するアプリについて](#作成するアプリについて)
  - [仕組み](#仕組み)
- [MCPの通信方式](#mcpの通信方式)
      - [stdio](#stdio)
      - [streamable httpトランスポート](#streamable-httpトランスポート)
      - [thhp + sse](#thhp--sse)
- [使用する技術](#使用する技術)
      - [next.js](#nextjs)
      - [hono](#hono)
      - [Prisma](#prisma)
      - [ai/sdk](#aisdk)
- [1. 環境構築](#1-環境構築)
  - [API のコード](#api-のコード)
- [2. PrismaでDBを作る](#2-prismaでdbを作る)
- [3. todo mcp server を作る](#3-todo-mcp-server-を作る)


# mcpサーバ

参考
[【これ1本/初心者OK】MCPを実装理解するチュートリアル！Next.jsでAIアシスタントを開発【図解解説】](https://qiita.com/Sicut_study/items/e0fbbbf51cdd54d76b1a)

# 作成するアプリについて

todoアプリ

## 仕組み

![](./images/https___qiita-image-store.s3.ap-northeast-1.amazonaws.com_0_810513_04d91ca9-412a-43d0-88d5-cdbd3efee47e.avif)

# MCPの通信方式

#### stdio

localで動作。標準入力/標準出力なので高速で安全

#### streamable httpトランスポート

主流。サーバは単一のエンドポイントを提供し、クライアントはhttp postでリクエストする

#### thhp + sse

# 使用する技術

#### next.js

#### hono

#### Prisma

#### ai/sdk

# 1. 環境構築

```sh
node -v
v22.15.0
mkdir mcp-todos
cd mcp-todos
npm create hono@latest

# 初期セットアップ
create-hono version 0.18.0
✔ Target directory api
✔ Which template do you want to use? nodejs
✔ Do you want to install project dependencies? Yes
✔ Which package manager do you want to use? npm
```

サーバーの起動

`PS mcp-todos\api`で実行
```sh
npm run dev
curl http://localhost:3000
```

あるいはブラウザに`http://localhost:3000`と入力してもいい

サーバーを停止させるときは`ctrl + c`

## API のコード

`src/index.ts`にある

# 2. PrismaでDBを作る

今回はsqliteを使う
```sh
npm install prisma --save-dev
npx prisma init --datasource-provider sqlite --output ../generated/prisma
```

テーブルの作成

```ts:prisma/schema.prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

// Prisma Clientコードの出力先フォルダ
generator client {
  provider = "prisma-client-js"
  output   = "../generated/prisma"
}

// 使用DB, path
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// 追加
model todo {
  id        Int     @id @default(autoincrement())
  title     String
  completed Boolean @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

```sh
npx prisma migrate dev --name init
npx prisma generate
```
- 1行目について
  - マイグレーションファイル`init`を作成
  - sqliteのデータベースにテーブル`todo`を作成

| 項目名    | 型       | 説明                                                                                 |
| :-------- | :------- | :----------------------------------------------------------------------------------- |
| id        | Int      | ToDoの一意なID。自動で連番（オートインクリメント）として生成され、主キー（id）になる |
| title     | String   | ToDoのタイトルや内容を表すテキスト                                                   |
| completed | Boolean  | ToDoが完了しているかどうかを示す真偽値。初期値はfalse（未完了）                      |
| createdAt | DateTime | ToDoが作成された日時。新規作成時に自動で現在時刻がセットされる                       |
| updatedAt | DateTime | ToDoが更新された日時。レコード更新時に自動で現在時刻に書き換わる                     |


- 2行目について
  - `Prisma Client`のTypeScriptコードを自動生成。(出力先は`../generated/prisma`)

[todoテーブルの編集](テーブルtodoへのカラム追加.md)

エンドポイントを追加してみよう

```ts:index.ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { PrismaClient } from "../generated/prisma/index.js";

const app = new Hono();
const prisma = new PrismaClient();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/systems/ping", (c) => {
  return c.json({ message: "pong" });
});

app.get("/todos", async (c) => {
  const todos = await prisma.todo.findMany();
  return c.json(todos);
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);

```

`http://localhost:3000/todos`を見ても、いまはなにもない
次を追記しよう

```ts:index.ts
// Prismaを使ってデータベースにデータを追加するエンドポイント
app.post("/todos", async (c) => {
  const body = await c.req.json();
  const { title } = body;
  if (!title) {
    return c.json({ error: "Title is required" }, 400);
  }
  const todo = await prisma.todo.create({
    data: { title },
  });
  return c.json(todo);
});
```

- エンドポイント`/todos`にポストメソッドを追加
- jsonを受け取り、titleをDBに追加

確認してみよう
```sh
curl -X POST "http://localhost:3000/todos" -H "Content-Type: application/json" -d '{"title": "掃除をする"}'
curl localhost:3000/todos
```
次でもできる
```js:devtools
fetch("http://localhost:3000/todos", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "掃除をする" })
})
.then(res => res.json())
.then(console.log);
```


`/todos`エンドポイントにgetリクエストを送るとレコードが返ってくるはず

次に、todoの完了/未完了の状態更新を行うエンドポイントを作成

```ts:index.ts
// 追加
app.put("/todos/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const { title, completed } = body;
  try {
    const todo = await prisma.todo.update({
      where: { id },
      data: { title, completed },
    });
    return c.json(todo);
  } catch (e) {
    return c.json({ error: "Todo not found" }, 404);
  }
});
```

次のようにputメソッドで更新できる(id:1のレコードが存在することが前提)
```sh
curl -X PUT "http://localhost:3000/todos/1" -H "Content-Type: application/json" -d '{"completed": true}'
```
次でもできる
```js:devTools
fetch("http://localhost:3000/todos/1", {
  method: "PUT",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ completed: true })
})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(err => console.error(err));
```

更にtodoを削除するエンドポイントを作成する
```ts
// DB削除用のエンドポイント(:idはURLパラメータ)
app.delete("/todos/:id", async (c) => {
  const id = Number(c.req.param("id"));
  console.log("[deleteTodoItem] ID:", id);
  try {
    await prisma.todo.delete({ where: { id } });
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: "Todo not found" }, 404);
  }
});
```


```sh
curl -XDELETE localhost:3000/todos/1
```
```js:debTools
fetch("http://localhost:3000/todos/1", {
  method: "DELETE"
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));
```

次のようにしたい

- チャットアプリ&MCPクライアント(Next.js) : localhost:3000
- MCPサーバー : localhost:3001
- APIサーバー : localhost:8080

そのため`index.ts`を変更する
```ts:index.ts
serve({
  fetch: app.fetch,
  port: 8080 //変更
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
```

必要なら`npm run dev`で再起動する
todoを少なくとも1つ追加しておく

# 3. todo mcp server を作る

```sh
cd mcp-todo
mkdir mcp
cd mcp
npm init -y
npm install @modelcontextprotocol/sdk zod hono @hono/node-server hono-mcp-server-sse-transport
npm install -D @types/node typescript
touch tsconfig.json
touch main.ts
```
```
mcp-todos
└─ api
│   └─ generated
│   └─ etc...
└─ mcp

```

導入したライブラリについて

- `@modelcontextprotocol/sdk`
  - MCPを作るために
- `Zod`
  - MCPサーバーのインプットに対するバリデーションをするために
- `@hono/node-server`
  - APIサーバー構築のため
- `hono-mcp-server-sse-transport`
  - HonoでMCPを作るための


curserでmcpを開き次のようにする
[url](https://qiita.com/Sicut_study/items/e0fbbbf51cdd54d76b1a#3-todo-mcp-server%E3%82%92%E4%BD%9C%E3%82%8B)

```ts:tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "moduleResolution": "node16"
  }
}
```
```ts:package.json
{
  "name": "mcp",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "dev": "npx tsc --project tsconfig.json && node main.js" //追加
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": "",
  "dependencies": {
    "@hono/node-server": "^1.14.2",
    "@modelcontextprotocol/sdk": "^1.11.4",
    "hono": "^4.7.10",
    "hono-mcp-server-sse-transport": "^0.0.6",
    "zod": "^3.25.7"
  },
  "devDependencies": {
    "@types/node": "^22.15.19",
    "typescript": "^5.8.3"
  }
}
```
