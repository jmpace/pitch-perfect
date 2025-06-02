// Jest setup for Node.js environment tests (lib, api, integration)

// Polyfill Web APIs for Node.js environment
const { TextEncoder, TextDecoder } = require('util');
const { ReadableStream, WritableStream, TransformStream } = require('stream/web');

// Global polyfills for Web APIs in Node.js
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.ReadableStream = ReadableStream;
global.WritableStream = WritableStream;
global.TransformStream = TransformStream;

// Mock Request and Response for Next.js API routes
global.Request = class Request {
  constructor(url, init = {}) {
    // Use Object.defineProperty to handle readonly properties properly
    Object.defineProperty(this, 'url', {
      value: url,
      writable: false,
      enumerable: true,
      configurable: false
    });
    
    this.method = init.method || 'GET';
    this.headers = new Headers(init.headers || {});
    this.body = init.body || null;
  }

  async json() {
    if (this.body) {
      return JSON.parse(this.body);
    }
    throw new Error('No body');
  }

  async text() {
    return this.body || '';
  }
};

global.Response = class Response {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.headers = new Headers(init.headers || {});
  }

  static json(data, init = {}) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
    });
  }

  async json() {
    return JSON.parse(this.body);
  }

  async text() {
    return this.body;
  }
};

global.Headers = class Headers {
  constructor(init = {}) {
    this.headers = new Map();
    if (init) {
      Object.entries(init).forEach(([key, value]) => {
        this.set(key, value);
      });
    }
  }

  get(name) {
    return this.headers.get(name.toLowerCase());
  }

  set(name, value) {
    this.headers.set(name.toLowerCase(), value);
  }

  has(name) {
    return this.headers.has(name.toLowerCase());
  }

  entries() {
    return this.headers.entries();
  }
};

// Mock crypto for edge runtime compatibility
global.crypto = {
  randomUUID: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }
};

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key-' + 'x'.repeat(45);

// Increase timeout for integration tests
jest.setTimeout(30000); 