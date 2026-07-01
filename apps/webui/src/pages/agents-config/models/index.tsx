import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
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
  createModel,
  deleteModel,
  getModels as fetchModels,
  type ModelDto,
  updateModel,
} from '@/services/api/models';

const ModelsPage: React.FC = () => {
  const [models, setModels] = useState<ModelDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [renaming, setRenaming] = useState<Record<string, string>>({});
  const [persistedNames, setPersistedNames] = useState<Set<string>>(new Set());

  const loadModels = useCallback(async () => {
    try {
      const data = await fetchModels();
      setModels(data);
      setPersistedNames(new Set(data.map((m) => m.name)));
    } catch {
      message.error('加载模型列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleAdd = () => {
    const newModel: ModelDto = {
      name: '',
      provider: '',
      active: 1,
      id: '',
      base_url: '',
      api_key: '',
      use_env_api_key: 0,
      temperature: 0.7,
    };
    setModels([newModel, ...models]);
  };

  const handleDelete = (name: string) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除模型「${name}」吗？此操作不可撤销。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteModel(name);
          message.success('已删除');
          await loadModels();
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const handleSave = async (name: string) => {
    const model = models.find((m) => m.name === name);
    if (!model) return;
    if (!model.name) {
      message.error('模型名称不能为空');
      return;
    }
    if (!model.provider) {
      message.error('供应商不能为空');
      return;
    }
    if (!model.id) {
      message.error('模型ID不能为空');
      return;
    }
    if (!model.base_url) {
      message.error('Base URL不能为空');
      return;
    }
    if (model.api_key === undefined || model.api_key === null) {
      message.error('API Key不能为空');
      return;
    }
    if (model.temperature === undefined || model.temperature === null) {
      message.error('Temperature不能为空');
      return;
    }

    setSaving((prev) => ({ ...prev, [name]: true }));
    try {
      if (persistedNames.has(name)) {
        await updateModel(name, model);
        message.success('保存成功');
      } else {
        await createModel(model);
        message.success('创建成功');
      }
      await loadModels();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving((prev) => ({ ...prev, [name]: false }));
    }
  };

  const handleChange = (name: string, field: string, value: unknown) => {
    setModels(
      models.map((m) => (m.name === name ? { ...m, [field]: value } : m)),
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
        title: 'Models',
        subTitle: '大模型配置管理',
        extra: (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增模型
          </Button>
        ),
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {models.map((model) => {
          const displayName = renaming[model.name] ?? model.name;
          const isSaving = saving[model.name] ?? false;
          return (
            <Card
              key={model.name}
              title={`模型: ${displayName || '未命名'}`}
              extra={
                <Space>
                  <Switch
                    checked={model.active === 1}
                    onChange={(v) =>
                      handleChange(model.name, 'active', v ? 1 : 0)
                    }
                    checkedChildren="启用"
                    unCheckedChildren="禁用"
                  />
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={() => handleSave(model.name)}
                    loading={isSaving}
                  >
                    保存
                  </Button>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(model.name)}
                  >
                    删除
                  </Button>
                </Space>
              }
            >
              <Form layout="vertical">
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item label="模型名称" required>
                      <Input
                        value={renaming[model.name] ?? model.name}
                        onChange={(e) =>
                          setRenaming((prev) => ({
                            ...prev,
                            [model.name]: e.target.value,
                          }))
                        }
                        onBlur={() => {
                          const newName = renaming[model.name]?.trim();
                          if (newName && newName !== model.name) {
                            if (models.some((m) => m.name === newName)) {
                              message.error('模型名称已存在');
                              setRenaming((prev) => {
                                const { [model.name]: _, ...rest } = prev;
                                return rest;
                              });
                              return;
                            }
                            setModels(
                              models.map((m) =>
                                m.name === model.name
                                  ? { ...m, name: newName }
                                  : m,
                              ),
                            );
                            setRenaming((prev) => {
                              const { [model.name]: _, ...rest } = prev;
                              return rest;
                            });
                          }
                        }}
                        placeholder="例如：GPT-4"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="供应商" required>
                      <Select
                        value={model.provider || undefined}
                        onChange={(v) =>
                          handleChange(model.name, 'provider', v)
                        }
                        placeholder="选择供应商"
                        options={[
                          { value: 'openai', label: 'OpenAI' },
                          { value: 'anthropic', label: 'Anthropic' },
                          { value: 'qwen', label: '通义千问' },
                          { value: 'zhipu', label: '智谱 AI' },
                          { value: 'custom', label: '自定义' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item label="模型ID" required>
                      <Input
                        value={model.id}
                        onChange={(e) =>
                          handleChange(model.name, 'id', e.target.value)
                        }
                        placeholder="例如：gpt-4"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Base URL" required>
                      <Input
                        value={model.base_url}
                        onChange={(e) =>
                          handleChange(model.name, 'base_url', e.target.value)
                        }
                        placeholder="https://api.openai.com/v1"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label="API Key"
                      required={model.use_env_api_key !== 1}
                    >
                      <Input.Password
                        value={model.api_key}
                        onChange={(e) =>
                          handleChange(model.name, 'api_key', e.target.value)
                        }
                        placeholder="sk-..."
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Temperature" required>
                      <InputNumber
                        value={model.temperature}
                        onChange={(v) =>
                          handleChange(model.name, 'temperature', v)
                        }
                        min={0}
                        max={2}
                        step={0.1}
                        style={{ width: '100%' }}
                        placeholder="0.0 - 2.0"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item label="使用环境变量 API Key">
                      <Switch
                        checked={model.use_env_api_key === 1}
                        onChange={(v) =>
                          handleChange(model.name, 'use_env_api_key', v ? 1 : 0)
                        }
                        checkedChildren="是"
                        unCheckedChildren="否"
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

export default ModelsPage;
