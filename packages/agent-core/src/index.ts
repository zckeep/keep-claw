import dotenv from "dotenv";
import os from "node:os";
import path from "node:path";
import { readAgentConfigByName } from "./readConfig.js";
import { initStreamModel } from "./agent.js";
import { FileSaver } from "./FileSaver.js";
import type { AgentConfig, ModelConfig } from "./types.js";
import { createAgent as createLangchainAgent } from "langchain";
export { SystemMessage, AIMessage, HumanMessage } from "langchain";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
export interface AgentContext {
  agent: any;
  model: any;
  config: {
    agentConfig: AgentConfig;
    modelConfig: ModelConfig;
  };
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
  }: { threadId?: string; systemPrompt?: string; enableThinking?: boolean },
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

  const agent = createLangchainAgent({
    model,
    tools: [],
    systemPrompt: finalSystemPrompt,
    checkpointer,
  });
  return {
    agent,
    model,
    config: {
      agentConfig: config.agentConfig as AgentConfig,
      modelConfig: config.modelConfig as ModelConfig,
    },
  };
}
