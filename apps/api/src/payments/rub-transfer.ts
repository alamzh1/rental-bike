import type { RubTransferSettings } from '@rental/shared';
import type { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 86_400_000;
/** Автоматический курс старше этого за деньги брать нельзя: источник мог давно отвалиться. */
const MAX_RATE_AGE_MS = 3 * DAY_MS;

export interface RubOffer extends RubTransferSettings {
  /** ₽ за 1 ₫ с наценкой */
  rubPerVnd: number;
}

/** Перевод в рублях доступен, когда заданы реквизиты и есть настоящий свежий курс: запасной курс из кода здесь не годится. */
export async function loadRubOffer(prisma: Pick<PrismaService, 'setting'>, now: Date): Promise<RubOffer | null> {
  const rows = await prisma.setting.findMany({ where: { key: { in: ['rubTransfer', 'rates'] } } });
  const value = (key: string) => rows.find((r) => r.key === key)?.value as Record<string, unknown> | null | undefined;
  const s = value('rubTransfer');
  const r = value('rates');
  if (!s || typeof s.phone !== 'string' || typeof s.bank !== 'string' || typeof s.recipient !== 'string') return null;
  if (!r || typeof r.RUB !== 'number' || !(r.RUB > 0) || typeof r.updatedAt !== 'string') return null;
  if (r.manual !== true && now.getTime() - new Date(r.updatedAt).getTime() > MAX_RATE_AGE_MS) return null;
  const markupPercent = typeof s.markupPercent === 'number' ? s.markupPercent : 0;
  return { phone: s.phone, bank: s.bank, recipient: s.recipient, markupPercent, rubPerVnd: r.RUB * (1 + markupPercent / 100) };
}
