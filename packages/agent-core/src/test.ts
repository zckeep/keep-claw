import { createAgent } from "./index.js";

const agentName = process.argv[2] || "qwen";

createAgent(agentName, {})
  .then(async ({ model }) => {
    const response = await model.stream("你好，你是谁？");
    for await (const chunk of response) {
      const content = chunk.content;
      if (typeof content === "string") {
        process.stdout.write(content);
      }
    }
    process.stdout.write("\n");
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
