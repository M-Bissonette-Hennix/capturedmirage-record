export const APP = Object.freeze({
  name: 'RECORD',
  version: '0.3.2',
  release: 'RECONSTRUCTION / INTEGRITY',
  dbName: 'record-chess',
  legacyDbName: 'record-foundation',
  dbVersion: 3,
  cachePrefix: 'record::',
  cacheName: 'record::shell::0.3.2',
  gameSchema: 'record-game/3',
  sourceSchema: 'record-source-page/3',
  derivedSchema: 'record-derived-asset/2',
  recognitionJobSchema: 'record-recognition-job/2',
  recognitionEnvelopeSchema: 'record-recognition-envelope/3',
  reconstructionSchema: 'record-reconstruction-run/1',
  auditSchema: 'record-audit-event/2',
  backupSchema: 'record-backup/3',
  capsuleSchema: 'record-capsule-manifest/3',
  preprocessorVersion: 'record-preprocess/3',
  gatewayProtocol: 'record-gateway/3',
});

export const LIMITS = Object.freeze({
  sourceFileBytes: 20 * 1024 * 1024,
  sourcePixels: 18_000_000,
  processingPixels: 8_000_000,
  pagesPerGame: 10,
  sourceBytesPerGame: 80 * 1024 * 1024,
  imageMinDimension: 320,
  imageMaxAspect: 5,
  derivedLongEdge: 2200,
  thumbnailLongEdge: 420,
  backupArchiveBytes: 96 * 1024 * 1024,
  capsuleArchiveBytes: 64 * 1024 * 1024,
  archiveFiles: 5000,
  archivePathLength: 240,
  recognitionCells: 240,
  recognitionCandidatesPerCell: 8,
  recognitionTextLength: 64,
  metadataObservationLength: 200,
  gatewayBodyBytes: 8 * 1024 * 1024,
  providerResponseBytes: 2 * 1024 * 1024,
  reconstructionBeamWidth: 32,
  reconstructionCandidatesPerPly: 12,
  reconstructionPathsStored: 8,
  staleRecognitionMs: 90_000,
  runtimeConfigMaxAgeMs: 24 * 60 * 60 * 1000,
});

// WebP is intentionally excluded from v0.3 evidentiary intake until animation
// handling is explicitly commissioned. JPEG and PNG are byte-sniffed.
export const ALLOWED_SOURCE_MIME = new Set(['image/jpeg', 'image/png']);

export const WORKFLOW_STATES = new Set([
  'NEW',
  'CAPTURED',
  'VISION_PENDING',
  'OBSERVATIONS_AVAILABLE',
  'RECONSTRUCTION_PENDING',
  'RECONSTRUCTION_AVAILABLE',
  'EDITING',
  'READY_FOR_REVIEW',
  'COMPLETE',
  'EXPORTED',
]);

export const RECORD_TYPES = new Set(['PLAYED_GAME', 'FORFEIT', 'BYE', 'ABANDONED_BEFORE_MOVE']);
export const CERTIFICATION_STATUSES = new Set(['UNCERTIFIED', 'VALID', 'INVALIDATED', 'UNVERIFIABLE']);
export const JOB_STATUSES = new Set(['QUEUED', 'UPLOADING', 'PROCESSING', 'COMPLETE', 'FAILED_RETRYABLE', 'FAILED_TERMINAL', 'CANCELLED', 'SUPERSEDED']);
export const MOVE_PROVENANCE = new Set(['SHEET_DIRECT', 'SHEET_CONSTRAINED', 'USER_CORRECTED', 'USER_ENTERED', 'INFERRED_BRIDGE', 'UNRESOLVED']);
export const OBSERVATION_TRUST = new Set(['SIGNED_VERIFIED', 'UNSIGNED_FIXTURE', 'IMPORTED_UNVERIFIED', 'UNKNOWN_KEY', 'SIGNATURE_INVALID']);

export function isLikelySharedGithubPagesOrigin(locationLike = globalThis.location) {
  if (!locationLike?.hostname) return false;
  return /\.github\.io$/i.test(locationLike.hostname);
}

export function remoteRecognitionOriginAllowed(settings, locationLike = globalThis.location) {
  if (!settings?.gatewayEnabled || settings?.dedicatedOrigin !== true) return false;
  if (!settings?.gatewayUrl || !settings?.requiredOrigin || !settings?.gatewayPublicJwk) return false;
  if (isLikelySharedGithubPagesOrigin(locationLike)) return false;
  if (locationLike.origin !== settings.requiredOrigin) return false;
  try {
    const gateway = new URL(settings.gatewayUrl);
    const required = new URL(settings.requiredOrigin);
    if (gateway.protocol !== 'https:' || required.protocol !== 'https:') return false;
    if (/\.github\.io$/i.test(required.hostname)) return false;
    return true;
  } catch { return false; }
}
