import { request } from "@umijs/max";

export interface ToolDto {
  name: string;
  description: string;
  active: 0 | 1;
  builtin: 0 | 1;
}

interface ApiResponse<T> {
  code: number;
  data: T;
  msg: string;
}

export async function getTools(): Promise<ToolDto[]> {
  const res = await request<ApiResponse<ToolDto[]>>("/api/tools", {
    method: "GET",
    skipErrorHandler: true,
  });
  return res.data;
}

export async function updateTool(name: string, data: ToolDto): Promise<ToolDto> {
  const res = await request<ApiResponse<ToolDto>>(`/api/tools/${encodeURIComponent(name)}`, {
    method: "PUT",
    data,
    skipErrorHandler: true,
  });
  return res.data;
}
