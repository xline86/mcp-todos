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

参考サイト
[【これ1本/初心者OK】MCPを実装理解するチュートリアル！Next.jsでAIアシスタントを開発【図解解説】](https://qiita.com/Sicut_study/items/e0fbbbf51cdd54d76b1a)

# 作成するアプリについて

todoアプリ

## 仕組み

![今回作成するアプリの構成](./images/https___qiita-image-store.s3.ap-northeast-1.amazonaws.com_0_810513_04d91ca9-412a-43d0-88d5-cdbd3efee47e.avif)

ポート
- localhost:3000
  - チャットアプリ&MCPクライアント(Next.js)
- localhost:3001
  - MCPサーバー
- localhost:8080
  - todoアプリのapiサーバ

# MCPの通信方式

#### stdio

localで動作。標準入力/標準出力なので高速で安全

#### streamable httpトランスポート

主流。サーバは単一のエンドポイントを提供し、クライアントはhttp postでリクエストする

#### thhp + sse

クライアントがHTTPリクエストでサーバーにアクセスし、サーバーからはSSEで複数のメッセージをストリーミングできる方式。
Streamable HTTPトランスポートの利用が推奨

今回はこれを使う。

# 使用する技術

#### next.js

#### hono

#### Prisma

#### ai/sdk

# 1. 環境構築

```sh
node -v
v22.15.0
mkdir mcp-todos # プロジェクトディレクトリ
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

`/mcp-todos/api`で実行
```sh
npm run dev
curl http://localhost:3000
```

あるいはブラウザに`http://localhost:3000`と入力してもいい

サーバーを停止させるときは`ctrl + c`

## API のコード

`/mcp-todos/api/src/index.ts`にある

# 2. PrismaでDBを作る

今回はsqliteを使う
```sh
cd api
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

```json:mcp/tsconfig.json
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
```json:mcp/package.json
{
  "name": "mcp",
  "version": "1.0.0",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "dev": "npx tsc --project tsconfig.json && node main.js"
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
```ts:mcp/main.ts
import { Hono } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { serve } from "@hono/node-server";
import { streamSSE } from "hono/streaming"; // 追加
import { SSETransport } from "hono-mcp-server-sse-transport"; // 追加
import { z } from "zod";

const app = new Hono();

const mcpServer = new McpServer({
  name: "todo-mcp-server",
  version: "1.0.0",
});

async function addTodoItem(title: string) {
  try {
    const response = await fetch("http://localhost:8080/todos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: title }),
    });
    if (!response.ok) {
      console.error(
        `[addTodoItem] APIサーバーからエラー: ${response.status} ${response.statusText}`
      );
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error("[addTodoItem] fetchでエラー:", err);
    return null;
  }
}

mcpServer.tool(
  "addTodoItem",
  "Add a new todo item",
  {
    title: z.string().min(1).describe("Title for new Todo"),
  },
  async ({ title }) => {
    const todoItem = await addTodoItem(title);
    return {
      content: [
        {
          type: "text",
          text: `${title}を追加しました`,
        },
      ],
    };
  }
);

async function deleteTodoItem(id: number) {
  try {
    console.log("[deleteTodoItem] ID:", id);
    const response = await fetch(`http://localhost:8080/todos/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      console.error(
        `[deleteTodoItem] APIサーバーからエラー: ${response.status} ${response.statusText}`
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[deleteTodoItem] fetchでエラー:", err);
    return false;
  }
}

mcpServer.tool(
  "deleteTodoItem",
  "Delete a todo item",
  {
    id: z.number().describe("ID of the Todo to delete"),
  },
  async ({ id }) => {
    console.log("[deleteTodoItem] ID:", id);
    const success = await deleteTodoItem(id);
    return {
      content: [
        {
          type: "text",
          text: `${id}を削除しました`,
        },
      ],
    };
  }
);

async function updateTodoItem(id: string, completed: boolean) {
  try {
    const response = await fetch(`http://localhost:8080/todos/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ completed }),
    });
    if (!response.ok) {
      console.error(
        `[updateTodoItem] APIサーバーからエラー: ${response.status} ${response.statusText}`
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[updateTodoItem] fetchでエラー:", err);
    return false;
  }
}

mcpServer.tool(
  "updateTodoItem",
  "Update a todo item",
  {
    id: z.string().describe("ID of the Todo to update"),
    completed: z.boolean().describe("Completion status of the Todo"),
  },
  async ({ id, completed }) => {
    const success = await updateTodoItem(id, completed);
    return {
      content: [
        {
          type: "text",
          text: `${id}を更新しました`,
        },
      ],
    };
  }
);

serve({
  fetch: app.fetch,
  port: 3001,
});
console.log("[MCP] サーバーがポート3001で起動しました");

// 追加
let transports: { [sessionId: string]: SSETransport } = {};

app.get("/sse", (c) => {
  console.log("[SSE] /sse endpoint accessed");
  return streamSSE(c, async (stream) => {
    try {
      const transport = new SSETransport("/messages", stream);
      console.log(
        `[SSE] New SSETransport created: sessionId=${transport.sessionId}`
      );

      transports[transport.sessionId] = transport;

      stream.onAbort(() => {
        console.log(`[SSE] stream aborted: sessionId=${transport.sessionId}`);
        delete transports[transport.sessionId];
      });

      await mcpServer.connect(transport);
      console.log(
        `[SSE] mcpServer connected: sessionId=${transport.sessionId}`
      );

      while (true) {
        await stream.sleep(60_000);
      }
    } catch (err) {
      console.error("[SSE] Error in streamSSE:", err);
    }
  });
});

app.post("/messages", async (c) => {
  const sessionId = c.req.query("sessionId");
  const transport = transports[sessionId ?? ""];

  if (!transport) {
    return c.text("No transport found for sessionId", 400);
  }

  return transport.handlePostMessage(c);
});
```

`async function addTodoItem(title: string)`, `mcpServer.tool("addTodoItem",...)`は見ればわかるはず。説明略

import文でエラーがでている


```bash
cd mcp-todos
npx create-next-app@latest

# 名前だけ気をつける: `client`
✔ What is your project named? … client
✔ Would you like to use TypeScript? … No / Yes
✔ Would you like to use ESLint? … No / Yes
✔ Would you like to use Tailwind CSS? … No / Yes
✔ Would you like your code inside a `src/` directory? … No / Yes
✔ Would you like to use App Router? (recommended) … No / Yes
✔ Would you like to use Turbopack for `next dev`? … No / Yes
✔ Would you like to customize the import alias (`@/*` by default)? … No / Yes
```
```bash
cd mcp-todos/client
npm run dev
```

<http://localhost:3000>にアクセスして`next.js`の画面が表示されていれば大丈夫です。

一覧取得にはTanStack Queryを利用します。

```bash
cd client
npm i @tanstack/react-query
touch src/app/QueryProvider.tsx
```
