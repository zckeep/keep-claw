import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AgentsModule } from './agents/agents.module.js';
import { ModelsModule } from './models/models.module';
import { ToolsModule } from './tools/tools.module';

@Module({
  imports: [AgentsModule, ModelsModule, ToolsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
