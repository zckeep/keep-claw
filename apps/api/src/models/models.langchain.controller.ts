import {
  createAgent,
  SystemMessage,
  HumanMessage,
  AIMessage,
} from '@keep-claw/agent-core';
import { Controller, Query, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

interface StreamQuery {
  input?: string;
  id?: string;
}

@Controller('models-streaming')
export class ModelsLangchainController {
  private messageMap: Record<string, unknown[]> = {};

  @Get()
  async stream(@Query() query: StreamQuery, @Res() res: Response) {
    if (!query.input) return;
    try {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      const input = decodeURIComponent(query.input).trim();
      const chatId = query.id ?? '';
      // eslint-disable-next-line
      const { model, config } = await createAgent('textAgent');
      let messages = this.messageMap[chatId];
      if (!messages) {
        this.messageMap[chatId] = [];
        messages = this.messageMap[chatId];
        const systemPrompt: string = (
          config.agentConfig as Record<string, unknown>
        ).systemPrompt as string;
        const systemMessage = new SystemMessage({
          content: systemPrompt,
        });
        messages.push(systemMessage);
      }
      const humanMessage = new HumanMessage({
        content: input,
      });
      messages.push(humanMessage);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const response = await model.stream(messages);
      let isThinking = true;
      let aiResult = '<think>';
      let sessionId = '';
      for await (const chunk of response) {
        console.log(chunk, 'chunk');
        const chunkData = chunk as Record<string, unknown>;
        const additionalKwargs = chunkData.additional_kwargs as
          | Record<string, unknown>
          | undefined;
        const id = chunkData.id as string | undefined;
        const rawContent: unknown = chunkData.content;
        const content = typeof rawContent === 'string' ? rawContent : undefined;

        if (!sessionId) {
          sessionId = id ?? '';
        }
        if (!this.messageMap[id ?? '']) {
          this.messageMap[id ?? ''] = [...messages];
        }
        const thinking = !!additionalKwargs?.reasoning_content;
        const thinkingContent = additionalKwargs?.reasoning_content as
          | string
          | undefined;

        // 有 thinking 内容 → 输出 thinking 流
        if (thinking && thinkingContent) {
          res.write(
            JSON.stringify({
              id,
              thinking: true,
              thinkingContent,
              isEnd: false,
            }) + '\n',
          );
        }
        // 有实际文本内容 → 输出内容流
        else if (content) {
          res.write(
            JSON.stringify({
              id,
              thinking: false,
              content,
              isEnd: false,
            }) + '\n',
          );
        }
        // 既无 thinking 也无内容 → 跳过（不标记结束，等循环结束统一处理）
        // 什么都不做

        // 组装 AI 完整回复
        if (isThinking) {
          if (thinkingContent) {
            aiResult += thinkingContent;
          } else {
            isThinking = false;
            aiResult += '</think>\n\n';
          }
        }
        if (!isThinking && content) {
          aiResult += content;
        }
      }

      // 流结束，发送最终的 isEnd: true
      res.write(
        JSON.stringify({
          id: sessionId,
          thinking: false,
          isEnd: true,
        }),
      );
      const aiMessage = new AIMessage({
        content: aiResult,
      });
      this.messageMap[sessionId].push(aiMessage);
      res.end();
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      const responseContent = {
        error: errorMessage,
        isEnd: true,
      };
      res.write(JSON.stringify(responseContent));
      res.end();
    }
  }
}
