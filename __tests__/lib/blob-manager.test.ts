// Unit tests for BlobManager class
import { BlobManager } from '@/lib/blob-manager';

// Simple smoke tests for BlobManager
describe('BlobManager', () => {
  beforeEach(() => {
    // Mock the environment variable
    process.env.BLOB_READ_WRITE_TOKEN = 'test-token-12345';
  });

  afterEach(() => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  describe('Basic class structure', () => {
    test('should have static listBlobs method', () => {
      expect(typeof BlobManager.listBlobs).toBe('function');
    });

    test('should have static deleteBlob method', () => {
      expect(typeof BlobManager.deleteBlob).toBe('function');
    });

    test('should have static getBlobInfo method', () => {
      expect(typeof BlobManager.getBlobInfo).toBe('function');
    });

    test('should have static deleteBlobsBatch method', () => {
      expect(typeof BlobManager.deleteBlobsBatch).toBe('function');
    });

    test('should have static getStorageStats method', () => {
      expect(typeof BlobManager.getStorageStats).toBe('function');
    });

    test('should have static findOrphanedBlobs method', () => {
      expect(typeof BlobManager.findOrphanedBlobs).toBe('function');
    });

    test('should have static cleanupOrphanedBlobs method', () => {
      expect(typeof BlobManager.cleanupOrphanedBlobs).toBe('function');
    });
  });

  describe('Error handling', () => {
    test('should handle missing token in deleteBlob', async () => {
      delete process.env.BLOB_READ_WRITE_TOKEN;
      
      const result = await BlobManager.deleteBlob('https://example.com/test.mp4');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('BLOB_READ_WRITE_TOKEN not configured');
      expect(result.requestId).toBeDefined();
    });

    test('should handle missing token in listBlobs', async () => {
      delete process.env.BLOB_READ_WRITE_TOKEN;
      
      await expect(BlobManager.listBlobs())
        .rejects
        .toThrow('BLOB_READ_WRITE_TOKEN not configured');
    });

    test('should handle missing token in getBlobInfo', async () => {
      delete process.env.BLOB_READ_WRITE_TOKEN;
      
      await expect(BlobManager.getBlobInfo('https://example.com/test.mp4'))
        .rejects
        .toThrow('BLOB_READ_WRITE_TOKEN not configured');
    });
  });

  describe('Request ID generation', () => {
    test('should generate unique request IDs for deleteBlob', async () => {
      const result1 = await BlobManager.deleteBlob('https://example.com/test1.mp4');
      const result2 = await BlobManager.deleteBlob('https://example.com/test2.mp4');
      
      expect(result1.requestId).toBeDefined();
      expect(result2.requestId).toBeDefined();
      expect(result1.requestId).not.toBe(result2.requestId);
    });
  });
}); 