const API_BASE = "/api";

export interface ConversationMeta {
  threadId: string;
  title: string;
  updatedAt: string;
  createdAt: string;
}

export interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  thinkContent?: string;
}

/** 获取所有会话列表 */
export const fetchConversations = async (): Promise<ConversationMeta[]> => {
  const response = await fetch(`${API_BASE}/conversations`);
  if (!response.ok) throw new Error("获取会话列表失败");
  const json = (await response.json()) as {
    code: number;
    data: ConversationMeta[];
    msg: string;
  };
  return json.data ?? [];
};

/** 获取指定会话的消息历史 */
export const fetchConversationMessages = async (
  threadId: string,
): Promise<DisplayMessage[]> => {
  const response = await fetch(`${API_BASE}/conversations/${threadId}`);
  if (!response.ok) throw new Error("获取会话消息失败");
  const json = (await response.json()) as {
    code: number;
    data: DisplayMessage[];
    msg: string;
  };
  return json.data ?? [];
};

/** 删除指定会话 */
export const deleteConversation = async (
  threadId: string,
): Promise<boolean> => {
  const response = await fetch(`${API_BASE}/conversations/${threadId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("删除会话失败");
  const json = (await response.json()) as {
    code: number;
    data: { ok: boolean };
    msg: string;
  };
  return json.data?.ok ?? false;
};

export interface StreamChatOptions {
  signal?: AbortSignal;
  id?: string;
  onChunk: (chunk: ChatStreamChunk) => void;
}

export interface ChatStreamChunk {
  id?: string;
  thinking?: boolean;
  thinkingContent?: string;
  content?: string;
  isEnd?: boolean;
}

const createChatStreamUrl = (input: string, id?: string): string => {
  const normalizedBase = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;
  const params = new URLSearchParams({ input });
  if (id) params.set("id", id);
  return `${normalizedBase}models-streaming?${params.toString()}`;
};

export const streamChatCompletion = async (
  input: string,
  { signal, id, onChunk }: StreamChatOptions,
) => {
  const response = await fetch(createChatStreamUrl(input, id), {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    throw new Error(`请求失败（${response.status}）`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("未获取到可读流");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  const flushBuffer = (flushFinalLine = false) => {
    const { objects, rest } = extractJsonLines(buffer, flushFinalLine);
    buffer = rest;
    objects.forEach((item) => {
      onChunk(item);
    });
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    if (chunk) {
      buffer += chunk;
      flushBuffer();
    }
  }

  const rest = decoder.decode();
  if (rest) {
    buffer += rest;
  }

  flushBuffer(true);
};

const extractJsonLines = (
  source: string,
  flushFinalLine = false,
): { objects: ChatStreamChunk[]; rest: string } => {
  const objects: ChatStreamChunk[] = [];
  const lines = source.split(/\r?\n/);
  const rest = lines.pop() ?? "";
  const completedLines = flushFinalLine ? [...lines, rest] : lines;

  completedLines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    try {
      objects.push(JSON.parse(trimmed) as ChatStreamChunk);
    } catch {
      // Keep the stream resilient and skip malformed lines.
    }
  });

  return { objects, rest: flushFinalLine ? "" : rest };
};
