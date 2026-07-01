import {
  MessageOutlined,
  RobotOutlined,
  SettingOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Button, Card, Col, Row, Typography } from 'antd';
import React from 'react';

const { Title, Paragraph } = Typography;

const features = [
  {
    icon: <RobotOutlined style={{ fontSize: 32, color: '#1677ff' }} />,
    title: 'Agents 配置',
    desc: '创建和管理 AI 智能体，自定义名称、模型、系统提示词等参数，灵活配置每个 Agent 的行为和能力。',
    path: '/agents-config/agents',
  },
  {
    icon: <SettingOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
    title: 'Models 管理',
    desc: '集中管理 AI 模型配置，支持多个模型提供商，统一配置 API Key 和接口参数。',
    path: '/agents-config/models',
  },
  {
    icon: <ToolOutlined style={{ fontSize: 32, color: '#fa8c16' }} />,
    title: 'Tools 工具',
    desc: '配置和管理 Agent 可使用的工具集，灵活控制每个工具的启用状态，工具与 Agent 联动绑定。',
    path: '/agents-config/tools',
  },
  {
    icon: <MessageOutlined style={{ fontSize: 32, color: '#722ed1' }} />,
    title: 'AI 助手',
    desc: '在线与 AI 智能体对话，实时测试和验证 Agent 配置效果，支持多轮对话。',
    path: '/chatbot',
  },
];

const Welcome: React.FC = () => {
  return (
    <PageContainer title="欢迎使用 keepClaw">
      <div className="flex flex-col gap-6">
        <Card>
          <Title level={3}>关于 keepClaw</Title>
          <Paragraph style={{ fontSize: 15, lineHeight: 2 }}>
            keepClaw 是一个 AI
            智能体配置管理平台，旨在帮助你轻松创建、管理和使用 AI
            智能体（Agent）。 你可以在这里配置 Agent 的系统提示词、绑定 AI
            模型、挂载工具集，并通过内置的 AI 助手在线测试 Agent 效果。
          </Paragraph>
          <Paragraph style={{ fontSize: 15, lineHeight: 2 }}>
            平台采用卡片式配置界面，支持在卡片内直接编辑所有字段，操作直观高效。
            所有配置自动保存到本地，无需复杂的部署流程。
          </Paragraph>
        </Card>

        <Row gutter={[16, 16]}>
          {features.map((item) => (
            <Col xs={24} sm={12} lg={6} key={item.title}>
              <Card
                hoverable
                style={{ height: '100%' }}
                onClick={() => history.push(item.path)}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: 12,
                  }}
                >
                  {item.icon}
                  <Title level={5} style={{ margin: 0 }}>
                    {item.title}
                  </Title>
                  <Paragraph
                    type="secondary"
                    style={{ fontSize: 13, margin: 0 }}
                  >
                    {item.desc}
                  </Paragraph>
                  <Button type="primary" size="small">
                    前往体验
                  </Button>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </PageContainer>
  );
};

export default Welcome;
