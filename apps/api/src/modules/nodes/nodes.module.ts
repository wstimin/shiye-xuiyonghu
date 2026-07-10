import { Module } from '@nestjs/common';
import { XuiModule } from '../xui/xui.module.js';
import { NodesController } from './nodes.controller.js';
import { NodesService } from './nodes.service.js';

@Module({ imports: [XuiModule], controllers: [NodesController], providers: [NodesService], exports: [NodesService] })
export class NodesModule {}
