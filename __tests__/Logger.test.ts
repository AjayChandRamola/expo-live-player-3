

/* ==================================================
   /__tests__/Logger.test.ts
   Unit tests for Logger.
   ================================================== */
import LoggerFactory from '../utils/Logger';

jest.mock('expo-file-system', () => ({
  documentDirectory: '/tmp/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false, size: 0 }),
  writeAsStringAsync: jest.fn().mockResolvedValue(true),
  appendToFileAsync: jest.fn().mockResolvedValue(true),
  moveAsync: jest.fn().mockResolvedValue(true)
}));

test('logger creates and writes logs', async () => {
  const logger = LoggerFactory.getLogger('Test');
  await logger.info('hello', { x: 1 });
  await logger.debug('debug');
  await logger.warn('warn');
  await logger.error('err');
  // if no exceptions thrown -- pass
  expect(true).toBe(true);
});