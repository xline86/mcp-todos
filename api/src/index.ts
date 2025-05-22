import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { PrismaClient } from "../generated/prisma/index.js";

const app = new Hono()
const prisma = new PrismaClient();

// ルートに get　リクエストが来たときの処理
app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// エンドポイントを追加。jsonでレスポンスを返す
app.get("/systems/ping", (c) => {
  return c.json({ message: "pong" });
});

// Prismaを使ってデータベースからデータを取得するエンドポイント
app.get("/todos", async (c) => {
  const todos = await prisma.todo.findMany(); //findMany: 条件に一致する全てのレコードを取得
  return c.json(todos);
});

// Prismaを使ってデータベースにデータを追加するエンドポイント
app.post("/todos", async (c) => {
  // リクエストボディをパース
  const body = await c.req.json();
  const { title } = body;
  if (!title) {
    return c.json({ error: "Title is required" }, 400);
  }
  // Dbに追加(title以外はデフォルト値)
  const todo = await prisma.todo.create({
    data: { title },
  });
  return c.json(todo);
});

// DBアップデート用のエンドポイント(:idはURLパラメータ)
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

// node.js でのサーバー起動
serve({
  fetch: app.fetch,
  port: 8080
}, (info) => {
  // ターミナルに表示
  console.log(`Server is running on http://localhost:${info.port}`)
})
