import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  message,
  Row,
  Select,
  Space,
  Spin,
  Switch,
} from 'antd';
import { useCallback, useEffect, useState } from 'react';
import {
  type AgentDto,
  createAgent,
  deleteAgent,
  getAgents as fetchAgents,
  updateAgent,
} from '@/services/api/agents';
import { getModels, type ModelDto } from '@/services/api/models';
import { getTools, type ToolDto } from '@/services/api/tools';

const { TextArea } = Input;

const AgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<AgentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [renaming, setRenaming] = useState<Record<string, string>>({});
  const [enabledTools, setEnabledTools] = useState<ToolDto[]>([]);
  const [enabledModels, setEnabledModels] = useState<ModelDto[]>([]);
  // 追踪已持久化到后端的 agent 名称集合，用于保存时判断 POST vs PUT
  const [persistedNames, setPersistedNames] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      const [agentsData, toolsData, modelsData] = await Promise.all([
        fetchAgents(),
        getTools(),
        getModels(),
      ]);
      setAgents(agentsData);
      setEnabledTools(toolsData.filter((t) => t.active === 1));
      setEnabledModels(modelsData.filter((m) => m.active === 1));
      setPersistedNames(new Set(agentsData.map((a) => a.name)));
    } catch {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 仅本地添加空白卡片
  const handleAdd = () => {
    const newAgent: AgentDto = {
      name: '',
      model: '',
      description: '',
      systemPrompt: '',
      tools: [],
      active: 1,
    };
    setAgents([newAgent, ...agents]);
  };

  const handleDelete = (name: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除智能体「${name}」吗？此操作不可撤销。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteAgent(name);
          message.success('已删除');
          await loadData();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  // 保存时判断：如果后端已存在则用 PUT 更新，否则用 POST 创建
  const handleSave = async (name: string) => {
    const agent = agents.find((a) => a.name === name);
    if (!agent) return;
    if (!agent.model) {
      message.error('绑定模型不能为空');
      return;
    }
    if (!agent.description) {
      message.error('描述不能为空');
      return;
    }
    if (!agent.systemPrompt) {
      message.error('系统提示词不能为空');
      return;
    }

    setSaving((prev) => ({ ...prev, [name]: true }));
    try {
      if (persistedNames.has(name)) {
        await updateAgent(name, agent);
        message.success('保存成功');
      } else {
        await createAgent(agent);
        message.success('创建成功');
      }
      await loadData();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving((prev) => ({ ...prev, [name]: false }));
    }
  };

  const handleChange = (name: string, field: string, value: unknown) => {
    setAgents(
      agents.map((a) => (a.name === name ? { ...a, [field]: value } : a)),
    );
  };

  if (loading) {
    return (
      <PageContainer>
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Spin size="large" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      header={{
        title: 'Agents',
        subTitle: '智能体管理，创建和配置你的 AI Agent',
        extra: (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增 Agent
          </Button>
        ),
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {agents.map((agent) => {
          const displayName = renaming[agent.name] ?? agent.name;
          const isSaving = saving[agent.name] ?? false;
          return (
            <Card
              key={agent.name}
              title={`智能体: ${displayName || '未命名'}`}
              extra={
                <Space>
                  <Switch
                    checked={agent.active === 1}
                    onChange={(v) =>
                      handleChange(agent.name, 'active', v ? 1 : 0)
                    }
                    checkedChildren="启用"
                    unCheckedChildren="禁用"
                  />
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={() => handleSave(agent.name)}
                    loading={isSaving}
                  >
                    保存
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(agent.name)}
                  >
                    删除
                  </Button>
                </Space>
              }
            >
              <Form layout="vertical">
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item label="智能体名称" required>
                      <Input
                        value={renaming[agent.name] ?? agent.name}
                        onChange={(e) =>
                          setRenaming((prev) => ({
                            ...prev,
                            [agent.name]: e.target.value,
                          }))
                        }
                        onBlur={() => {
                          const newName = renaming[agent.name]?.trim();
                          if (newName && newName !== agent.name) {
                            if (agents.some((a) => a.name === newName)) {
                              message.error('智能体名称已存在');
                              setRenaming((prev) => {
                                const { [agent.name]: _, ...rest } = prev;
                                return rest;
                              });
                              return;
                            }
                            setAgents(
                              agents.map((a) =>
                                a.name === agent.name
                                  ? { ...a, name: newName }
                                  : a,
                              ),
                            );
                            setRenaming((prev) => {
                              const { [agent.name]: _, ...rest } = prev;
                              return rest;
                            });
                          }
                        }}
                        placeholder="例如：客服助手"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="绑定模型" required>
                      <Select
                        value={agent.model || undefined}
                        onChange={(v) => handleChange(agent.name, 'model', v)}
                        placeholder="选择模型"
                        options={enabledModels.map((m) => ({
                          value: m.name,
                          label: m.name,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item label="描述" required>
                      <TextArea
                        value={agent.description}
                        onChange={(e) =>
                          handleChange(
                            agent.name,
                            'description',
                            e.target.value,
                          )
                        }
                        placeholder="描述这个智能体的用途"
                        rows={4}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="绑定工具">
                      <Select
                        mode="multiple"
                        value={agent.tools}
                        onChange={(v) => handleChange(agent.name, 'tools', v)}
                        placeholder="选择工具"
                        options={enabledTools.map((t) => ({
                          value: t.name,
                          label: t.name,
                        }))}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={24}>
                  <Col span={24}>
                    <Form.Item label="系统提示词" required>
                      <TextArea
                        value={agent.systemPrompt}
                        onChange={(e) =>
                          handleChange(
                            agent.name,
                            'systemPrompt',
                            e.target.value,
                          )
                        }
                        placeholder="你是一个..."
                        rows={4}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Card>
          );
        })}
      </Space>
    </PageContainer>
  );
};

export default AgentsPage;
