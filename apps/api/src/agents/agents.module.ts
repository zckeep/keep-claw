import { Module } from '@nestjs/common';
import { AgentsController } from './agents.controller.js';
import { AgentsService } from './agents.service.js';
import { ConfigFileService } from '../config/config-file.service.js';

@Module({
  controllers: [AgentsController],
  providers: [AgentsService, ConfigFileService],
  exports: [AgentsService],
})
export class AgentsModule {}
