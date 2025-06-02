// Global test setup
require('@testing-library/jest-dom');
import { TextEncoder, TextDecoder } from 'util';

// Make TextEncoder and TextDecoder available globally for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock environment variables for testing
process.env.BLOB_READ_WRITE_TOKEN = 'test-token-12345';
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress logs during tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Mock fetch for API testing
global.fetch = jest.fn();

// Mock nanoid to avoid ES module issues
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'test-id-12345')
}));

// Mock fluent-ffmpeg to avoid binary dependencies in tests
jest.mock('fluent-ffmpeg', () => {
  const mockFfmpeg = jest.fn(() => ({
    setFfmpegPath: jest.fn(),
    setFfprobePath: jest.fn(),
    ffprobe: jest.fn((input, callback) => {
      callback(null, {
        format: {
          duration: 30,
          size: 1048576,
          format_name: 'mp4'
        },
        streams: [{
          codec_type: 'video',
          width: 480,
          height: 270,
          r_frame_rate: '30/1',
          codec_name: 'h264'
        }, {
          codec_type: 'audio',
          channels: 2,
          sample_rate: 44100
        }]
      });
    }),
    screenshots: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    save: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnThis(),
    audioCodec: jest.fn().mockReturnThis(),
    audioBitrate: jest.fn().mockReturnThis(),
    audioChannels: jest.fn().mockReturnThis(),
    run: jest.fn()
  }));
  
  mockFfmpeg.setFfmpegPath = jest.fn();
  mockFfmpeg.setFfprobePath = jest.fn();
  
  return mockFfmpeg;
});

// Mock Vercel Blob
jest.mock('@vercel/blob', () => ({
  put: jest.fn().mockResolvedValue({
    url: 'https://test-blob-url.com/test-file',
    pathname: '/test-file',
    contentType: 'application/octet-stream',
    contentDisposition: 'attachment; filename="test-file"'
  })
}));

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
}); 