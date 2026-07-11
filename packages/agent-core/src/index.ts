import dotenv from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import os from "node:os";
import path from "node:path";
import { readAgentConfigByName } from "./readConfig.js";
import { initStreamModel } from "./agent.js";
import { FileSaver } from "./FileSaver.js";
import type { AgentConfig, ModelConfig } from "./types.js";
import { createAgent as createLangchainAgent, tool } from "langchain";
export { SystemMessage, AIMessage, HumanMessage } from "langchain";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
export interface AgentContext {
  agent: any;
  model: any;
  config: {
    agentConfig: AgentConfig;
    modelConfig: ModelConfig;
  };
  close: () => Promise<void>;
}
async function loadMcpTools(toolsEnable: Record<string, boolean>) {
  const tools: Awaited<ReturnType<typeof convertToolsToLangchainTools>> = [];
  let fileClient: Client | undefined;
  let shellClient: Client | undefined;
  if (toolsEnable.fileTools) {
    const { fileTools, client } = await loadMcpFileTools();
    tools.push(...fileTools);
    fileClient = client;
  }
  if (toolsEnable.shellTools) {
    const { shellTools, client } = await loadMcpShellTools();
    tools.push(...shellTools);
    shellClient = client;
  }
  return {
    tools,
    close: async () => {
      if (fileClient) await fileClient.close();
      if (shellClient) await shellClient.close();
    },
  };
}
async function loadMcpShellTools() {
  let shellTools: Awaited<ReturnType<typeof convertToolsToLangchainTools>> = [];
  const client = new Client({
    name: "mcp-shell-stdio-client",
    version: "1.0.0",
  });
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "@mako10k/mcp-shell-server"],
    env: {
      MCP_SHELL_DEFAULT_WORKDIR: process.cwd(),
      MCP_SHELL_ALLOWED_WORKDIRS: `${process.cwd()}, "/Users/chaozhao/Desktop", "/Users/chaozhao/.keep_claw"`,
      MCP_SHELL_SECURITY_MODE: "permissive",
      MCP_SHELL_ELICITATION: "false",
      MCP_SHELL_ENHANCED_MODE: "false",
      MCP_SHELL_LLM_EVALUATION: "false",
      MCP_DISABLED_TOOLS: "process_terminate,delete_execution_outputs",
    },
  });
  await client.connect(transport);
  shellTools = await convertToolsToLangchainTools(client);
  return { shellTools, client };
}
// 加载文件系统工具
async function loadMcpFileTools() {
  let fileTools: Awaited<ReturnType<typeof convertToolsToLangchainTools>> = [];
  const client = new Client({
    name: "mcp-file-stdio-client",
    version: "1.0.0",
  });
  const transport = new StdioClientTransport({
    command: "npx",
    args: [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "/Users/chaozhao/Desktop",
      "/Users/chaozhao/Downloads/fils/langchain_ts",
    ],
  });
  await client.connect(transport);
  fileTools = await convertToolsToLangchainTools(client);
  return { fileTools, client };
}
type McpToolItem = {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, object>;
    required?: string[];
    [key: string]: unknown;
  };
};

async function convertToolsToLangchainTools(client: Client) {
  const { tools } = await client.listTools();
  return tools.map((item: McpToolItem) =>
    tool(
      async (input: Record<string, unknown>) => {
        const result = await client.callTool({
          name: item.name,
          arguments: input ?? {},
        });
        return result;
      },
      {
        name: item.name,
        description: item.description,
        schema: item.inputSchema,
      },
    ),
  );
}
interface CreateAgentOptions {
  threadId?: string;
  systemPrompt?: string;
  enableThinking?: boolean;
  toolsEnable?: Record<string, boolean>;
}
/**
 * 根据 agent 名称获取已初始化的模型实例和配置
 */
export async function createAgent(
  agentName: string,
  {
    threadId,
    systemPrompt,
    enableThinking = true,
    toolsEnable = {
      fileTools: true,
      shellTools: true,
      webTools: true,
    },
  }: CreateAgentOptions,
): Promise<AgentContext> {
  const config = readAgentConfigByName(agentName);
  if (!config) {
    throw new Error("智能体配置不存在");
  }
  const homePath = os.homedir();
  const filePath = path.join(
    homePath,
    ".keep_claw",
    "memory",
    `${threadId}.json`,
  );
  const model = await initStreamModel(config, { enableThinking });
  const checkpointer = new FileSaver(filePath);

  // 如果外部未传 systemPrompt，从配置文件读取
  const finalSystemPrompt =
    systemPrompt ??
    ((config.agentConfig as Record<string, unknown>).systemPrompt as
      | string
      | undefined);
  const { tools, close } = await loadMcpTools(toolsEnable);
  const agent = createLangchainAgent({
    model,
    tools,
    systemPrompt: finalSystemPrompt,
    checkpointer,
  });
  return {
    agent,
    model,
    close,
    config: {
      agentConfig: config.agentConfig as AgentConfig,
      modelConfig: config.modelConfig as ModelConfig,
    },
  };
}
