import { Module } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { ToolsController } from './tools.controller';
import { ConfigFileService } from '../config/config-file.service';
@Module({
  controllers: [ToolsController],
  providers: [ToolsService, ConfigFileService],
})
export class ToolsModule {}
