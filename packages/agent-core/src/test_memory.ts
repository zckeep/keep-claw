import { createAgent } from "./index.js";

type StreamChunk = Record<string, any>;

function printThinking(chunk: StreamChunk) {
  if (chunk.additional_kwargs?.reasoning_content) {
    process.stdout.write(chunk.additional_kwargs.reasoning_content);
  }
}
function printContent(chunk: StreamChunk) {
  if (chunk.content) {
    process.stdout.write(chunk.content);
  }
}
function printToolCalls(chunk: StreamChunk) {
  const toolCalls = chunk.tool_calls;
  for (const toolCall of toolCalls) {
    process.stdout.write(`调用工具: ${toolCall.name}\n`);
    process.stdout.write(`工具参数: ${JSON.stringify(toolCall.args)}\n`);
    process.stdout.write(`工具ID: ${toolCall.id}`);
  }
}

function hasThinking(chunk: StreamChunk) {
  return !!chunk.additional_kwargs?.reasoning_content;
}
function hasContent(chunk: StreamChunk) {
  return !!chunk.content;
}
function hasToolCalls(chunk: StreamChunk) {
  return chunk.tool_calls && chunk.tool_calls.length > 0;
}
function hasToolCallResult(chunk: StreamChunk) {
  return !!chunk.tool_call_id;
}
function isEnd(chunk: StreamChunk) {
  return !hasThinking(chunk) && !hasContent(chunk) && !hasToolCalls(chunk);
}

async function testMemory(message: string) {
  const threadId = "96d7de1a-6059-47fc-a394-385a3533e6ed";
  let enableThinking = true;
  const { agent, close } = await createAgent("qwen", {
    threadId,
  });
  try {
    const response = await agent.stream(
      {
        messages: [{ role: "user", content: message }],
      },
      {
        streamMode: "messages",
        configurable: {
          thread_id: threadId,
        },
      },
    );
    let stepStart = false;
    let stepEnd = false;
    let currentStep = 0;
    let startThinking = false;
    let hasOutputContentHead = false;
    for await (const chunk of response) {
      const [messageChunk, metadata] = chunk;
      const step = metadata.langgraph_step;
      if (step > currentStep) {
        stepStart = true;
        currentStep = step;
        stepEnd = false;
        console.log(`[第${step}步] 开始执行`);
      }
      if (enableThinking) {
        // 是否有思考内容
        if (!startThinking && hasThinking(messageChunk)) {
          startThinking = true;
          process.stdout.write("思考过程:\n");
        }
        if (hasThinking(messageChunk)) {
          printThinking(messageChunk);
        }
        if (startThinking && !hasThinking(messageChunk)) {
          startThinking = false;
          console.log();
          if (hasContent(messageChunk)) {
            process.stdout.write("\n最终结果\n");
          }
        }
      } else {
        if (!hasOutputContentHead) {
          if (!isEnd(messageChunk)) {
            if (!hasToolCallResult(messageChunk)) {
              process.stdout.write("输出结果\n");
            }
            hasOutputContentHead = true;
          }
        }
      }
      // 是否有工具调用结果
      if (hasToolCallResult(messageChunk)) {
        process.stdout.write("工具调用结果\n");
        printContent(messageChunk);
        console.log();
        stepEnd = true;
      } else if (hasContent(messageChunk)) {
        // 是否有最终结果
        printContent(messageChunk);
      }

      // 是否有工具调用
      if (hasToolCalls(messageChunk)) {
        process.stdout.write("\n\n调用工具\n");
        printToolCalls(messageChunk);
      }

      if (stepEnd || isEnd(messageChunk)) {
        console.log();
        stepEnd = true;
        hasOutputContentHead = false;
      }
    }
  } catch (error) {
  } finally {
    await close();
  }
}
// testMemory("我们刚才聊了什么？");
// testMemory("当前目录下有哪些文件");
testMemory("执行 ls-al 命令");
