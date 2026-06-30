import dotenv from "dotenv";
import { resolve } from "node:path";
import { readAgentConfigByName } from "./readConfig.js";
import { initStreamModel } from "./agent.js";
import type { AgentConfig, ModelConfig } from "./types.js";
export { SystemMessage, AIMessage, HumanMessage } from "langchain";

dotenv.config({
  path: resolve(__dirname, "../.env"),
});

export interface AgentContext {
  model: any;
  config: {
    agentConfig: AgentConfig;
    modelConfig: ModelConfig;
  };
}

/**
 * 根据 agent 名称获取已初始化的模型实例和配置
 */
export async function createAgent(agentName: string): Promise<AgentContext> {
  const config = readAgentConfigByName(agentName);
  if (!config) {
    throw new Error("智能体配置不存在");
  }
  const model = await initStreamModel(config);
  return {
    model,
    config: {
      agentConfig: config.agentConfig as AgentConfig,
      modelConfig: config.modelConfig as ModelConfig,
    },
  };
}
