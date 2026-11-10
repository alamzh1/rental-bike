import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminDeductionRow, AdminListOf, AdminPaymentList, AdminReconciliation, AdminRubTransferRow, PaymentDto } from '@rental/shared';
import { CurrentUser } from '../../auth/current-user.decorator';
import { Roles, RolesGuard } from '../../auth/roles';
import { AdminSessionGuard, type AdminUser } from '../auth';
import { AdminPaymentsService } from './admin-payments.service';

@ApiTags('admin')
@Controller('admin/payments')
@UseGuards(AdminSessionGuard, RolesGuard)
@Roles('OWNER', 'ADMIN')
export class AdminPaymentsController {
  constructor(private readonly payments: AdminPaymentsService) {}

  @Get()
  list(@CurrentUser() user: AdminUser, @Query() q: Record<string, unknown>): Promise<AdminPaymentList> {
    return this.payments.list(user, q);
  }

  @Get('reconciliation')
  reconciliation(@CurrentUser() user: AdminUser, @Query() q: Record<string, unknown>): Promise<AdminReconciliation> {
    return this.payments.reconciliation(user, q);
  }

  @Get('deductions')
  deductions(@CurrentUser() user: AdminUser): Promise<AdminListOf<AdminDeductionRow>> {
    return this.payments.deductions(user);
  }

  /** Переводы в рублях идут на реквизиты платформы, поэтому подтверждает только администратор. */
  @Get('rub-transfers')
  @Roles('ADMIN')
  rubTransfers(): Promise<AdminListOf<AdminRubTransferRow>> {
    return this.payments.rubTransfers();
  }

  @Post(':id/rub-confirm')
  @HttpCode(204)
  @Roles('ADMIN')
  async rubConfirm(@CurrentUser() user: AdminUser, @Param('id') id: string): Promise<void> {
    await this.payments.confirmRub(user, id);
  }

  @Post(':id/rub-reject')
  @HttpCode(204)
  @Roles('ADMIN')
  async rubReject(@CurrentUser() user: AdminUser, @Param('id') id: string): Promise<void> {
    await this.payments.rejectRub(user, id);
  }

  /** `{ amount?, comment? }` */
  @Post(':id/refund')
  refund(@CurrentUser() user: AdminUser, @Param('id') id: string, @Body() body: unknown): Promise<PaymentDto> {
    return this.payments.refund(user, id, body);
  }
}
