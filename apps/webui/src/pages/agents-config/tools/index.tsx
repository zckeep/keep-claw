import { SearchOutlined, ToolOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { Card, Col, Input, message, Row, Space, Spin, Switch, Tag } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { getTools, type ToolDto, updateTool } from '@/services/api/tools';

const { Search } = Input;

const ToolsPage: React.FC = () => {
  const [tools, setTools] = useState<ToolDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState('');

  const loadTools = useCallback(async () => {
    try {
      const data = await getTools();
      setTools(data);
    } catch {
      message.error('加载工具列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  const handleToggleActive = async (tool: ToolDto) => {
    setToggling((prev) => ({ ...prev, [tool.name]: true }));
    const nextActive = (tool.active === 0 ? 1 : 0) as 0 | 1;
    try {
      await updateTool(tool.name, { ...tool, active: nextActive });
      setTools((prev) =>
        prev.map((t) =>
          t.name === tool.name ? { ...t, active: nextActive } : t,
        ),
      );
    } catch {
      message.error('切换状态失败');
    } finally {
      setToggling((prev) => ({ ...prev, [tool.name]: false }));
    }
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

  const filteredTools = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(filter.toLowerCase()) ||
      t.description.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <PageContainer
      header={{
        title: 'Tools',
        subTitle: '工具/技能管理，开启或关闭 Agent 的能力',
      }}
    >
      <Card>
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
          <Space>
            <Search
              placeholder="搜索工具..."
              prefix={<SearchOutlined />}
              style={{ width: 300 }}
              onChange={(e) => setFilter(e.target.value)}
            />
            <Tag color="blue">
              已启用: {tools.filter((t) => t.active === 1).length}
            </Tag>
            <Tag color="green">
              内置工具: {tools.filter((t) => t.builtin === 1).length}
            </Tag>
          </Space>
        </Space>

        <Row gutter={[16, 16]}>
          {filteredTools.map((tool) => (
            <Col span={8} key={tool.name}>
              <Card hoverable style={{ opacity: tool.active === 1 ? 1 : 0.6 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <ToolOutlined style={{ fontSize: 20 }} />
                    <strong>{tool.name}</strong>
                    {tool.builtin === 1 && <Tag color="green">内置</Tag>}
                  </Space>
                  <p
                    style={{
                      color: '#666',
                      margin: 0,
                      fontSize: 13,
                      minHeight: 40,
                    }}
                  >
                    {tool.description}
                  </p>
                  <Space>
                    <span style={{ fontSize: 13 }}>启用:</span>
                    <Switch
                      checked={tool.active === 1}
                      loading={toggling[tool.name]}
                      onChange={() => handleToggleActive(tool)}
                      size="small"
                      checkedChildren="开"
                      unCheckedChildren="关"
                    />
                  </Space>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </PageContainer>
  );
};

export default ToolsPage;
