export class RecordError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'RecordError';
    this.code = code;
    this.details = details;
  }
}

export const ERR = Object.freeze({
  SRC_UNSUPPORTED: 'REC-SRC-001',
  SRC_DECODE: 'REC-SRC-002',
  SRC_TOO_LARGE: 'REC-SRC-003',
  SRC_TOO_MANY_PIXELS: 'REC-SRC-004',
  SRC_GAME_LIMIT: 'REC-SRC-005',
  SRC_MIME_MISMATCH: 'REC-SRC-006',
  DB_QUOTA: 'REC-DB-001',
  DB_BLOCKED: 'REC-DB-002',
  DB_SCHEMA: 'REC-DB-003',
  DB_CONFLICT: 'REC-DB-004',
  DB_MIGRATION: 'REC-DB-005',
  VIS_GATEWAY: 'REC-VIS-001',
  VIS_TIMEOUT: 'REC-VIS-002',
  VIS_SCHEMA: 'REC-VIS-003',
  VIS_DIGEST: 'REC-VIS-004',
  VIS_AUTH: 'REC-VIS-005',
  VIS_ORIGIN: 'REC-VIS-006',
  VIS_STALE: 'REC-VIS-007',
  VIS_BINDING: 'REC-VIS-008',
  CERT_CANONICAL: 'REC-CERT-001',
  CERT_SOURCE: 'REC-CERT-002',
  CERT_REVISION: 'REC-CERT-003',
  CERT_INVALID: 'REC-CERT-004',
  CERT_OBSERVATION: 'REC-CERT-005',
  CERT_REVIEW: 'REC-CERT-006',
  REC_NO_PATH: 'REC-RECON-001',
  REC_AMBIGUOUS: 'REC-RECON-002',
  REC_STALE: 'REC-RECON-003',
  EXP_CAPSULE: 'REC-EXP-001',
  EXP_BACKUP: 'REC-EXP-002',
  IMP_ARCHIVE: 'REC-IMP-001',
  IMP_CONFLICT: 'REC-IMP-002',
  FEN_INVALID: 'REC-FEN-001',
  GAME_INVALID: 'REC-GAME-001',
});

export function isQuotaError(error) {
  return error?.name === 'QuotaExceededError' || /quota/i.test(error?.message || '');
}

export function toRecordError(error, fallbackCode = 'REC-UNK-001') {
  if (error instanceof RecordError) return error;
  if (isQuotaError(error)) return new RecordError(ERR.DB_QUOTA, 'Browser storage quota was exceeded.', { cause: String(error) });
  return new RecordError(fallbackCode, error?.message || String(error), { cause: String(error) });
}
