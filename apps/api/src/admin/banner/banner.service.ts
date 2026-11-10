import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, type Banner } from '@prisma/client';
import type { AdminBannerResponse, I18nText } from '@rental/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { badRequest } from '../../auth/api-errors';
import { writeAudit } from '../../bookings/audit';
import { publicFileUrl } from '../../catalog/public-url';
import type { AdminUser } from '../auth';
import { convertPhoto, deletePublic, writePublic, type RawUpload } from '../fleet/images';
import { actorOf, asBody, bool, has, i18nText, optI18nText, optStr } from '../fleet/input';

// Баннер главной Mini App (GET /home берёт последний активный): заголовок и текст на 3 языках, ссылка, изображение.

const toBanner = (b: Banner) => ({
  id: b.id,
  title: b.title as I18nText,
  text: (b.text as I18nText | null) ?? null,
  imageUrl: b.imageKey ? publicFileUrl(b.imageKey) : null,
  link: b.link,
  isActive: b.isActive,
  isDemo: b.isDemo,
});

@Injectable()
export class BannerService {
  constructor(private readonly prisma: PrismaService) {}

  private current() {
    return this.prisma.banner.findFirst({ orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }] });
  }

  async get(): Promise<AdminBannerResponse> {
    const b = await this.current();
    return { banner: b ? toBanner(b) : null };
  }

  async save(user: AdminUser, body: unknown): Promise<AdminBannerResponse> {
    const b = asBody(body);
    const d: Prisma.BannerUpdateInput = { title: i18nText(b.title, 'title', { max: 80 }) as Prisma.InputJsonObject };
    if (has(b, 'text')) {
      const t = optI18nText(b.text, 'text', { max: 200 });
      d.text = t === null ? Prisma.DbNull : (t as Prisma.InputJsonObject);
    }
    if (has(b, 'link')) {
      const link = optStr(b.link, 'link', 500);
      if (link && !/^(https:\/\/|\/|tg:\/\/)/.test(link)) throw badRequest('link must start with https://, / or tg://');
      d.link = link;
    }
    if (has(b, 'isActive')) d.isActive = bool(b.isActive, 'isActive');
    const cur = await this.current();
    const row = cur ? await this.prisma.banner.update({ where: { id: cur.id }, data: { ...d, isDemo: false } }) : await this.prisma.banner.create({ data: { ...(d as Prisma.BannerCreateInput), isDemo: false } });
    // Один баннер: остальные выключаются, чтобы /home не показал старый
    await this.prisma.banner.updateMany({ where: { id: { not: row.id } }, data: { isActive: false } });
    await writeAudit(this.prisma, actorOf(user), 'banner.update', 'Banner', row.id, { fields: Object.keys(d) });
    return { banner: toBanner(row) };
  }

  async image(user: AdminUser, upload: RawUpload): Promise<AdminBannerResponse> {
    const cur = await this.current();
    if (!cur) throw badRequest('Save the banner text first');
    const img = await convertPhoto(upload.body, [1200]);
    const key = `banners/${cur.id}/${Date.now().toString(36)}${randomBytes(3).toString('hex')}.webp`;
    await writePublic(key, img.sizes['1200']!.webp, 'image/webp');
    const row = await this.prisma.banner.update({ where: { id: cur.id }, data: { imageKey: key, isDemo: false } });
    if (cur.imageKey?.startsWith(`banners/${cur.id}/`)) await deletePublic(cur.imageKey);
    await writeAudit(this.prisma, actorOf(user), 'banner.image', 'Banner', cur.id, { key });
    return { banner: toBanner(row) };
  }
}
