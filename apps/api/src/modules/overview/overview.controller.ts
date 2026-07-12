import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../shared/auth.guard.js';
import { Roles } from '../../shared/roles.decorator.js';
import { OverviewService } from './overview.service.js';

@Controller()
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get('admin/overview')
  @UseGuards(AuthGuard)
  @Roles('admin')
  adminOverview() {
    return this.overview.adminOverview();
  }
}
