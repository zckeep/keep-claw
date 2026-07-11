import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Controller, Delete, Get, Param } from '@nestjs/common';

interface ConversationMeta {
  threadId: string;
  title: string;
  updatedAt: string;
  createdAt: string;
}

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  thinkContent?: string;
}

interface MessageChunk {
  lc?: number;
  type?: string;
  id?: string[];
  role?: string;
  content?: string;
  kwargs?: {
    content?: string;
    additional_kwargs?: { reasoning_content?: string };
  };
}

interface CheckpointEntry {
  v?: number;
  id?: string;
  ts?: string;
  channel_values?: {
    messages?: MessageChunk[];
    [key: string]: unknown;
  };
}

interface CheckpointMeta {
  source?: string;
  step?: number;
  parents?: Record<string, unknown>;
}

type CheckpointTuple = [CheckpointEntry, CheckpointMeta, string | null];

/** 检查点映射：checkpointId → [entry, meta, parentId] */
type CheckpointMap = Record<string, CheckpointTuple>;

/** 命名空间：namespace → CheckpointMap */
type NamespaceMap = Record<string, CheckpointMap>;

/** FileSaver 存储文件格式 */
interface StorageFile {
  storage?: Record<string, NamespaceMap>;
  writes?: Record<string, Record<string, unknown>>;
}

function resolveRole(msg: MessageChunk): string {
  if (msg.lc && msg.type === 'constructor' && msg.id?.length) {
    const typeName = msg.id[msg.id.length - 1];
    if (typeName === 'HumanMessage') return 'user';
    if (typeName === 'AIMessage' || typeName === 'AIMessageChunk')
      return 'assistant';
    if (typeName === 'ToolMessage') return 'ToolMessage';
    return '';
  }
  if (msg.role) return msg.role;
  return '';
}

function getCheckpointTs(tuple: CheckpointTuple): number {
  const ts = tuple[0]?.ts;
  if (!ts) return 0;
  return new Date(ts).getTime();
}

function extractMessages(checkpoints: CheckpointMap): string[] {
  const msgs: string[] = [];
  const entries = Object.entries(checkpoints).sort(
    ([, a], [, b]) => getCheckpointTs(a) - getCheckpointTs(b),
  );

  const seen = new Set<string>();
  for (const [, tuple] of entries) {
    const channelMsgs = tuple[0]?.channel_values?.messages;
    if (!channelMsgs) continue;

    for (const msg of channelMsgs) {
      const role = resolveRole(msg);
      if (role === 'system') continue;

      const content =
        typeof msg.kwargs?.content === 'string'
          ? msg.kwargs.content
          : typeof msg.content === 'string'
            ? msg.content
            : '';

      if (!content) continue;
      const key = `${role}:${content}`;
      if (!seen.has(key)) {
        seen.add(key);
        msgs.push(content);
      }
    }
  }
  return msgs;
}

function extractDisplayMessages(checkpoints: CheckpointMap): DisplayMessage[] {
  const messages: DisplayMessage[] = [];
  const entries = Object.entries(checkpoints).sort(
    ([, a], [, b]) => getCheckpointTs(a) - getCheckpointTs(b),
  );

  const seen = new Set<string>();

  for (const [, tuple] of entries) {
    const channelMsgs = tuple[0]?.channel_values?.messages;
    if (!channelMsgs) continue;

    for (const msg of channelMsgs) {
      let role: 'user' | 'assistant' = 'assistant';
      const resolved = resolveRole(msg);
      if (resolved === 'system' || resolved === 'ToolMessage') continue;
      if (resolved === 'user') role = 'user';

      const content =
        typeof msg.kwargs?.content === 'string'
          ? msg.kwargs.content
          : typeof msg.content === 'string'
            ? msg.content
            : '';
      const thinkContent = msg.kwargs?.additional_kwargs?.reasoning_content;

      if (!content && !thinkContent) continue;
      const key = `${role}:${content}`;
      if (!seen.has(key)) {
        seen.add(key);
        messages.push({ role, content, thinkContent });
      }
    }
  }

  return messages;
}

@Controller('conversations')
export class ConversationsController {
  private get memoryDir(): string {
    return path.join(os.homedir(), '.keep_claw', 'memory');
  }

  private readStorageFile(filePath: string): StorageFile | null {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw) as StorageFile;
    } catch {
      return null;
    }
  }

  @Get()
  list(): ConversationMeta[] {
    const dir = this.memoryDir;
    if (!fs.existsSync(dir)) return [];

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    return files
      .map((filename) => {
        const threadId = filename.replace('.json', '');
        const filePath = path.join(dir, filename);
        const stat = fs.statSync(filePath);

        let title = '新会话';
        const createdAt = stat.birthtime.toISOString();

        const data = this.readStorageFile(filePath);
        if (data?.storage) {
          const nsMap = data.storage[threadId];
          if (nsMap) {
            for (const checkpointMap of Object.values(nsMap)) {
              const msgs = extractMessages(checkpointMap);
              if (msgs.length > 0) {
                title = msgs[0].slice(0, 30);
              }
              break;
            }
          }
        }

        return {
          threadId,
          title,
          updatedAt: stat.mtime.toISOString(),
          createdAt,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }

  @Get(':threadId')
  load(@Param('threadId') threadId: string): DisplayMessage[] {
    const filePath = path.join(this.memoryDir, `${threadId}.json`);
    if (!fs.existsSync(filePath)) return [];

    const data = this.readStorageFile(filePath);
    if (!data?.storage) return [];

    const nsMap = data.storage[threadId];
    if (!nsMap) return [];

    const allMessages: DisplayMessage[] = [];

    for (const checkpointMap of Object.values(nsMap)) {
      const msgs = extractDisplayMessages(checkpointMap);
      allMessages.push(...msgs);
      break;
    }

    return allMessages;
  }

  @Delete(':threadId')
  delete(@Param('threadId') threadId: string): { ok: boolean } {
    const filePath = path.join(this.memoryDir, `${threadId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        return { ok: false };
      }
    }
    return { ok: true };
  }
}
