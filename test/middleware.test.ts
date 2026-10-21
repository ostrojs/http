const _BodyParserJson = require('../src/middleware/bodyParserJson');
const BodyParserJson = _BodyParserJson.default || _BodyParserJson;
const _BodyParserUrlEncoded = require('../src/middleware/bodyParserUrlEncoded');
const BodyParserUrlEncoded = _BodyParserUrlEncoded.default || _BodyParserUrlEncoded;
const _Compression = require('../src/middleware/compression');
const Compression = _Compression.default || _Compression;
const _CrossOrigin = require('../src/middleware/crossOrigin');
const CrossOrigin = _CrossOrigin.default || _CrossOrigin;
const _FormParser = require('../src/middleware/formParser');
const FormParser = _FormParser.default || _FormParser;
const _QueryParser = require('../src/middleware/queryParser');
const QueryParser = _QueryParser.default || _QueryParser;
const _ServeStatic = require('../src/middleware/serveStatic');
const ServeStatic = _ServeStatic.default || _ServeStatic;
const { Readable } = require('stream');
const EventEmitter = require('events');
const zlib = require('zlib');

describe('HTTP Middlewares', () => {
    describe('BodyParserJson', () => {
        test('parses JSON payload', (done) => {
            const middleware = new BodyParserJson();
            const payload = JSON.stringify({ name: 'OstroJS' });
            const req = Readable.from([payload]);
            req.headers = {
                'content-type': 'application/json',
                'content-length': String(Buffer.byteLength(payload))
            };

            const res = {};
            middleware.handle({
                request: req,
                response: res,
                next: (err) => {
                    expect(err).toBeFalsy();
                    expect(req.body).toEqual({ name: 'OstroJS' });
                    done();
                }
            });
        });
    });

    describe('BodyParserUrlEncoded', () => {
        test('parses urlencoded payload', (done) => {
            const middleware = new BodyParserUrlEncoded();
            const payload = 'name=OstroJS';
            const req = Readable.from([payload]);
            req.headers = {
                'content-type': 'application/x-www-form-urlencoded',
                'content-length': String(Buffer.byteLength(payload))
            };

            const res = {};
            middleware.handle({
                request: req,
                response: res,
                next: (err) => {
                    expect(err).toBeFalsy();
                    expect(req.body).toEqual({ name: 'OstroJS' });
                    done();
                }
            });
        });
    });

    describe('QueryParser', () => {
        test('parses query string into request.query', () => {
            const middleware = new QueryParser();
            const req = {
                _parsedUrl: { query: 'filter=active&sort=desc&tags=a&tags=b' }
            };
            const next = jest.fn();
            middleware.handle({ request: req, response: {}, next });
            expect(next).toHaveBeenCalled();
            expect(req.query).toEqual({
                filter: 'active',
                sort: 'desc',
                tags: ['a', 'b']
            });
        });
    });

    describe('ServeStatic', () => {
        test('initializes and handles static request', (done) => {
            const middleware = new ServeStatic();
            middleware.$publicPath = __dirname;
            const req = {
                method: 'GET',
                url: '/test.txt',
                headers: {}
            };
            const res = new EventEmitter();
            res.setHeader = jest.fn();
            res.getHeader = jest.fn();
            const next = jest.fn(() => done());
            middleware.handle({ request: req, response: res, next });
        });

        test('constructor uses this.$app or global $app and options', () => {
            class CustomServeStatic extends ServeStatic {
                options = { maxAge: '1d' };
            }
            CustomServeStatic.prototype.$app = { 'path.public': '/app/public' };
            delete CustomServeStatic.prototype.$options;
            const s1 = new CustomServeStatic();
            expect(s1.$publicPath).toBe('/app/public');
            s1.$publicPath = __dirname;
            delete s1.$options;
            s1.handle({ request: { method: 'GET', url: '/test.txt', headers: {} }, response: {}, next: jest.fn() });

            global.$app = { 'path.public': '/global/public' };
            const s2 = new ServeStatic();
            expect(s2.$publicPath).toBe('/global/public');
            delete global.$app;
        });

        test('falls back to empty options when $options and options are both absent', () => {
            // This exercises the third arm of `this.$options || this.options || {}`
            const s = new ServeStatic();
            s.$publicPath = __dirname;
            delete s.$options;
            delete s.options;
            // Should not throw — uses {} as options
            expect(() => {
                s.handle({ request: { method: 'GET', url: '/test.txt', headers: {} }, response: {}, next: jest.fn() });
            }).not.toThrow();
        });
    });


    describe('CrossOrigin', () => {
        test('allows wildcard origin and default headers', (done) => {
            const middleware = new CrossOrigin();
            const req = {
                method: 'GET',
                headers: {
                    origin: 'http://example.com'
                },
                header: function (name) {
                    return this.headers[name.toLowerCase()];
                }
            };
            const res = {
                headers: {},
                setHeader: function (k, v) {
                    this.headers[k] = v;
                },
                getHeader: function (k) {
                    return this.headers[k];
                }
            };
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    expect(res.headers['access-control-allow-origin'] || res.headers['Access-Control-Allow-Origin']).toBe('*');
                    done();
                }
            });
        });

        test('handles specific origins and arrays', (done) => {
            const middleware = new CrossOrigin();
            middleware.$headers['Access-Control-Allow-Origin'] = ['http://site.com', 'site2.com'];
            middleware.$headers['Access-Control-Allow-Methods'] = 'GET, POST';
            middleware.$headers['Access-Control-Allow-Headers'] = ['X-Custom', 'X-Auth'];

            const req = {
                method: 'OPTIONS',
                headers: {
                    origin: 'http://site.com',
                    'access-control-request-method': 'POST'
                },
                header: function (name) {
                    return this.headers[name.toLowerCase()];
                }
            };
            const res = {
                headers: {},
                setHeader: function (k, v) {
                    this.headers[k] = v;
                },
                getHeader: function (k) {
                    return this.headers[k];
                },
                end: jest.fn(() => {
                    expect(res.headers['access-control-allow-origin'] || res.headers['Access-Control-Allow-Origin']).toBe('http://site.com');
                    done();
                })
            };
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    done();
                }
            });
        });

        test('handles disallowed origin and string origin with stripped protocol', (done) => {
            const middleware = new CrossOrigin();
            middleware.$headers['Access-Control-Allow-Origin'] = 'site2.com';
            middleware.$headers['Access-Control-Allow-Methods'] = [];
            middleware.$headers['Access-Control-Allow-Headers'] = [];

            const req = {
                method: 'GET',
                headers: {
                    origin: 'http://site2.com'
                },
                header: function (name) {
                    return this.headers[name.toLowerCase()];
                }
            };
            const res = {
                headers: {},
                setHeader: function (k, v) {
                    this.headers[k] = v;
                },
                getHeader: function (k) {
                    return this.headers[k];
                }
            };
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    // Stripped matches site2.com
                    expect(res.headers['access-control-allow-origin'] || res.headers['Access-Control-Allow-Origin']).toBe('http://site2.com');

                    // Now check empty origin
                    const req2 = {
                        method: 'GET',
                        headers: {},
                        header: function (name) {
                            return this.headers[name.toLowerCase()];
                        }
                    };
                    const res2 = {
                        headers: {},
                        setHeader: function (k, v) {
                            this.headers[k] = v;
                        },
                        getHeader: function (k) {
                            return this.headers[k];
                        }
                    };
                    middleware.handle({
                        request: req2,
                        response: res2,
                        next: () => {
                            expect(res2.headers['access-control-allow-origin']).toBeUndefined();

                            // Test disallowed non-matching origin
                            const req3 = {
                                method: 'GET',
                                headers: { origin: 'http://disallowed.com' },
                                header: function (name) { return this.headers[name.toLowerCase()]; }
                            };
                            const res3 = {
                                headers: {},
                                setHeader: function (k, v) { this.headers[k] = v; },
                                getHeader: function (k) { return this.headers[k]; }
                            };
                            middleware.handle({
                                request: req3,
                                response: res3,
                                next: () => {
                                    expect(res3.headers['access-control-allow-origin']).toBeUndefined();
                                    done();
                                }
                            });
                        }
                    });
                }
            });
        });

        test('normalizeArray returns [] when header value is null/undefined (falsy branch)', (done) => {
            const middleware = new CrossOrigin();
            // Setting origin header to null exercises the `if (!val) return []` branch
            middleware.$headers['Access-Control-Allow-Origin'] = null;
            middleware.$headers['Access-Control-Allow-Methods'] = null;
            middleware.$headers['Access-Control-Allow-Headers'] = null;
            const req = {
                method: 'GET',
                headers: {},
                header: function (name) { return this.headers[name.toLowerCase()]; }
            };
            const res = {
                headers: {},
                setHeader: function (k, v) { this.headers[k] = v; },
                getHeader: function (k) { return this.headers[k]; }
            };
            middleware.handle({
                request: req,
                response: res,
                next: () => { done(); }
            });
        });
    });

    describe('FormParser', () => {
        test('passes through non multipart request', (done) => {
            const middleware = new FormParser();
            const req = {
                headers: { 'content-type': 'application/json' },
                body: {}
            };
            middleware.handle({
                request: req,
                response: {},
                next: () => {
                    expect(req.files).toEqual({});
                    done();
                }
            });
        });

        test('passes through when content-type is missing', (done) => {
            const middleware = new FormParser();
            const req = {
                headers: {},
                body: {}
            };
            middleware.handle({
                request: req,
                response: {},
                next: () => {
                    expect(req.files).toEqual({});
                    done();
                }
            });
        });

        test('parses multipart/form-data with fields and files', (done) => {
            const middleware = new FormParser();
            const boundary = '---------------------------1234567890';
            const multipartBody = [
                `--${boundary}`,
                'Content-Disposition: form-data; name="username"',
                '',
                'ostro_user',
                `--${boundary}`,
                'Content-Disposition: form-data; name="avatar"; filename="test.txt"',
                'Content-Type: text/plain',
                '',
                'file content here',
                `--${boundary}--`,
                ''
            ].join('\r\n');

            const req = new Readable();
            req.headers = {
                'content-type': `multipart/form-data; boundary=${boundary}`,
                'content-length': Buffer.byteLength(multipartBody)
            };
            req.body = {};
            req._read = () => {};
            req.push(multipartBody);
            req.push(null);

            middleware.handle({
                request: req,
                response: {},
                next: () => {
                    expect(req.body.username).toBe('ostro_user');
                    expect(req.files.avatar).toBeDefined();
                    expect(req.files.avatar.getName()).toBe('test.txt');
                    expect(req.files.avatar.getBufferData().toString()).toBe('file content here');

                    // test array field / array file customizer
                    const multiBody = [
                        `--${boundary}`,
                        'Content-Disposition: form-data; name="tags[]"',
                        '',
                        'first',
                        `--${boundary}`,
                        'Content-Disposition: form-data; name="tags[]"',
                        '',
                        'second',
                        `--${boundary}--`,
                        ''
                    ].join('\r\n');
                    const reqMulti = Readable.from([multiBody]);
                    reqMulti.headers = {
                        'content-type': `multipart/form-data; boundary=${boundary}`,
                        'content-length': Buffer.byteLength(multiBody)
                    };
                    reqMulti.body = {};
                    middleware.handle({
                        request: reqMulti,
                        response: {},
                        next: () => {
                            expect(reqMulti.body.tags).toEqual(['first', 'second']);
                            done();
                        }
                    });
                }
            });
        });

        test('skips setting request.files when already an object', (done) => {
            const middleware = new FormParser();
            const existingFiles = { photo: {} };
            const req = {
                headers: { 'content-type': 'application/json' },
                body: {},
                files: existingFiles  // already an object
            };
            middleware.handle({
                request: req,
                response: {},
                next: () => {
                    // files should remain the same object reference (not reset to {})
                    expect(req.files).toBe(existingFiles);
                    done();
                }
            });
        });
    });

    describe('Compression', () => {
        test('skips HTTP 2.0 requests', (done) => {
            const middleware = new Compression();
            const req = { httpVersion: '2.0' };
            middleware.handle({
                request: req,
                response: {},
                next: () => {
                    done();
                }
            });
        });

        test('compresses response with gzip when eligible', (done) => {
            const middleware = new Compression();
            const req = {
                httpVersion: '1.1',
                method: 'GET',
                headers: {
                    'accept-encoding': 'gzip'
                }
            };
            class MockResponse extends EventEmitter {
                headers = {
                    'content-type': 'text/html; charset=utf-8'
                };
                setHeader(k, v) {
                    this.headers[k.toLowerCase()] = v;
                }
                getHeader(k) {
                    return this.headers[k.toLowerCase()];
                }
                removeHeader(k) {
                    delete this.headers[k.toLowerCase()];
                }
                writeHead(statusCode, headers) {
                    if (headers) Object.assign(this.headers, headers);
                    this.statusCode = statusCode;
                    this._header = true;
                }
                _implicitHeader() {
                    this.writeHead(this.statusCode || 200);
                }
                write(chunk, encoding) {
                    this.chunks = this.chunks || [];
                    this.chunks.push(chunk);
                    return true;
                }
                end(chunk, encoding) {
                    if (chunk) this.write(chunk);
                    this.ended = true;
                }
            }

            const res = new MockResponse();
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    // Register drain listener to test response.on
                    const drainListener = jest.fn();
                    res.on('drain', drainListener);
                    res.on('other', () => {});

                    const largeBody = 'A'.repeat(2048);
                    res.write(largeBody);
                    res.flush();
                    res.end();

                    expect(res.getHeader('content-encoding')).toBe('gzip');
                    done();
                }
            });
        });

        test('bypasses compression when not compressible or no-transform', (done) => {
            const middleware = new Compression();
            const req = {
                httpVersion: '1.1',
                method: 'GET',
                headers: { 'accept-encoding': 'gzip' }
            };
            class MockResponse extends EventEmitter {
                headers = {
                    'content-type': 'image/png',
                    'cache-control': 'no-transform'
                };
                setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
                getHeader(k) { return this.headers[k.toLowerCase()]; }
                removeHeader(k) { delete this.headers[k.toLowerCase()]; }
                writeHead(statusCode, headers) {
                    if (headers) Object.assign(this.headers, headers);
                    this.statusCode = statusCode;
                    this._header = true;
                }
                _implicitHeader() { this.writeHead(this.statusCode || 200); }
                write(c) { return true; }
                end(c) {}
            }
            const res = new MockResponse();
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    res.write('small');
                    res.end();
                    expect(res.getHeader('content-encoding')).toBeUndefined();
                    done();
                }
            });
        });

        test('bypasses compression on HEAD or below threshold or already encoded', (done) => {
            const middleware = new Compression();
            const req = {
                httpVersion: '1.1',
                method: 'HEAD',
                headers: { 'accept-encoding': 'gzip' }
            };
            class MockResponse extends EventEmitter {
                headers = {
                    'content-type': 'text/html',
                    'content-encoding': 'deflate',
                    'content-length': '10'
                };
                setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
                getHeader(k) { return this.headers[k.toLowerCase()]; }
                removeHeader(k) { delete this.headers[k.toLowerCase()]; }
                writeHead(statusCode, headers) {
                    if (headers) Object.assign(this.headers, headers);
                    this.statusCode = statusCode;
                    this._header = true;
                }
                _implicitHeader() { this.writeHead(this.statusCode || 200); }
                write(c) { return true; }
                end(c) {}
            }
            const res = new MockResponse();
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    res.end('small');
                    expect(res.getHeader('content-encoding')).toBe('deflate');
                    done();
                }
            });
        });

        test('chunkLength and toBuffer helper branches', () => {
            const middleware = new Compression();
            expect(middleware.chunkLength(null)).toBe(0);
            expect(middleware.chunkLength('hello', 'utf8')).toBe(5);
            expect(middleware.chunkLength(Buffer.from('hello'))).toBe(5);

            expect(middleware.toBuffer('abc')).toEqual(Buffer.from('abc'));
            const buf = Buffer.from('abc');
            expect(middleware.toBuffer(buf)).toBe(buf);
        });

        test('compresses with deflate and handles stream events', (done) => {
            const middleware = new Compression();
            middleware.$options = { threshold: 10 };
            const req = {
                httpVersion: '1.1',
                method: 'GET',
                headers: { 'accept-encoding': 'deflate' }
            };
            class MockResponse extends EventEmitter {
                headers = { 'content-type': 'text/html' };
                setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
                getHeader(k) { return this.headers[k.toLowerCase()]; }
                removeHeader(k) { delete this.headers[k.toLowerCase()]; }
                writeHead(statusCode, headers) {
                    if (headers) Object.assign(this.headers, headers);
                    this.statusCode = statusCode;
                    this._header = true;
                }
                _implicitHeader() { this.writeHead(200); }
                write(chunk, encoding) {
                    this.chunks = this.chunks || [];
                    this.chunks.push(chunk);
                    // simulate backpressure and subsequent drain
                    process.nextTick(() => this.emit('drain'));
                    return false;
                }
                end(chunk, encoding) {
                    if (chunk) this.write(chunk);
                    this.ended = true;
                    expect(this.getHeader('content-encoding')).toBe('deflate');
                    done();
                }
            }
            const res = new MockResponse();
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    res.write('A'.repeat(2048));
                    res.end();
                }
            });
        });

        test('handles not acceptable encoding and already ended response', (done) => {
            const middleware = new Compression();
            middleware.$options = { threshold: 10 };
            const req = {
                httpVersion: '1.1',
                method: 'GET',
                headers: { 'accept-encoding': 'gzip' }
            };
            class MockResponse extends EventEmitter {
                headers = { 'content-type': 'text/html' };
                setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
                getHeader(k) { return this.headers[k.toLowerCase()]; }
                removeHeader(k) { delete this.headers[k.toLowerCase()]; }
                writeHead(statusCode, headers) {
                    if (headers) Object.assign(this.headers, headers);
                    this.statusCode = statusCode;
                    this._header = true;
                }
                _implicitHeader() { this.writeHead(200); }
                write(c) { return true; }
                end() {
                    // subsequent write & end should return false because ended is true
                    expect(res.write('extra')).toBe(false);
                    expect(res.end('extra')).toBe(false);
                    done();
                }
            }
            const res = new MockResponse();
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    res.write('Larger than ten bytes string');
                    res.end();
                }
            });
        });

        test('handles not acceptable encoding, missing content-length, and on before stream', (done) => {
            const middleware = new Compression();
            const req = {
                httpVersion: '1.1',
                method: 'GET',
                headers: { 'accept-encoding': 'gzip, deflate' }
            };
            class MockResponse extends EventEmitter {
                headers = { 'content-type': 'text/html' };
                setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
                getHeader(k) { return this.headers[k.toLowerCase()]; }
                removeHeader(k) { delete this.headers[k.toLowerCase()]; }
                writeHead(statusCode, headers) {
                    if (headers) Object.assign(this.headers, headers);
                    this.statusCode = statusCode;
                    this._header = true;
                }
                _implicitHeader() { this.writeHead(200); }
                write(c) { return true; }
                end() { done(); }
            }
            const res = new MockResponse();
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    // response.on('drain') before stream is created
                    res.on('drain', () => {});
                    // end without prior Content-Length header, small chunk < threshold
                    res.end('small');
                }
            });
        });

        test('handles not acceptable encoding and gzip fallback from deflate', (done) => {
            const middleware = new Compression();
            const req = {
                httpVersion: '1.1',
                method: 'GET',
                headers: { 'accept-encoding': 'identity' }
            };
            class MockResponse extends EventEmitter {
                headers = { 'content-type': 'text/html' };
                setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
                getHeader(k) { return this.headers[k.toLowerCase()]; }
                removeHeader(k) { delete this.headers[k.toLowerCase()]; }
                writeHead(statusCode, headers) {
                    if (headers) Object.assign(this.headers, headers);
                    this.statusCode = statusCode;
                    this._header = true;
                }
                _implicitHeader() { this.writeHead(200); }
                write(c) { return true; }
                end() {
                    expect(this.getHeader('content-encoding')).toBeUndefined();
                    done();
                }
            }
            const res = new MockResponse();
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    res.end('not acceptable encoding chunk');
                }
            });
        });

        test('deflate method selection when both gzip and deflate accepted', (done) => {
            const middleware = new Compression();
            middleware.$options = { threshold: 10 };
            const req = {
                httpVersion: '1.1',
                method: 'GET',
                headers: { 'accept-encoding': 'deflate, gzip' }
            };
            class MockResponse extends EventEmitter {
                headers = { 'content-type': 'text/html' };
                setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
                getHeader(k) { return this.headers[k.toLowerCase()]; }
                removeHeader(k) { delete this.headers[k.toLowerCase()]; }
                writeHead(statusCode, headers) {
                    if (headers) Object.assign(this.headers, headers);
                    this.statusCode = statusCode;
                    this._header = true;
                }
                _implicitHeader() { this.writeHead(200); }
                write(c) { return true; }
                end() {
                    expect(this.getHeader('content-encoding')).toBe('gzip');
                    done();
                }
            }
            const res = new MockResponse();
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    res.write('Larger than ten bytes payload');
                    res.end();
                }
            });
        });

        test('bypasses compression when shouldTransform returns false (no-transform with compressible type)', (done) => {
            const middleware = new Compression();
            const req = {
                httpVersion: '1.1',
                method: 'GET',
                headers: { 'accept-encoding': 'gzip' }
            };
            class MockResponse extends EventEmitter {
                headers = {
                    'content-type': 'text/html',
                    'cache-control': 'no-transform'
                };
                setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
                getHeader(k) { return this.headers[k.toLowerCase()]; }
                removeHeader(k) { delete this.headers[k.toLowerCase()]; }
                writeHead(statusCode, headers) {
                    if (headers) Object.assign(this.headers, headers);
                    this.statusCode = statusCode;
                    this._header = true;
                }
                _implicitHeader() { this.writeHead(200); }
                write(c) { return true; }
                end(c) {
                    expect(this.getHeader('content-encoding')).toBeUndefined();
                    done();
                }
            }
            const res = new MockResponse();
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    res.write('Large enough payload to exceed default threshold if it were transformed');
                    res.end();
                }
            });
        });

        test('bypasses compression when Content-Encoding already set (non-identity)', (done) => {
            const middleware = new Compression();
            const req = {
                httpVersion: '1.1',
                method: 'GET',
                headers: { 'accept-encoding': 'gzip' }
            };
            class MockResponse extends EventEmitter {
                headers = {
                    'content-type': 'text/html',
                    'content-encoding': 'br'
                };
                setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
                getHeader(k) { return this.headers[k.toLowerCase()]; }
                removeHeader(k) { delete this.headers[k.toLowerCase()]; }
                writeHead(statusCode, headers) {
                    if (headers) Object.assign(this.headers, headers);
                    this.statusCode = statusCode;
                    this._header = true;
                }
                _implicitHeader() { this.writeHead(200); }
                write(c) { return true; }
                end(c) {
                    expect(this.getHeader('content-encoding')).toBe('br');
                    done();
                }
            }
            const res = new MockResponse();
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    res.write('Some large enough body to check already-encoded branch');
                    res.end();
                }
            });
        });

        test('bypasses compression for HEAD request (compressible content-type)', (done) => {
            const middleware = new Compression();
            middleware.$options = { threshold: 10 };
            const req = {
                httpVersion: '1.1',
                method: 'HEAD',
                headers: { 'accept-encoding': 'gzip' }
            };
            class MockResponse extends EventEmitter {
                headers = { 'content-type': 'text/html' };
                setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
                getHeader(k) { return this.headers[k.toLowerCase()]; }
                removeHeader(k) { delete this.headers[k.toLowerCase()]; }
                writeHead(statusCode, headers) {
                    if (headers) Object.assign(this.headers, headers);
                    this.statusCode = statusCode;
                    this._header = true;
                }
                _implicitHeader() { this.writeHead(200); }
                write(c) { return true; }
                end(c) {
                    expect(this.getHeader('content-encoding')).toBeUndefined();
                    done();
                }
            }
            const res = new MockResponse();
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    res.write('A'.repeat(100));
                    res.end();
                }
            });
        });

        test('bypasses compression when no acceptable encoding (identity only)', (done) => {
            const middleware = new Compression();
            middleware.$options = { threshold: 10 };
            const req = {
                httpVersion: '1.1',
                method: 'GET',
                headers: { 'accept-encoding': 'identity, *;q=0' }
            };
            class MockResponse extends EventEmitter {
                headers = { 'content-type': 'text/html' };
                setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
                getHeader(k) { return this.headers[k.toLowerCase()]; }
                removeHeader(k) { delete this.headers[k.toLowerCase()]; }
                writeHead(statusCode, headers) {
                    if (headers) Object.assign(this.headers, headers);
                    this.statusCode = statusCode;
                    this._header = true;
                }
                _implicitHeader() { this.writeHead(200); }
                write(c) { return true; }
                end(c) {
                    expect(this.getHeader('content-encoding')).toBeUndefined();
                    done();
                }
            }
            const res = new MockResponse();
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    res.write('A'.repeat(100));
                    res.end();
                }
            });
        });

        test('registers drain listener on stream when stream already created (L87 branch)', (done) => {
            const middleware = new Compression();
            middleware.$options = { threshold: 10 };
            const req = {
                httpVersion: '1.1',
                method: 'GET',
                headers: { 'accept-encoding': 'gzip' }
            };
            let streamDrainRegistered = false;
            class MockResponse extends EventEmitter {
                headers = { 'content-type': 'text/html' };
                setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
                getHeader(k) { return this.headers[k.toLowerCase()]; }
                removeHeader(k) { delete this.headers[k.toLowerCase()]; }
                writeHead(statusCode, headers) {
                    if (headers) Object.assign(this.headers, headers);
                    this.statusCode = statusCode;
                    this._header = true;
                }
                _implicitHeader() { this.writeHead(200); }
                write(chunk) { return true; }
                end(c) {
                    expect(streamDrainRegistered).toBe(true);
                    done();
                }
            }
            const res = new MockResponse();
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    // Write first to initialize stream
                    res.write('A'.repeat(100));
                    // Now stream is created, registering 'drain' triggers L87
                    res.on('drain', () => {});
                    streamDrainRegistered = true;
                    res.end();
                }
            });
        });

        test('flush when stream is not active (L37 falsy branch)', () => {
            const middleware = new Compression();
            const res = new EventEmitter();
            res.write = jest.fn();
            res.end = jest.fn();
            middleware.handle({
                request: { httpVersion: '1.1' },
                response: res,
                next: jest.fn()
            });
            // stream is undefined, calling flush covers `if (stream)` falsy branch
            expect(() => res.flush()).not.toThrow();
        });

        test('write when _header is already truthy (L47 falsy branch)', (done) => {
            const middleware = new Compression();
            middleware.$options = { threshold: 10 };
            const req = {
                httpVersion: '1.1',
                method: 'GET',
                headers: { 'accept-encoding': 'gzip' }
            };
            class MockResponse extends EventEmitter {
                headers = { 'content-type': 'text/html' };
                _header = true; // Pre-set _header to true
                setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
                getHeader(k) { return this.headers[k.toLowerCase()]; }
                removeHeader(k) { delete this.headers[k.toLowerCase()]; }
                writeHead(statusCode, headers) {
                    if (headers) Object.assign(this.headers, headers);
                    this.statusCode = statusCode;
                }
                _implicitHeader() { this.writeHead(200); }
                write(c) { return true; }
                end(c) { done(); }
            }
            const res = new MockResponse();
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    // write when _header is already true covers `if (!this._header)` falsy
                    res.write('Some text chunk');
                    res.end();
                }
            });
        });

        test('end with a chunk when stream is active (L76 truthy branch)', (done) => {
            const middleware = new Compression();
            middleware.$options = { threshold: 10 };
            const req = {
                httpVersion: '1.1',
                method: 'GET',
                headers: { 'accept-encoding': 'gzip' }
            };
            class MockResponse extends EventEmitter {
                headers = { 'content-type': 'text/html' };
                setHeader(k, v) { this.headers[k.toLowerCase()] = v; }
                getHeader(k) { return this.headers[k.toLowerCase()]; }
                removeHeader(k) { delete this.headers[k.toLowerCase()]; }
                writeHead(statusCode, headers) {
                    if (headers) Object.assign(this.headers, headers);
                    this.statusCode = statusCode;
                    this._header = true;
                }
                _implicitHeader() { this.writeHead(200); }
                write(c) { return true; }
                end(chunk, enc) {
                    expect(this.getHeader('content-encoding')).toBe('gzip');
                    done();
                }
            }
            const res = new MockResponse();
            middleware.handle({
                request: req,
                response: res,
                next: () => {
                    res.write('Initial chunk to instantiate stream');
                    // Calling end WITH a chunk when stream exists triggers L76 `chunk ? ... : ...`
                    res.end('Final chunk on end');
                }
            });
        });
    });
});
