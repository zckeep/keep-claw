import { Module } from '@nestjs/common';
import { ModelsService } from './models.service';
import { ModelsController } from './models.controller';
import { ModelsLangchainController } from './models.langchain.controller';
import { ConfigFileService } from '../config/config-file.service';

@Module({
  providers: [ModelsService, ConfigFileService],
  controllers: [ModelsController, ModelsLangchainController],
})
export class ModelsModule {}
