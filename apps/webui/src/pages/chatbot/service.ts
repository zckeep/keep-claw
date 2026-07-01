const CHAT_STREAM_API_BASE_URL = '/api';

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
  const normalizedBase = CHAT_STREAM_API_BASE_URL.endsWith('/')
    ? CHAT_STREAM_API_BASE_URL
    : `${CHAT_STREAM_API_BASE_URL}/`;
  const params = new URLSearchParams({ input });
  if (id) params.set('id', id);
  return `${normalizedBase}models-streaming?${params.toString()}`;
};

export const streamChatCompletion = async (
  input: string,
  { signal, id, onChunk }: StreamChatOptions,
) => {
  const response = await fetch(createChatStreamUrl(input, id), {
    method: 'GET',
    signal,
  });

  if (!response.ok) {
    throw new Error(`请求失败（${response.status}）`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('未获取到可读流');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';

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
  const rest = lines.pop() ?? '';
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

  return { objects, rest: flushFinalLine ? '' : rest };
};
