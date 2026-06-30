import fs from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * 读取智能体配置
 * @param agentName
 * @returns
 */
export function readAgentConfigByName(agentName: string) {
  if (!agentName) {
    throw new Error("智能体不存在");
  }
  // 1.生成配置文件
  const configPath = join(homedir(), ".keep_claw", "keep_claw.json");
  try {
    // 2. 读取配置文件
    console.log("读取配置文件", configPath);
    const config = JSON.parse(fs.readFileSync(configPath).toString());
    // 3. 根据配置文件读取智能体配置，大模型配置 ，工具配置
    const agentsConfig = config.agents;
    const modelsConfig = config.models;
    if (!agentsConfig || !modelsConfig) {
      return null;
    }
    const agentConfig = agentsConfig[agentName];
    const modelName = agentConfig.model;
    const modelConfig = modelsConfig[modelName];
    if (!agentConfig || !modelConfig) {
      return null;
    }
    return { agentName, modelName, agentConfig, modelConfig };
  } catch (error) {
    console.error("读取配置文件失败", error);
    return null;
  }
}
