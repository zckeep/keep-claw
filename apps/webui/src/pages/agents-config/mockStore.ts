export interface Tool {
  name: string;
  description: string;
  active: 0 | 1;
  builtin: 0 | 1;
}

export interface Agent {
  name: string;
  model: string;
  tools: string[];
  description: string;
  active: 0 | 1;
  systemPrompt: string;
}

export interface ModelConfig {
  name: string;
  provider: string;
  active: 0 | 1;
  id: string;
  base_url: string;
  api_key: string;
  use_env_api_key: 0 | 1;
  temperature: number;
}

const STORAGE_KEY = 'keep_claw_config';

function loadFromStorage<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${key}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return fallback;
}

function saveToStorage(key: string, data: unknown) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${key}`, JSON.stringify(data));
  } catch {}
}

const defaultAgents: Agent[] = [
  {
    name: '默认助手',
    model: '',
    description: '',
    systemPrompt: '',
    tools: [],
    active: 1,
  },
];

const defaultModels: ModelConfig[] = [
  {
    name: 'GPT-4',
    provider: 'openai',
    active: 1,
    id: 'gpt-4',
    base_url: 'https://api.openai.com/v1',
    api_key: '',
    use_env_api_key: 1,
    temperature: 0.7,
  },
];

const defaultTools: Tool[] = [
  {
    name: '网页搜索',
    description: '通过搜索引擎搜索互联网上的实时信息',
    active: 1,
    builtin: 1,
  },
  {
    name: '文件读取',
    description: '读取本地文件内容，支持文本、CSV、JSON 等格式',
    active: 1,
    builtin: 1,
  },
  {
    name: '代码解释器',
    description: '执行 Python/JavaScript 代码进行数据分析和计算',
    active: 0,
    builtin: 1,
  },
  {
    name: '浏览器自动化',
    description: '像真人一样操作浏览器，填表、采集数据、截图',
    active: 1,
    builtin: 0,
  },
  {
    name: '数据库查询',
    description: '连接 MySQL/PostgreSQL 执行 SQL 查询',
    active: 0,
    builtin: 0,
  },
  {
    name: '邮件发送',
    description: '发送和读取电子邮件',
    active: 0,
    builtin: 0,
  },
];

let agents: Agent[] = loadFromStorage('agents', defaultAgents);
let models: ModelConfig[] = loadFromStorage('models', defaultModels);
let tools: Tool[] = loadFromStorage('tools', defaultTools);

type Listener = () => void;
const listeners: { agents: Listener[]; models: Listener[]; tools: Listener[] } =
  {
    agents: [],
    models: [],
    tools: [],
  };

export const subscribe = (
  type: 'agents' | 'models' | 'tools',
  listener: Listener,
) => {
  listeners[type].push(listener);
  return () => {
    listeners[type] = listeners[type].filter((l) => l !== listener);
  };
};

const notify = (type: 'agents' | 'models' | 'tools') => {
  listeners[type].forEach((l) => {
    l();
  });
};

export const getAgents = () => [...agents];
export const setAgents = (data: Agent[]) => {
  agents = data;
  saveToStorage('agents', agents);
  notify('agents');
};

export const getModels = () => [...models];
export const setModels = (data: ModelConfig[]) => {
  models = data;
  saveToStorage('models', models);
  notify('models');
};

export const getTools = () => [...tools];
export const getEnabledTools = () => tools.filter((t) => t.active === 1);
export const setTools = (data: Tool[]) => {
  tools = data;
  saveToStorage('tools', tools);
  notify('tools');
  notify('agents');
};

export const toggleToolActive = (name: string) => {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return;
  const wasActive = tool.active === 1;
  tool.active = wasActive ? 0 : 1;
  saveToStorage('tools', tools);
  notify('tools');

  if (wasActive) {
    agents = agents.map((a) => ({
      ...a,
      tools: a.tools.filter((t) => t !== name),
    }));
    saveToStorage('agents', agents);
    notify('agents');
  }
};
