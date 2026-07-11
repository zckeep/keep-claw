import fs from "node:fs";
import path from "node:path";
import { MemorySaver } from "@langchain/langgraph";

function uint8ToPlainText(arr: Uint8Array): unknown {
  const text = new TextDecoder().decode(arr);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function plainTextToUint8(data: unknown): Uint8Array {
  const text = typeof data === "string" ? data : JSON.stringify(data);
  return new TextEncoder().encode(text);
}

type StorageRecord = Record<string, any>;

export class FileSaver extends MemorySaver {
  filePath = "";

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
    this.load();
  }

  load() {
    if (fs.existsSync(this.filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.filePath, "utf8"));

        if (data.storage) {
          for (const [threadId, nsRecord] of Object.entries(data.storage)) {
            this.storage[threadId] = {};
            for (const [ns, cpRecord] of Object.entries(
              nsRecord as StorageRecord,
            )) {
              this.storage[threadId][ns] = {};
              for (const [checkpointId, tuple] of Object.entries(
                cpRecord as StorageRecord,
              )) {
                this.storage[threadId][ns][checkpointId] = [
                  plainTextToUint8(tuple[0]),
                  plainTextToUint8(tuple[1]),
                  tuple[2],
                ];
              }
            }
          }
        }

        if (data.writes) {
          for (const [outerKey, innerRecord] of Object.entries(data.writes)) {
            this.writes[outerKey] = {};
            for (const [innerKey, tuple] of Object.entries(
              innerRecord as StorageRecord,
            )) {
              this.writes[outerKey][innerKey] = [
                tuple[0],
                tuple[1],
                plainTextToUint8(tuple[2]),
              ];
            }
          }
        }
      } catch (e) {
        console.error("加载记忆失败", e);
      }
    }
  }

  save() {
    const data: { storage: StorageRecord; writes: StorageRecord } = {
      storage: {},
      writes: {},
    };

    for (const [threadId, nsRecord] of Object.entries(this.storage)) {
      data.storage[threadId] = {};
      for (const [ns, cpRecord] of Object.entries(nsRecord as StorageRecord)) {
        data.storage[threadId][ns] = {};
        for (const [checkpointId, tuple] of Object.entries(
          cpRecord as StorageRecord,
        )) {
          data.storage[threadId][ns][checkpointId] = [
            uint8ToPlainText(tuple[0] as Uint8Array),
            uint8ToPlainText(tuple[1] as Uint8Array),
            tuple[2],
          ];
        }
      }
    }

    for (const [outerKey, innerRecord] of Object.entries(this.writes)) {
      data.writes[outerKey] = {};
      for (const [innerKey, tuple] of Object.entries(
        innerRecord as StorageRecord,
      )) {
        data.writes[outerKey][innerKey] = [
          tuple[0],
          tuple[1],
          uint8ToPlainText(tuple[2] as Uint8Array),
        ];
      }
    }

    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf8");
  }

  async put(config: any, checkpoint: any, metadata: any): Promise<any> {
    const res = await super.put(config, checkpoint, metadata);
    this.save();
    return res;
  }

  async putWrites(config: any, writes: any, taskId: any): Promise<void> {
    await super.putWrites(config, writes, taskId);
    this.save();
  }

  async deleteThread(threadId: string): Promise<void> {
    await super.deleteThread(threadId);
    this.save();
  }
}
