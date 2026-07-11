import { UserOutlined } from "@ant-design/icons";
import { PageContainer } from "@ant-design/pro-components";
import { Bubble, Conversations, Sender, Think, XProvider } from "@ant-design/x";
import type {
  BubbleItemType,
  BubbleListProps,
} from "@ant-design/x/es/bubble/interface";
import XMarkdown from "@ant-design/x-markdown";
import { Avatar, Card } from "antd";
import React, { useEffect, useMemo, useRef, useState } from "react";

import type { ChatMessage, ConversationItem } from "./data";
import {
  type ChatStreamChunk,
  streamChatCompletion,
  fetchConversations,
  fetchConversationMessages,
  deleteConversation,
  type ConversationMeta,
} from "./service";
import { useStyles } from "./style";

const WELCOME_TEXT = "🤖 你好，有什么可以帮你？";

const TypewriterTitle: React.FC = () => {
  const { styles } = useStyles();
  const [index, setIndex] = useState(0);
  const done = index >= WELCOME_TEXT.length;

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => {
        if (i >= WELCOME_TEXT.length) {
          clearInterval(timer);
          return i;
        }
        return i + 1;
      });
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {WELCOME_TEXT.slice(0, index)}
      {!done && <span className={styles.cursor}>|</span>}
    </>
  );
};

const STREAMING_TEXT_STYLE: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};
const THINK_TAG_PATTERN = /<\/?think>/gi;
const THINK_TAG_PREFIX_PATTERN = /<(?:\/)?t(?:h(?:i(?:n(?:k?)?)?)?)?$/i;
const AI_AVATAR_STYLE: React.CSSProperties = {
  background: "transparent",
  fontSize: 22,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginTop: "-2px",
};

const sanitizeThinkText = (content: string): string =>
  content.replace(THINK_TAG_PATTERN, "").replace(THINK_TAG_PREFIX_PATTERN, "");

const aiAvatarNode = <Avatar style={AI_AVATAR_STYLE}>🤖</Avatar>;

const ProgressiveMarkdown: React.FC<{
  content: string;
  isStreaming: boolean;
  charsPerSecond?: number;
}> = ({ content, isStreaming, charsPerSecond }) => {
  const [displayed, setDisplayed] = useState(content);
  const displayedRef = useRef(displayed);
  const lastFullRef = useRef(content);
  const targetRef = useRef(content);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    displayedRef.current = displayed;
  }, [displayed]);

  const stop = () => {
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const start = () => {
    if (rafRef.current != null) return;
    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      if (!isStreaming) {
        stop();
        return;
      }

      const target = targetRef.current;
      const current = displayedRef.current;

      if (!target.startsWith(current)) {
        setDisplayed(target);
        stop();
        return;
      }

      if (current.length >= target.length) {
        stop();
        return;
      }

      const elapsed = Math.max(0, now - lastTimeRef.current);
      lastTimeRef.current = now;
      const baseSpeed = charsPerSecond ?? 28;
      const backlog = Math.max(0, target.length - current.length);
      const speed = Math.min(120, baseSpeed + backlog * 0.25);
      const advance = Math.max(1, Math.floor((elapsed * speed) / 1000));
      const nextLength = Math.min(current.length + advance, target.length);
      const nextText = target.slice(0, nextLength);

      if (nextText !== current) {
        setDisplayed(nextText);
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
  };

  useEffect(() => {
    if (!isStreaming) {
      stop();
      setDisplayed(content);
      lastFullRef.current = content;
      targetRef.current = content;
      return;
    }

    if (!content.startsWith(lastFullRef.current)) {
      stop();
      setDisplayed(content);
      lastFullRef.current = content;
      targetRef.current = content;
      return;
    }

    lastFullRef.current = content;
    targetRef.current = content;

    if (displayedRef.current.length < content.length) {
      start();
    }

    return () => stop();
  }, [content, isStreaming]);

  return (
    <>
      {isStreaming ? (
        <span style={STREAMING_TEXT_STYLE}>{displayed}</span>
      ) : (
        <XMarkdown>{displayed}</XMarkdown>
      )}
    </>
  );
};

const roleConfig: BubbleListProps["role"] = {
  user: {
    placement: "end",
    avatar: <Avatar icon={<UserOutlined />} />,
    contentRender: (content: string) => {
      if (!content) return undefined;
      return <XMarkdown>{content}</XMarkdown>;
    },
  },
  ai: {
    placement: "start",
    avatar: aiAvatarNode,
    contentRender: (
      content: string,
      info: { status?: string; loading?: boolean },
    ) => {
      if (info?.loading || !content) return undefined;

      const isStreaming = info?.status === "updating";

      return (
        <ProgressiveMarkdown content={content} isStreaming={isStreaming} />
      );
    },
  },
};

const ChatbotPage: React.FC = () => {
  const { styles } = useStyles();

  // 禁用外层滚动，防止消息区滚动时页面抖动
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const [conversations, setConversations] = useState<ConversationItem[]>([
    { key: "default", label: "💬 新对话", group: "今天", isDraft: true },
  ]);
  const [messageMap, setMessageMap] = useState<Record<string, ChatMessage[]>>({
    default: [],
  });
  const [activeKey, setActiveKey] = useState<string>("default");
  const loadedKeysRef = useRef<Set<string>>(new Set(["default"]));

  // 加载磁盘上的真实会话列表
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const list: ConversationMeta[] = await fetchConversations();
        if (list.length === 0) return;

        const existing = new Map(conversations.map((c) => [c.key, c]));
        const loaded = new Set(loadedKeysRef.current);

        const merged: ConversationItem[] = [];
        list.forEach((item) => {
          if (existing.has(item.threadId)) {
            merged.push(existing.get(item.threadId)!);
            existing.delete(item.threadId);
          } else {
            merged.push({
              key: item.threadId,
              label: item.title,
              group: "历史会话",
              isDraft: false,
            });
          }
        });
        // 保留未在列表中的草稿
        existing.forEach((c) => {
          if (c.isDraft) merged.push(c);
        });

        setConversations(merged);
        loadedKeysRef.current = loaded;
      } catch {
        // 静默失败
      }
    };
    loadConversations();
  }, []);

  // 选中一个已存储的会话时，加载其历史消息
  useEffect(() => {
    const conv = conversations.find((c) => c.key === activeKey);
    if (!conv || conv.isDraft) return;
    if (loadedKeysRef.current.has(activeKey)) return;

    const loadMessages = async () => {
      try {
        const msgs = await fetchConversationMessages(activeKey);
        if (msgs.length === 0) return;

        const chatMessages: ChatMessage[] = msgs.map((m) => ({
          id: crypto.randomUUID(),
          role: m.role,
          content: m.content,
          thinkContent: m.thinkContent,
          status: "done" as const,
        }));

        setMessageMap((prev) => ({
          ...prev,
          [activeKey]: chatMessages,
        }));
        loadedKeysRef.current.add(activeKey);
      } catch {
        // 静默失败
      }
    };
    loadMessages();
  }, [activeKey, conversations]);
  const [inputValue, setInputValue] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const chunkQueueRef = useRef<ChatStreamChunk[]>([]);
  const flushFrameRef = useRef<number | null>(null);
  const flushTimerRef = useRef<number | null>(null);
  const flushResolversRef = useRef<Array<() => void>>([]);
  const isFlushingRef = useRef(false);
  const activeMessages = messageMap[activeKey] ?? [];

  const clearChunkFlush = () => {
    chunkQueueRef.current = [];
    isFlushingRef.current = false;

    if (flushTimerRef.current != null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (flushFrameRef.current != null) {
      window.cancelAnimationFrame(flushFrameRef.current);
      flushFrameRef.current = null;
    }
    flushResolversRef.current.forEach((resolve) => {
      resolve();
    });
    flushResolversRef.current = [];
  };

  const sendMessage = async (content: string) => {
    const question = content.trim();
    if (!question || isRequesting) return;

    const targetKey = activeKey;
    setInputValue("");
    setConversations((prev) =>
      prev.map((c) =>
        c.key === targetKey && c.isDraft
          ? { ...c, label: question.slice(0, 20), isDraft: false }
          : c,
      ),
    );

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: question,
      status: "done",
    };
    const assistantRequestId = crypto.randomUUID();

    setMessageMap((prev) => ({
      ...prev,
      [targetKey]: [
        ...(prev[targetKey] ?? []),
        userMessage,
        {
          id: "",
          requestId: assistantRequestId,
          role: "assistant",
          content: "",
          status: "updating",
        },
      ],
    }));

    const controller = new AbortController();
    abortRef.current = controller;
    setIsRequesting(true);

    try {
      clearChunkFlush();

      const applyChunk = (chunk: ChatStreamChunk) => {
        setMessageMap((prev) => ({
          ...prev,
          [targetKey]: (prev[targetKey] ?? []).map((message) =>
            message.requestId === assistantRequestId
              ? {
                  ...message,
                  id: chunk.id || message.id,
                  rawThinkContent:
                    chunk.thinkingContent != null
                      ? `${message.rawThinkContent ?? ""}${chunk.thinkingContent}`
                      : message.rawThinkContent,
                  thinkContent:
                    chunk.thinkingContent != null
                      ? sanitizeThinkText(
                          `${message.rawThinkContent ?? ""}${chunk.thinkingContent}`,
                        )
                      : message.thinkContent,
                  content:
                    chunk.content != null
                      ? `${message.content}${chunk.content}`
                      : message.content,
                  isThinking: chunk.isEnd
                    ? false
                    : typeof chunk.thinking === "boolean"
                      ? chunk.thinking
                      : message.isThinking,
                  status: chunk.isEnd ? "done" : "updating",
                }
              : message,
          ),
        }));
      };

      const scheduleFlush = () => {
        if (isFlushingRef.current) return;
        isFlushingRef.current = true;

        const flushNext = () => {
          if (chunkQueueRef.current.length === 0) {
            isFlushingRef.current = false;
            flushFrameRef.current = null;
            flushTimerRef.current = null;

            flushResolversRef.current.forEach((resolve) => {
              resolve();
            });
            flushResolversRef.current = [];
            return;
          }

          const nextChunk = chunkQueueRef.current.shift();
          if (nextChunk) {
            applyChunk(nextChunk);
          }

          flushFrameRef.current = window.requestAnimationFrame(() => {
            flushTimerRef.current = window.setTimeout(flushNext, 0);
          });
        };

        flushFrameRef.current = window.requestAnimationFrame(() => {
          flushTimerRef.current = window.setTimeout(flushNext, 0);
        });
      };

      const waitForFlushDone = () =>
        new Promise<void>((resolve) => {
          if (!isFlushingRef.current && chunkQueueRef.current.length === 0) {
            resolve();
            return;
          }
          flushResolversRef.current.push(resolve);
        });

      await streamChatCompletion(question, {
        signal: controller.signal,
        id: targetKey,
        onChunk: (chunk) => {
          chunkQueueRef.current.push(chunk);
          scheduleFlush();
        },
      });

      await waitForFlushDone();

      setMessageMap((prev) => ({
        ...prev,
        [targetKey]: (prev[targetKey] ?? []).map((message) =>
          message.requestId === assistantRequestId
            ? {
                ...message,
                isThinking: false,
                status: message.status === "error" ? "error" : "done",
              }
            : message,
        ),
      }));
    } catch (error) {
      const isAborted =
        error instanceof DOMException && error.name === "AbortError";

      setMessageMap((prev) => ({
        ...prev,
        [targetKey]: (prev[targetKey] ?? []).map((message) =>
          message.requestId === assistantRequestId
            ? {
                ...message,
                content:
                  message.content ||
                  (isAborted ? "已停止生成。" : "请求失败，请稍后重试。"),
                isThinking: false,
                status: isAborted ? "done" : "error",
              }
            : message,
        ),
      }));
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      clearChunkFlush();
      setIsRequesting(false);
    }
  };

  const newChat = () => {
    const key = crypto.randomUUID();
    setConversations((prev) => [
      { key, label: "新对话", group: "今天", isDraft: true },
      ...prev,
    ]);
    setMessageMap((prev) => ({ ...prev, [key]: [] }));
    setActiveKey(key);
  };

  const abort = () => {
    clearChunkFlush();
    abortRef.current?.abort();
  };

  const bubbleItems = useMemo<BubbleItemType[]>(
    () =>
      activeMessages.flatMap((message) => {
        const isAI = message.role === "assistant";
        const thinkContent = isAI ? message.thinkContent : undefined;
        const isUpdating = message.status === "updating";
        const hasVisibleContent = Boolean(
          message.content || thinkContent || message.isThinking,
        );

        const item: BubbleItemType = {
          key: message.requestId ?? message.id,
          role: isAI ? "ai" : "user",
          content: message.content,
          loading: isAI && isUpdating && !hasVisibleContent,
          status: isUpdating ? "updating" : undefined,
        };

        if (isAI && (thinkContent || message.isThinking)) {
          item.header = (
            <Think
              title={message.isThinking ? "思考中" : "已深度思考"}
              loading={message.isThinking}
              blink={message.isThinking}
              defaultExpanded
            >
              {thinkContent ? (
                <ProgressiveMarkdown
                  content={thinkContent}
                  isStreaming={Boolean(message.isThinking)}
                  charsPerSecond={60}
                />
              ) : (
                "正在整理思路..."
              )}
            </Think>
          );
        }

        return [item];
      }),
    [activeMessages],
  );

  const hasMessages = activeMessages.length > 0;

  return (
    <PageContainer
      ghost
      childrenContentStyle={{
        paddingBlock: 0,
        height: "calc(100vh - 160px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Card
        variant="borderless"
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        styles={{
          body: {
            flex: 1,
            padding: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        <XProvider>
          <div className={styles.layout}>
            <div className={styles.sidebar}>
              <Conversations
                items={conversations}
                activeKey={activeKey}
                onActiveChange={setActiveKey}
                groupable
                menu={(conversation) => ({
                  items: [{ key: "delete", label: "删除", danger: true }],
                  onClick: async ({ key }) => {
                    if (key === "delete") {
                      if (!conversation.isDraft) {
                        deleteConversation(conversation.key).catch(() => {});
                      }
                      setConversations((prev) => {
                        const next = prev.filter(
                          (c) => c.key !== conversation.key,
                        );
                        setMessageMap((prevMap) => {
                          const map = { ...prevMap };
                          delete map[conversation.key];
                          return map;
                        });

                        if (next.length === 0) {
                          const newKey = crypto.randomUUID();
                          next.push({
                            key: newKey,
                            label: "💬 新对话",
                            group: "今天",
                            isDraft: true,
                          });
                          setMessageMap((prevMap) => ({
                            ...prevMap,
                            [newKey]: [],
                          }));
                          setActiveKey(newKey);
                        } else if (activeKey === conversation.key) {
                          abort();
                          setActiveKey(next[0]?.key ?? "");
                        }
                        return next;
                      });
                    }
                  },
                })}
                creation={{ onClick: newChat, label: "新建对话" }}
              />
            </div>

            <div className={styles.main}>
              {hasMessages && (
                <div className={styles.messages}>
                  <Bubble.List
                    items={bubbleItems}
                    role={roleConfig}
                    autoScroll
                    styles={{ root: { maxWidth: 940 } }}
                  />
                </div>
              )}

              <div
                className={hasMessages ? styles.footer : styles.footerCenter}
              >
                {!hasMessages && (
                  <div className={styles.welcomeTitle}>
                    <TypewriterTitle />
                  </div>
                )}
                <Sender
                  value={inputValue}
                  onChange={setInputValue}
                  loading={isRequesting}
                  onSubmit={sendMessage}
                  onCancel={abort}
                  placeholder="输入消息，按 Enter 发送..."
                  autoSize={{ minRows: 4, maxRows: 8 }}
                  style={{ maxWidth: 940, width: "100%" }}
                  styles={{ input: { paddingBlock: 0 } }}
                />
              </div>
            </div>
          </div>
        </XProvider>
      </Card>
    </PageContainer>
  );
};

export default ChatbotPage;
