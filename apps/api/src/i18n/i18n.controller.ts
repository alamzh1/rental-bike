import { Controller, Get, Param } from '@nestjs/common';
import { getDictionary, type ResourceTree } from '@rental/i18n';
import { LANGS, type Lang } from '@rental/shared';
import { PrismaService } from '../prisma/prisma.service';
import { badRequest } from '../auth/api-errors';

@Controller('i18n')
export class I18nController {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /i18n/{lang}: словарь из JSON packages/i18n с переопределениями из админки (I18nOverride) поверх. */
  @Get(':lang')
  async dictionary(@Param('lang') lang: string): Promise<ResourceTree> {
    if (!LANGS.includes(lang as Lang)) throw badRequest('lang must be ru, en or vi');
    const rows = await this.prisma.i18nOverride.findMany({ where: { lang: lang as Lang }, select: { key: true, value: true } });
    return getDictionary(lang as Lang, Object.fromEntries(rows.map((r) => [r.key, r.value])));
  }
}
