import { Injectable } from '@nestjs/common';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';

/** 单个配置项的通用类型：key-value 对象的 JSON 形态 */
export type ConfigEntry = Record<string, unknown>;

/**
 * 根配置文件 keep_claw.json 的整体结构。
 * 使用 Record<string, ConfigEntry>（Map 形态）存储 agents / models / tools，
 * 以 name 作为 key 保证唯一性，O(1) 索引。
 */
export interface RootConfig {
  agents?: Record<string, ConfigEntry>;
  models?: Record<string, ConfigEntry>;
  tools?: Record<string, ConfigEntry>;
  [key: string]: unknown;
}

/** 首次初始化时的空配置默认值 */
const DEFAULT_ROOT_CONFIG: RootConfig = { agents: {}, models: {}, tools: {} };

/**
 * 配置文件读写服务。
 * - 配置路径：~/.keep_claw/keep_claw.json
 * - 写入采用"先写临时文件、再 rename"的原子操作，防止 JSON 损坏
 * - 读取时若文件不存在则自动创建默认空配置
 */
@Injectable()
export class ConfigFileService {
  private readonly configPath = join(homedir(), '.keep_claw', 'keep_claw.json');

  getConfigPath(): string {
    return this.configPath;
  }

  /** 读取并返回完整配置，文件缺失时自动初始化 */
  async readConfig(): Promise<RootConfig> {
    await this.ensureDirectoryExists();
    try {
      const content = await readFile(this.configPath, 'utf8');
      const parsed = JSON.parse(content) as unknown;
      if (!this.isPlainObject(parsed)) {
        throw new Error('Root config must be a JSON object.');
      }
      return this.normalizeRootConfig(parsed);
    } catch (error) {
      // 文件不存在时写入默认空配置
      if (this.isMissingFileError(error)) {
        await this.writeConfig(DEFAULT_ROOT_CONFIG);
        return { ...DEFAULT_ROOT_CONFIG };
      }
      throw error;
    }
  }

  /**
   * 原子写入完整配置。
   * 先写入 .tmp 临时文件，再 rename 到目标路径，避免写入过程中进程崩溃导致文件损坏。
   */
  async writeConfig(config: RootConfig): Promise<void> {
    await this.ensureDirectoryExists();

    const normalized = this.normalizeRootConfig(config);
    const serialized = `${JSON.stringify(normalized, null, 2)}\n`;
    const tempPath = `${this.configPath}.${randomUUID()}.tmp`;

    await writeFile(tempPath, serialized, 'utf8');
    await rename(tempPath, this.configPath);
  }

  /** 确保 ~/.keep_claw 目录存在 */
  private async ensureDirectoryExists(): Promise<void> {
    await mkdir(dirname(this.configPath), { recursive: true });
  }

  /**
   * 规范化配置对象：保证 agents / models / tools 一定是合法的 Object，
   * 防止从 JSON 文件读取到数组或非对象值导致后续业务逻辑崩溃。
   */
  private normalizeRootConfig(config: RootConfig): RootConfig {
    return {
      ...config,
      agents: this.isPlainObject(config.agents) ? config.agents : {},
      models: this.isPlainObject(config.models) ? config.models : {},
      tools: this.isPlainObject(config.tools) ? config.tools : {},
    };
  }

  /** 判断值是否为普通 JS 对象（非 null、非数组） */
  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /** 判断是否为文件不存在的 ENOENT 错误 */
  private isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
    return typeof error === 'object' && error !== null && 'code' in error
      ? error.code === 'ENOENT'
      : false;
  }
}
