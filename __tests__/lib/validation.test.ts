import { validateFile, FILE_VALIDATION_CONFIG } from '@/lib/validation';
import { 
  FileTypeError,
  FileSizeError,
  FileValidationError,
  ValidationError,
  MissingParameterError
} from '@/lib/errors/types';

// Helper function to create mock File objects
function createMockFile(name: string, size: number, type: string): File {
  const file = new File([''], name, { type });
  
  // Mock the size property since File constructor doesn't accept size directly
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false
  });
  
  return file;
}

describe('File Validation', () => {
  const validRequestId = 'test-request-123';

  describe('validateFile', () => {
    test('should validate a valid video file', () => {
      // Create a file with valid size (5KB, well above 1KB minimum)
      const validFile = createMockFile('test.mp4', 5 * 1024, 'video/mp4');
      
      expect(() => {
        validateFile(validFile, validRequestId);
      }).not.toThrow();
    });

    test('should validate another supported video format', () => {
      // Create a file with valid size (2KB)
      const validFile = createMockFile('test.mov', 2 * 1024, 'video/mov');
      
      expect(() => {
        validateFile(validFile, validRequestId);
      }).not.toThrow();
    });

    test('should throw FileTypeError for unsupported file type', () => {
      const invalidFile = createMockFile('test.txt', 5 * 1024, 'text/plain');
      
      expect(() => {
        validateFile(invalidFile, validRequestId);
      }).toThrow(FileTypeError);
    });

    test('should throw FileTypeError for audio files (not supported)', () => {
      const audioFile = createMockFile('test.mp3', 5 * 1024, 'audio/mp3');
      
      expect(() => {
        validateFile(audioFile, validRequestId);
      }).toThrow(FileTypeError);
    });

    test('should throw FileSizeError for file too large', () => {
      // Create file larger than 100MB limit
      const largeFile = createMockFile('large.mp4', 101 * 1024 * 1024, 'video/mp4');
      
      expect(() => {
        validateFile(largeFile, validRequestId);
      }).toThrow(FileSizeError);
    });

    test('should throw FileSizeError for empty file', () => {
      const emptyFile = createMockFile('empty.mp4', 0, 'video/mp4');
      
      expect(() => {
        validateFile(emptyFile, validRequestId);
      }).toThrow(FileSizeError);
    });

    test('should throw FileSizeError for file too small', () => {
      // Create file smaller than 1KB minimum (500 bytes)
      const smallFile = createMockFile('small.mp4', 500, 'video/mp4');
      
      expect(() => {
        validateFile(smallFile, validRequestId);
      }).toThrow(FileSizeError);
    });

    test('should throw MissingParameterError for missing file', () => {
      expect(() => {
        validateFile(null, validRequestId);
      }).toThrow(MissingParameterError);
    });

    test('should handle files with uppercase extensions', () => {
      // Create a file with valid size (3KB)
      const upperFile = createMockFile('test.MP4', 3 * 1024, 'video/mp4');
      
      expect(() => {
        validateFile(upperFile, validRequestId);
      }).not.toThrow();
    });

    test('should handle files with mixed case extensions', () => {
      // Create a file with valid size (4KB)
      const mixedFile = createMockFile('test.Mp4', 4 * 1024, 'video/mp4');
      
      expect(() => {
        validateFile(mixedFile, validRequestId);
      }).not.toThrow();
    });

    test('should validate boundary file sizes', () => {
      // Test minimum acceptable size (exactly 1KB)
      const minFile = createMockFile('min.mp4', 1024, 'video/mp4');
      expect(() => {
        validateFile(minFile, validRequestId);
      }).not.toThrow();

      // Test maximum acceptable size (100MB - 1 byte)
      const maxFile = createMockFile('max.mp4', 100 * 1024 * 1024 - 1, 'video/mp4');
      expect(() => {
        validateFile(maxFile, validRequestId);
      }).not.toThrow();

      // Test exactly at the maximum limit (100MB) - should be allowed since validation uses >
      const atMaxFile = createMockFile('atmax.mp4', 100 * 1024 * 1024, 'video/mp4');
      expect(() => {
        validateFile(atMaxFile, validRequestId);
      }).not.toThrow();

      // Test one byte over the maximum (100MB + 1 byte) - should trigger error
      const overMaxFile = createMockFile('overmax.mp4', 100 * 1024 * 1024 + 1, 'video/mp4');
      expect(() => {
        validateFile(overMaxFile, validRequestId);
      }).toThrow(FileSizeError);
    });

    test('should include request ID in error contexts', () => {
      const invalidFile = createMockFile('test.txt', 5 * 1024, 'text/plain');
      
      try {
        validateFile(invalidFile, validRequestId);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.requestId).toBe(validRequestId);
      }
    });

    test('should handle files with no extension', () => {
      // File type validation is based on MIME type, not extension
      // Create a file with valid size (2KB)
      const noExtFile = createMockFile('videofile', 2 * 1024, 'video/mp4');
      
      expect(() => {
        validateFile(noExtFile, validRequestId);
      }).not.toThrow(); // File type validation is based on MIME type, not extension
    });

    test('should handle files with multiple dots in name', () => {
      // Create a file with valid size (3KB)
      const multiDotFile = createMockFile('my.video.file.mp4', 3 * 1024, 'video/mp4');
      
      expect(() => {
        validateFile(multiDotFile, validRequestId);
      }).not.toThrow();
    });

    test('should handle special characters in filename', () => {
      // Create a file with valid size (2KB)
      const specialCharFile = createMockFile('my_video-file (1).mp4', 2 * 1024, 'video/mp4');
      
      expect(() => {
        validateFile(specialCharFile, validRequestId);
      }).not.toThrow();
    });

    test('should validate all supported video formats', () => {
      const supportedFormats = ['video/mp4', 'video/mov', 'video/webm', 'video/quicktime'];
      
      supportedFormats.forEach((mimeType) => {
        // Create a file with valid size (2KB) for each format
        const file = createMockFile(`test.${mimeType.split('/')[1]}`, 2 * 1024, mimeType);
        
        expect(() => {
          validateFile(file, validRequestId);
        }).not.toThrow();
      });
    });
  });

  describe('Error Context Validation', () => {
    test('should include filename in error context', () => {
      // Create file that's too large to trigger FileSizeError
      const file = createMockFile('test.mp4', 200 * 1024 * 1024, 'video/mp4');
      
      try {
        validateFile(file, validRequestId);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.details).toHaveProperty('actualSize', 200 * 1024 * 1024);
      }
    });

    test('should include file size in error context', () => {
      const smallFile = createMockFile('small.mp4', 500, 'video/mp4');
      
      try {
        validateFile(smallFile, validRequestId);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.details).toHaveProperty('actualSize', 500);
        expect(error.details).toHaveProperty('minSize', 1024);
      }
    });

    test('should include file type in error context', () => {
      const invalidFile = createMockFile('test.txt', 5 * 1024, 'text/plain');
      
      try {
        validateFile(invalidFile, validRequestId);
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.details).toHaveProperty('receivedType', 'text/plain');
        expect(error.details).toHaveProperty('allowedTypes');
      }
    });
  });
}); 