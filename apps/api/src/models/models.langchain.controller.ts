import { createAgent } from '@keep-claw/agent-core';
import { Controller, Query, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as crypto from 'node:crypto';

interface StreamQuery {
  input?: string;
  id?: string;
}

type MessageChunk = Record<string, unknown>;

@Controller('models-streaming')
export class ModelsLangchainController {
  @Get()
  async stream(@Query() query: StreamQuery, @Res() res: Response) {
    if (!query.input) return;
    try {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      const input = decodeURIComponent(query.input).trim();
      const chatId = query.id || crypto.randomUUID();

      // 使用 agent（内置 FileSaver + systemPrompt），无需手动管理消息历史
      const { agent } = await createAgent('qwen', {
        threadId: chatId,
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const response = await agent.stream(
        { messages: [{ role: 'user', content: input }] },
        {
          streamMode: 'messages',
          configurable: { thread_id: chatId },
        },
      );

      let sessionId = '';
      let thinkingEnded = false;

      for await (const chunk of response) {
        // agent.stream() streamMode:"messages" 返回 [messageChunk, metadata] 元组
        const [messageChunk] = chunk as [MessageChunk, unknown];
        const chunkData: MessageChunk = messageChunk;

        if (!sessionId) {
          sessionId = (chunkData.id as string) || chatId;
        }

        const additionalKwargs = chunkData.additional_kwargs as
          | Record<string, unknown>
          | undefined;
        const rawContent: unknown = chunkData.content;
        const content = typeof rawContent === 'string' ? rawContent : undefined;
        const thinkingContent = additionalKwargs?.reasoning_content as
          | string
          | undefined;

        // 有 thinking 内容 → 输出 thinking 流
        if (thinkingContent) {
          res.write(
            JSON.stringify({
              id: sessionId,
              thinking: true,
              thinkingContent,
              isEnd: false,
            }) + '\n',
          );
        }
        // thinking 结束、有实际文本内容 → 输出内容流
        else if (content) {
          if (!thinkingEnded) {
            thinkingEnded = true;
            // 发送一个 thinking: true + empty thinkingContent 标记 thinking 阶段结束
            res.write(
              JSON.stringify({
                id: sessionId,
                thinking: true,
                thinkingContent: '',
                isEnd: false,
              }) + '\n',
            );
          }
          res.write(
            JSON.stringify({
              id: sessionId,
              thinking: false,
              content,
              isEnd: false,
            }) + '\n',
          );
        }
      }

      // 流结束
      res.write(
        JSON.stringify({
          id: sessionId,
          thinking: false,
          isEnd: true,
        }),
      );
      res.end();
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      res.write(
        JSON.stringify({
          error: errorMessage,
          isEnd: true,
        }),
      );
      res.end();
    }
  }
}
