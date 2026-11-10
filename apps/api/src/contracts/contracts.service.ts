import { Injectable, Logger } from '@nestjs/common';
import { formatDate, formatPrice, formatTime, initI18n, pickText } from '@rental/i18n';
import { rentalDays, type I18nText, type Lang } from '@rental/shared';
import { notFound } from '../auth/api-errors';
import { PrismaService } from '../prisma/prisma.service';
import { findMissingGlyphs, renderContractPdf, type ContractSection } from './contract-pdf';

/** Договор аренды в PDF: язык клиента + вьетнамская версия (если язык клиента не vi). Текст условий — Setting `contractTemplate`. */
@Injectable()
export class ContractsService {
  private readonly log = new Logger('Contracts');

  constructor(private readonly prisma: PrismaService) {}

  async render(bookingId: string, lang: Lang): Promise<Buffer> {
    const b = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { user: true, model: { select: { name: true } }, bike: { select: { plate: true } }, location: true },
    });
    if (!b) throw notFound('Booking not found');
    const settings = await this.prisma.setting.findMany({ where: { key: { in: ['contractTemplate', 'late'] } } });
    const template = (settings.find((s) => s.key === 'contractTemplate')?.value ?? { en: '' }) as unknown as I18nText;
    const late = (settings.find((s) => s.key === 'late')?.value ?? {}) as { graceMinutes?: number; hourlyFee?: number };
    const tz = b.location.timezone;
    const days = ((b.quote as { days?: number } | null)?.days ?? rentalDays(b.startAt, b.endAt)) || 1;

    const section = (l: Lang): ContractSection => {
      const i18n = initI18n(l);
      const t = i18n.t.bind(i18n);
      const when = (d: Date) => `${formatDate(d, l, tz)} ${formatTime(d, l, tz)}`;
      const name = [b.user.firstName, b.user.lastName].filter(Boolean).join(' ') || b.user.username || b.user.telegramId;
      const p = (text: string, bold = false) => ({ text, bold });
      const paragraphs = [
        p(t('contract.number', { code: b.code })),
        p(t('contract.parties'), true),
        p(`${t('contract.lessor')}: ${b.location.legalName ?? t('contract.lessorPlaceholder')}`),
        p(t('contract.location', { address: b.location.address })),
        p(t('contract.client'), true),
        p(t('contract.clientName', { name })),
        p(t('contract.clientPhone', { phone: b.phone ?? b.user.phone ?? '-' })),
        ...(b.user.username ? [p(t('contract.clientTelegram', { username: `@${b.user.username}` }))] : []),
        p(t('contract.subject'), true),
        p(t('contract.bike', { model: b.model.name, plate: b.bike.plate })),
        p(t('contract.period', { start: when(b.startAt), end: when(b.endAt), days })),
        p(t('contract.pricing'), true),
        p(t('contract.rent', { amount: formatPrice(b.rentAmount, l) })),
        p(t('contract.extras', { amount: formatPrice(b.extrasAmount + b.deliveryAmount, l) })),
        p(t('contract.total', { amount: formatPrice(b.totalAmount, l) })),
        p(t('contract.deposit', { amount: formatPrice(b.depositAmount, l) })),
        p(t('contract.lateFee', { graceMinutes: late.graceMinutes ?? 60, hourlyFee: formatPrice(late.hourlyFee ?? 0, l) })),
        p(t('contract.terms'), true),
        p(pickText(template, l)),
        p(b.agreedAt ? t('contract.agreed', { agreedAt: when(b.agreedAt) }) : t('contract.notAgreed')),
        p(t('contract.signatureLessor')),
        p(t('contract.signatureClient')),
      ];
      return { title: t('contract.title'), paragraphs };
    };

    const sections = [section(lang), ...(lang === 'vi' ? [] : [section('vi')])];
    const missing = findMissingGlyphs(sections.flatMap((s) => [s.title, ...s.paragraphs.map((x) => x.text)]).join(''));
    if (missing.length) this.log.warn(`В шрифте договора нет символов: ${missing.join(' ')}`);
    return renderContractPdf(sections);
  }
}
