export interface ModelConfig {
  id: string;
  provider: string;
  base_url?: string;
  api_key: string;
  use_env_api_key: 0 | 1;
  temperature: number;
}

export interface AgentConfig {
  model: string;
  tools?: string[];
  description?: string;
  active?: number;
  systemPrompt?: string;
  [key: string]: unknown;
}
