// Типы API модуля `documents`: загрузка документов клиента в приватное хранилище по подписанной ссылке.

export type DocumentType = 'PASSPORT' | 'LICENSE' | 'IDP';
export type DocumentStatus = 'UPLOADED' | 'VERIFIED' | 'REJECTED';

/** Типы файлов документов и максимальный размер загрузки. */
export const DOCUMENT_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'] as const;
export type DocumentContentType = (typeof DOCUMENT_CONTENT_TYPES)[number];
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/** 400 CONSENT_REQUIRED — первая загрузка без согласия на обработку персональных данных. */
export const DOCUMENT_ERROR_CODES = ['CONSENT_REQUIRED', 'DOCUMENT_LIMIT'] as const;

/** Сколько документов может хранить один клиент: хватает на паспорт, права и пересъёмку. */
export const MAX_DOCUMENTS_PER_USER = 10;

/** Без этих фото бронь не создаётся. LICENSE закрывается и правами, и IDP; при категории «Нет прав» нужен только паспорт. */
/** Без прав — только до этого объёма. */
export const NO_LICENSE_MAX_CC = 50;

/**
 * Можно ли брать модель: с правами любую; без прав до 50 см³. Электробайк объёма не имеет: он считается требующим прав,
 * пока администратор не укажет у модели «права не нужны».
 */
export function licenseAllows(model: { engineCc: number | null; licenseRequired: 'A1' | 'A' | 'NONE' }, licenseCategory: 'A1' | 'A' | 'NONE' | null | undefined): boolean {
  if (licenseCategory !== 'NONE') return true;
  return model.licenseRequired === 'NONE' || (model.engineCc !== null && model.engineCc <= NO_LICENSE_MAX_CC);
}

export type RequiredDocument = 'PASSPORT' | 'LICENSE';

export function missingDocuments(docs: readonly { type: DocumentType; status: DocumentStatus }[], licenseCategory: 'A1' | 'A' | 'NONE' | null | undefined): RequiredDocument[] {
  const has = (...types: DocumentType[]) => docs.some((d) => types.includes(d.type) && d.status !== 'REJECTED');
  const missing: RequiredDocument[] = [];
  if (!has('PASSPORT')) missing.push('PASSPORT');
  if (licenseCategory !== 'NONE' && !has('LICENSE', 'IDP')) missing.push('LICENSE');
  return missing;
}

/**
 * POST /documents. `consent: true` обязателен, пока пользователь не давал согласия (при первой загрузке).
 * `licenseCategory` — для прав (LICENSE/IDP).
 */
export interface CreateDocumentRequest {
  type: DocumentType;
  contentType: DocumentContentType;
  consent?: boolean;
  licenseCategory?: 'A1' | 'A' | 'NONE';
}

/** Загрузка: `PUT uploadUrl` с телом файла и заголовками `headers` до `expiresAt`. */
export interface CreateDocumentResponse {
  documentId: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

export interface DocumentDto {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  contentType: string | null;
  licenseCategory: 'A1' | 'A' | 'NONE' | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface DocumentListResponse {
  items: DocumentDto[];
  /** Пользователь уже дал согласие на обработку ПД */
  consentGiven: boolean;
}

/** GET /documents/{id}/url — только менеджер и администратор; ссылка живёт ≤ 600 с. */
export interface DocumentUrlResponse {
  url: string;
  expiresAt: string;
}
