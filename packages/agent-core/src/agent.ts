import { initChatModel } from "langchain";
import type { ModelConfig } from "./types.js";

export interface StreamModelConfig {
  agentName: string;
  modelName: string;
  agentConfig: Record<string, unknown>;
  modelConfig: ModelConfig;
}

export async function initStreamModel(config: StreamModelConfig): Promise<any> {
  const { modelConfig } = config;
  const modelName = modelConfig.id;
  const modelProvider = modelConfig.provider;
  const modelBaseUrl = modelConfig.base_url;
  const modelApiKey = modelConfig.api_key;
  const modelUseEvnApiKey = modelConfig.use_env_api_key === 1;
  const modelTemperature = modelConfig.temperature;
  // 读取环境变量key，兜底空字符串
  const apiKey = modelUseEvnApiKey
    ? (process.env[modelApiKey] ?? "")
    : modelApiKey;
  return initChatModel(modelName, {
    modelProvider,
    configuration: {
      baseURL: modelBaseUrl,
    },
    apiKey,
    temperature: modelTemperature,
    streaming: true,
    maxRetries: 3,
    timeout: 25000,
  });
}
