/**
 * Unit tests for storage utilities
 * Tests MIME validation and file signature verification
 */

import { describe, it, expect } from 'vitest';
import { validateMimeType, validateFileSignature, generateStoragePath } from '@/lib/storage';

describe('validateMimeType', () => {
  it('should accept valid PNG MIME type', () => {
    expect(validateMimeType('image/png')).toBe(true);
  });

  it('should accept valid JPEG MIME type', () => {
    expect(validateMimeType('image/jpeg')).toBe(true);
  });

  it('should accept valid GIF MIME type', () => {
    expect(validateMimeType('image/gif')).toBe(true);
  });

  it('should accept valid WebP MIME type', () => {
    expect(validateMimeType('image/webp')).toBe(true);
  });

  it('should reject invalid MIME type', () => {
    expect(validateMimeType('application/pdf')).toBe(false);
    expect(validateMimeType('text/plain')).toBe(false);
    expect(validateMimeType('video/mp4')).toBe(false);
  });

  it('should reject empty MIME type', () => {
    expect(validateMimeType('')).toBe(false);
  });

  it('should be case-sensitive', () => {
    expect(validateMimeType('IMAGE/PNG')).toBe(false);
    expect(validateMimeType('Image/Png')).toBe(false);
  });
});

describe('validateFileSignature', () => {
  it('should validate PNG file signature', () => {
    // PNG magic bytes: 89 50 4E 47
    const pngBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
    expect(validateFileSignature(pngBuffer, 'image/png')).toBe(true);
  });

  it('should validate JPEG file signature', () => {
    // JPEG magic bytes: FF D8 FF
    const jpegBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).buffer;
    expect(validateFileSignature(jpegBuffer, 'image/jpeg')).toBe(true);
  });

  it('should validate GIF file signature', () => {
    // GIF magic bytes: 47 49 46 (GIF)
    const gifBuffer = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]).buffer;
    expect(validateFileSignature(gifBuffer, 'image/gif')).toBe(true);
  });

  it('should validate WebP file signature', () => {
    // WebP magic bytes: RIFF + WEBP at offset 8
    const webpBuffer = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // size (placeholder)
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]).buffer;
    expect(validateFileSignature(webpBuffer, 'image/webp')).toBe(true);
  });

  it('should reject PNG with wrong signature', () => {
    // Invalid PNG signature
    const invalidBuffer = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00]).buffer;
    expect(validateFileSignature(invalidBuffer, 'image/png')).toBe(false);
  });

  it('should reject JPEG with wrong signature', () => {
    // Invalid JPEG signature
    const invalidBuffer = new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer;
    expect(validateFileSignature(invalidBuffer, 'image/jpeg')).toBe(false);
  });

  it('should reject mismatched MIME type and signature', () => {
    // PNG signature but claiming to be JPEG
    const pngBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
    expect(validateFileSignature(pngBuffer, 'image/jpeg')).toBe(false);
  });

  it('should reject unsupported MIME type', () => {
    const buffer = new Uint8Array([0x00, 0x00, 0x00, 0x00]).buffer;
    expect(validateFileSignature(buffer, 'application/pdf')).toBe(false);
  });

  it('should reject WebP with incomplete signature', () => {
    // RIFF but no WEBP
    const invalidWebpBuffer = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // size
      0x00, 0x00, 0x00, 0x00, // NOT WEBP
    ]).buffer;
    expect(validateFileSignature(invalidWebpBuffer, 'image/webp')).toBe(false);
  });
});

describe('generateStoragePath', () => {
  it('should generate valid storage path', () => {
    const userId = '123e4567-e89b-12d3-a456-426614174000';
    const filename = 'screenshot.png';
    const shortId = 'abc123';
    
    const path = generateStoragePath(userId, filename, shortId);
    
    expect(path).toMatch(/^123e4567-e89b-12d3-a456-426614174000\/\d+_abc123\.png$/);
    expect(path).toContain(userId);
    expect(path).toContain(shortId);
    expect(path).toContain('.png');
  });

  it('should preserve file extension', () => {
    const userId = 'user-id';
    const shortId = 'abc123';
    
    expect(generateStoragePath(userId, 'test.png', shortId)).toContain('.png');
    expect(generateStoragePath(userId, 'test.jpg', shortId)).toContain('.jpg');
    expect(generateStoragePath(userId, 'test.gif', shortId)).toContain('.gif');
    expect(generateStoragePath(userId, 'test.webp', shortId)).toContain('.webp');
  });

  it('should convert extension to lowercase', () => {
    const userId = 'user-id';
    const filename = 'Screenshot.PNG';
    const shortId = 'abc123';
    
    const path = generateStoragePath(userId, filename, shortId);
    expect(path).toContain('.png');
    expect(path).not.toContain('.PNG');
  });

  it('should use png as default extension if missing', () => {
    const userId = 'user-id';
    const filename = 'screenshot';
    const shortId = 'abc123';
    
    const path = generateStoragePath(userId, filename, shortId);
    expect(path).toContain('.png');
  });

  it('should include timestamp in path', () => {
    const userId = 'user-id';
    const filename = 'test.png';
    const shortId = 'abc123';
    
    const beforeTime = Date.now();
    const path = generateStoragePath(userId, filename, shortId);
    const afterTime = Date.now();
    
    // Extract timestamp from path
    const match = path.match(/\/(\d+)_/);
    expect(match).not.toBeNull();
    
    if (match) {
      const timestamp = parseInt(match[1], 10);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    }
  });

  it('should create unique paths for same file uploaded multiple times', () => {
    const userId = 'user-id';
    const filename = 'test.png';
    const shortId1 = 'abc123';
    const shortId2 = 'def456';
    
    const path1 = generateStoragePath(userId, filename, shortId1);
    const path2 = generateStoragePath(userId, filename, shortId2);
    
    expect(path1).not.toBe(path2);
  });
});

