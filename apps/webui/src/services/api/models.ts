import { request } from "@umijs/max";

export interface ModelDto {
  name: string;
  provider: string;
  active: 0 | 1;
  id: string;
  base_url: string;
  api_key: string;
  use_env_api_key: 0 | 1;
  temperature: number;
}

interface ApiResponse<T> {
  code: number;
  data: T;
  msg: string;
}

export async function getModels(): Promise<ModelDto[]> {
  const res = await request<ApiResponse<ModelDto[]>>("/api/models", {
    method: "GET",
    skipErrorHandler: true,
  });
  return res.data;
}

export async function getModel(name: string): Promise<ModelDto> {
  const res = await request<ApiResponse<ModelDto>>(
    `/api/models/${encodeURIComponent(name)}`,
    {
      method: "GET",
      skipErrorHandler: true,
    },
  );
  return res.data;
}

export async function createModel(data: ModelDto): Promise<ModelDto> {
  const res = await request<ApiResponse<ModelDto>>("/api/models", {
    method: "POST",
    data,
    skipErrorHandler: true,
  });
  return res.data;
}

export async function updateModel(
  name: string,
  data: ModelDto,
): Promise<ModelDto> {
  const res = await request<ApiResponse<ModelDto>>(
    `/api/models/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      data,
      skipErrorHandler: true,
    },
  );
  return res.data;
}

export async function deleteModel(name: string): Promise<void> {
  await request(`/api/models/${encodeURIComponent(name)}`, {
    method: "DELETE",
    skipErrorHandler: true,
  });
}
