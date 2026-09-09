

/* ==================================================
   /utils/validators.ts
   Lightweight input validation utilities.
   ================================================== */
export function validateUrl(url?: string) {
  if (!url || typeof url !== 'string') throw new Error('sourceUrl is required and must be a string');
  // basic url validation
  const pattern = /^(https?:)\/\/[\w.-]+(:\d+)?(\/.*)?$/i;
  if (!pattern.test(url)) throw new Error('Invalid URL: must be absolute https/http URL');
  return true;
}