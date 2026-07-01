import { request } from "@umijs/max";

export interface AgentDto {
  name: string;
  model: string;
  tools: string[];
  description: string;
  active: 0 | 1;
  systemPrompt: string;
}

interface ApiResponse<T> {
  code: number;
  data: T;
  msg: string;
}

export async function getAgents(): Promise<AgentDto[]> {
  const res = await request<ApiResponse<AgentDto[]>>("/api/agents", {
    method: "GET",
    skipErrorHandler: true,
  });
  return res.data;
}

export async function getAgent(name: string): Promise<AgentDto> {
  const res = await request<ApiResponse<AgentDto>>(
    `/api/agents/${encodeURIComponent(name)}`,
    {
      method: "GET",
      skipErrorHandler: true,
    },
  );
  return res.data;
}

export async function createAgent(data: AgentDto): Promise<AgentDto> {
  const res = await request<ApiResponse<AgentDto>>("/api/agents", {
    method: "POST",
    data,
    skipErrorHandler: true,
  });
  return res.data;
}

export async function updateAgent(
  name: string,
  data: AgentDto,
): Promise<AgentDto> {
  const res = await request<ApiResponse<AgentDto>>(
    `/api/agents/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      data,
      skipErrorHandler: true,
    },
  );
  return res.data;
}

export async function deleteAgent(name: string): Promise<void> {
  await request(`/api/agents/${encodeURIComponent(name)}`, {
    method: "DELETE",
    skipErrorHandler: true,
  });
}
