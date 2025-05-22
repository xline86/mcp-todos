import { Hono } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { serve } from "@hono/node-server";
import { streamSSE } from "hono/streaming";
import { SSETransport } from "hono-mcp-server-sse-transport";
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

// todoを追加するツールを定義
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

async function updateTodoItem(id: number, completed: boolean) {//id: stringをnumberに変更
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
    id: z.number().describe("ID of the Todo to update"),
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
