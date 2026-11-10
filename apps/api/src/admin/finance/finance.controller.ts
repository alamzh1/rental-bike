import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminExpense, AdminFinanceSummary, AdminListOf } from '@rental/shared';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles, RolesGuard } from '../../auth/roles';
import { AdminSessionGuard, type AdminUser } from '../auth';
import { FinanceService } from './finance.service';

@ApiTags('admin')
@Controller('admin/finance')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
export class AdminFinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('summary')
  summary(@CurrentUser() user: AdminUser, @Query() q: Record<string, unknown>): Promise<AdminFinanceSummary> {
    return this.finance.summary(user, q);
  }

  @Get('expenses')
  expenses(@CurrentUser() user: AdminUser, @Query() q: Record<string, unknown>): Promise<AdminListOf<AdminExpense>> {
    return this.finance.expenses(user, q);
  }

  @Post('expenses')
  create(@CurrentUser() user: AdminUser, @Body() body: unknown): Promise<AdminExpense> {
    return this.finance.createExpense(user, body);
  }

  @Patch('expenses/:id')
  update(@CurrentUser() user: AdminUser, @Param('id') id: string, @Body() body: unknown): Promise<AdminExpense> {
    return this.finance.updateExpense(user, id, body);
  }

  @Delete('expenses/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AdminUser, @Param('id') id: string): Promise<void> {
    return this.finance.deleteExpense(user, id);
  }
}
