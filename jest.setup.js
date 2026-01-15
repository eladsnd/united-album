import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream } from 'stream/web';

// Polyfill web APIs for Jest
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.ReadableStream = ReadableStream;

// Polyfill fetch APIs
global.Request = class Request {
    constructor(url, init = {}) {
        this.url = url;
        this.method = init.method || 'GET';
        this.headers = new Map(Object.entries(init.headers || {}));
        this.body = init.body;
    }

    get(name) {
        return this.headers.get(name);
    }

    async formData() {
        return this.body;
    }

    async json() {
        return JSON.parse(this.body);
    }
};

global.Response = class Response {
    constructor(body, init = {}) {
        this.body = body;
        this.status = init.status || 200;
        this.headers = new Map(Object.entries(init.headers || {}));
        this.ok = this.status >= 200 && this.status < 300;
    }

    async json() {
        return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
    }

    async text() {
        return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
    }
};

global.FormData = class FormData {
    constructor() {
        this.data = new Map();
    }

    append(key, value, filename) {
        this.data.set(key, filename ? { value, filename } : value);
    }

    get(key) {
        return this.data.get(key);
    }
};

global.Blob = class Blob {
    constructor(parts, options = {}) {
        this.parts = parts;
        this.type = options.type || '';
    }
};

global.File = class File extends global.Blob {
    constructor(parts, filename, options = {}) {
        super(parts, options);
        this.name = filename;
        this.lastModified = options.lastModified || Date.now();
    }
};

// Mock NextResponse for API route testing
global.NextResponse = class NextResponse extends global.Response {
    static json(data, init = {}) {
        return new global.Response(JSON.stringify(data), {
            ...init,
            headers: {
                'content-type': 'application/json',
                ...init.headers,
            },
        });
    }
};

// Robust next/image mock
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src, alt, fill, ...props }) => {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={src} alt={alt} style={fill ? { objectFit: 'cover' } : {}} />;
    },
}));
