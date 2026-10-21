const _HttpRequest = require('../src/request');
const HttpRequest = _HttpRequest.default || _HttpRequest;

describe('HttpRequest', () => {
    function createMockRawReq(overrides = {}) {
        return {
            httpVersionMajor: 1,
            httpVersionMinor: 1,
            httpVersion: '1.1',
            complete: true,
            headers: {},
            trailers: {},
            aborted: false,
            upgrade: false,
            url: '/users/42/posts?sort=desc',
            statusCode: 200,
            statusMessage: 'OK',
            method: 'GET',
            connection: {
                remoteAddress: '127.0.0.1',
                encrypted: false
            },
            ...overrides
        };
    }

    test('constructor sets properties and allows request() getter', () => {
        const raw = createMockRawReq();
        const req = new HttpRequest(raw);
        expect(req.request()).toBe(raw);
        expect(req.httpVersion).toBe('1.1');
        expect(req.statusCode).toBe(200);
        expect(req.files).toEqual({});
    });

    test('header and get() handling', () => {
        const raw = createMockRawReq({
            headers: {
                'x-test': 'val',
                'referer': 'https://google.com'
            }
        });
        const req = new HttpRequest(raw);

        expect(req.get('X-Test')).toBe('val');
        expect(req.header('referer')).toBe('https://google.com');
        expect(req.header('referrer')).toBe('https://google.com');
        expect(req.header('missing', 'defaultVal')).toBe('defaultVal');
        expect(req.hasHeader('X-Test')).toBe(true);
        expect(req.hasHeader('X-Missing')).toBe(false);

        // Header with neither referrer nor referer
        const rawNoRef = createMockRawReq({ headers: {} });
        const reqNoRef = new HttpRequest(rawNoRef);
        expect(reqNoRef.header('referer', 'defaultRef')).toBe('defaultRef');

        // Header with referrer but not referer
        const rawOnlyReferrer = createMockRawReq({ headers: { referrer: 'https://ref.com' } });
        const reqOnlyReferrer = new HttpRequest(rawOnlyReferrer);
        expect(reqOnlyReferrer.header('referer')).toBe('https://ref.com');

        expect(() => req.header('')).toThrow(TypeError);
        expect(() => req.header(123)).toThrow(TypeError);
    });

    test('accepts variants, prefers, getAcceptableContentTypes', () => {
        const raw = createMockRawReq({
            headers: {
                'accept': 'text/html, application/json;q=0.9',
                'content-type': 'text/html; charset=utf-8',
                'content-length': '10',
                'accept-encoding': 'gzip, deflate',
                'accept-charset': 'utf-8',
                'accept-language': 'en;q=0.8, fr'
            }
        });
        const req = new HttpRequest(raw);

        expect(req.accepts('html')).toBe('html');
        expect(req.getAcceptableContentTypes('json')).toBe('json');
        expect(req.acceptsEncodings('gzip')).toBe('gzip');
        expect(req.acceptsCharsets('utf-8')).toBe('utf-8');
        expect(req.acceptsLanguages('fr')).toBe('fr');
        expect(req.prefers('text/html')).toBe('text/html');
    });

    test('range parser', () => {
        const rawNoRange = createMockRawReq();
        const reqNoRange = new HttpRequest(rawNoRange);
        expect(reqNoRange.range(1000)).toBeUndefined();

        const rawWithRange = createMockRawReq({
            headers: { range: 'bytes=0-499' }
        });
        const reqWithRange = new HttpRequest(rawWithRange);
        const ranges = reqWithRange.range(1000);
        expect(ranges[0]).toEqual({ start: 0, end: 499 });
    });

    test('param()', () => {
        const raw = createMockRawReq();
        const req = new HttpRequest(raw);
        req.params = { id: '42' };

        expect(req.param('id')).toBe('42');
        expect(req.param('missing', 'fallback')).toBe('fallback');

        delete req.params;
        expect(req.param('id', 'default')).toBe('default');
    });

    test('is() content-type checking', () => {
        const raw = createMockRawReq({
            headers: {
                'content-type': 'application/json; charset=utf-8',
                'transfer-encoding': 'chunked'
            }
        });
        const req = new HttpRequest(raw);

        expect(req.is('json')).toBe('json');
        expect(req.is(['html', 'json'])).toBe('json');
        expect(req.is('html')).toBe(false);
    });

    test('protocol, secure, ip, ips, hostname, subdomains', () => {
        const raw = createMockRawReq({
            headers: {
                'x-forwarded-proto': 'https, http',
                'x-forwarded-for': '203.0.113.195, 70.41.3.18',
                'x-forwarded-host': 'sub.api.example.com:8080, alt.example.com'
            },
            connection: {
                remoteAddress: '127.0.0.1',
                encrypted: false
            }
        });
        const req = new HttpRequest(raw);
        req.app = { 'trust.proxy': true };

        expect(req.protocol()).toBe('https');
        expect(req.secure()).toBe(true);
        expect(req.ip()).toBeDefined();
        expect(req.ips()).toBeDefined();
        expect(req.hostname()).toBe('sub.api.example.com');
        expect(req.subdomains()).toEqual(['api', 'sub']);

        // Default ip and ips when req.app is not set
        const reqNoApp = new HttpRequest(raw);
        expect(reqNoApp.ip()).toBeDefined();
        expect(reqNoApp.ips()).toBeDefined();

        // Protocol without comma in header
        const rawProtoSingle = createMockRawReq({
            headers: { 'x-forwarded-proto': 'https' },
            connection: { remoteAddress: '127.0.0.1' }
        });
        const reqProtoSingle = new HttpRequest(rawProtoSingle);
        reqProtoSingle.app = { 'trust.proxy': true };
        expect(reqProtoSingle.protocol()).toBe('https');

        // Protocol when header is missing while trusted
        const rawProtoMissing = createMockRawReq({
            headers: {},
            connection: { remoteAddress: '127.0.0.1', encrypted: false }
        });
        const reqProtoMissing = new HttpRequest(rawProtoMissing);
        reqProtoMissing.app = { 'trust.proxy': true };
        expect(reqProtoMissing.protocol()).toBe('http');

        // Untrusted connection for protocol and host (trust.proxy = false)
        const rawUntrusted = createMockRawReq({
            headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'evil.com', host: 'trusted.com' },
            connection: { remoteAddress: '203.0.113.5', encrypted: false }
        });
        const reqUntrusted = new HttpRequest(rawUntrusted);
        expect(reqUntrusted.protocol()).toBe('http');
        expect(reqUntrusted.hostname()).toBe('trusted.com');

        // Forwarded host without comma
        const rawHostSingle = createMockRawReq({
            headers: { 'x-forwarded-host': 'single.example.com' },
            connection: { remoteAddress: '127.0.0.1' }
        });
        const reqHostSingle = new HttpRequest(rawHostSingle);
        reqHostSingle.app = { 'trust.proxy': true };
        expect(reqHostSingle.hostname()).toBe('single.example.com');

        // Encrypted connection without trust
        const rawEncrypted = createMockRawReq({
            headers: {},
            connection: { remoteAddress: '203.0.113.5', encrypted: true }
        });
        const reqEncrypted = new HttpRequest(rawEncrypted);
        expect(reqEncrypted.protocol()).toBe('https');

        // Test with raw IPv6 hostname
        const rawIpv6 = createMockRawReq({
            headers: { host: '[::1]:3000' },
            connection: { remoteAddress: '127.0.0.1' }
        });
        const reqIpv6 = new HttpRequest(rawIpv6);
        expect(reqIpv6.hostname()).toBe('[::1]');

        // IPv4 as hostname
        const rawIpHost = createMockRawReq({
            headers: { host: '127.0.0.1:8000' },
            connection: { remoteAddress: '127.0.0.1' }
        });
        const reqIpHost = new HttpRequest(rawIpHost);
        expect(reqIpHost.hostname()).toBe('127.0.0.1');
        expect(reqIpHost.subdomains()).toEqual([]);

        // Host without port
        const rawNoPort = createMockRawReq({
            headers: { host: 'example.com' },
            connection: { remoteAddress: '127.0.0.1' }
        });
        const reqNoPort = new HttpRequest(rawNoPort);
        expect(reqNoPort.hostname()).toBe('example.com');

        // Empty hostname
        const rawNoHost = createMockRawReq({ headers: {}, connection: { remoteAddress: '127.0.0.1' } });
        const reqNoHost = new HttpRequest(rawNoHost);
        expect(reqNoHost.hostname()).toBeUndefined();
        expect(reqNoHost.subdomains()).toEqual([]);
    });

    test('path, segments, segment, absolute, fullUrl, fullUrlWithQuery, fullUrlIs', () => {
        const raw = createMockRawReq({
            headers: { host: 'example.com' },
            url: '/users/42/profile'
        });
        const req = new HttpRequest(raw);

        expect(req.path()).toBe('/users/42/profile');
        expect(req.segments()).toEqual(['users', '42', 'profile']);
        expect(req.segment(1)).toBe('42');
        expect(req.fullUrl()).toBe('example.com/users/42/profile');
        expect(req.fullUrlWithQuery()).toBe('example.com/users/42/profile');
        expect(req.fullUrlIs('/users/:id/profile')).toBe(true);

        req._parsedUrl = { pathname: '/users/42' };
        expect(req.absolute()).toEqual({ pathname: '/users/42' });
    });

    test('freshness, xhr, ajax, wantJson, expectsJson', () => {
        const raw = createMockRawReq({
            headers: {
                'if-none-match': '"abc"',
                'x-requested-with': 'XMLHttpRequest',
                'accept': 'application/json'
            },
            method: 'GET'
        });
        const req = new HttpRequest(raw);

        const mockRes = {
            statusCode: 200,
            get: (k) => k === 'ETag' ? '"abc"' : null
        };
        expect(req.fresh(mockRes)).toBe(true);

        // Not fresh for POST
        raw.method = 'POST';
        req.method = 'POST';
        expect(req.fresh(mockRes)).toBe(false);

        // Not fresh if status is 500
        raw.method = 'GET';
        req.method = 'GET';
        mockRes.statusCode = 500;
        expect(req.fresh(mockRes)).toBe(false);

        expect(req.xhr()).toBe(true);
        expect(req.ajax()).toBe(true);
        expect(req.wantJson()).toBe(true);
        expect(req.expectsJson()).toBe(true);

        // xhr when header is absent
        const rawNoXhr = createMockRawReq({ headers: {} });
        const reqNoXhr = new HttpRequest(rawNoXhr);
        expect(reqNoXhr.xhr()).toBe(false);

        raw.headers.accept = 'text/html';
        expect(req.wantJson()).toBe(false);

        // wantJson when accept header is undefined
        delete raw.headers.accept;
        expect(req.wantJson()).toBe(false);
    });

    test('input helper methods: all, input, boolean, hasAny, filled, missing, getQuery, getBody, add, only, except, has, whenHas, whenFilled', () => {
        const raw = createMockRawReq();
        const req = new HttpRequest(raw);
        req.query = { page: '1', active: 'true' };
        req.body = { username: 'admin', age: 30 };
        req.files = { avatar: { name: 'pic.png' } };

        expect(req.all()).toEqual({
            page: '1',
            active: 'true',
            username: 'admin',
            age: 30,
            avatar: { name: 'pic.png' }
        });

        expect(req.input('username')).toBe('admin');
        expect(req.input('missing_field', 'default')).toBe('default');

        expect(req.boolean('active')).toBe(true);
        expect(req.boolean('page')).toBe(true); // '1' is in booleanValue
        expect(req.boolean('missing')).toBe(false);

        expect(req.hasAny(['username', 'nonexistent'])).toBe(true);
        expect(req.hasAny(['nonexistent'])).toBe(false);
        expect(req.hasAny()).toBe(false);

        expect(req.filled('username')).toBe(true);
        expect(req.filled('nonexistent')).toBe(false);

        expect(req.missing('nonexistent')).toBe(true);
        expect(req.missing('username')).toBe(false);

        expect(req.getQuery('page')).toBe('1');
        expect(req.getQuery()).toEqual(req.query);
        expect(req.getQuery('other', 'defaultQ')).toBe('defaultQ');

        expect(req.getBody('username')).toBe('admin');
        expect(req.getBody()).toEqual(req.body);
        expect(req.getBody('other', 'defaultB')).toBe('defaultB');

        req.add('newProp', 123);
        expect(req.body.newProp).toBe(123);

        expect(req.only('username', 'age')).toEqual({ username: 'admin', age: 30 });
        expect(req.except('avatar', 'newProp')).not.toHaveProperty('avatar');

        expect(req.has('username')).toBe(true);
        expect(req.has(['username', 'page'])).toBe(true);
        expect(req.has('nonexistent')).toBe(false);

        const doneFn = jest.fn();
        const errFn = jest.fn();
        req.whenHas('username', doneFn, errFn);
        expect(doneFn).toHaveBeenCalledWith('admin');
        expect(errFn).not.toHaveBeenCalled();

        req.whenHas('nonexistent', doneFn, errFn);
        expect(errFn).toHaveBeenCalled();
        req.whenHas('nonexistent'); // test error default
        req.whenHas('username'); // test done default

        const doneFilled = jest.fn();
        const errFilled = jest.fn();
        req.whenFilled('username', doneFilled, errFilled);
        expect(doneFilled).toHaveBeenCalledWith('admin');

        req.whenFilled('emptyField', doneFilled, errFilled);
        expect(errFilled).toHaveBeenCalled();
        req.whenFilled('emptyField'); // test error default
        req.whenFilled('username'); // test done default
    });

    test('files helpers: file, hasFile', () => {
        const raw = createMockRawReq();
        const req = new HttpRequest(raw);
        req.files = { avatar: { name: 'photo.jpg' } };

        expect(req.file('avatar')).toEqual({ name: 'photo.jpg' });
        expect(req.hasFile('avatar')).toBe(true);
        expect(req.hasFile('doc')).toBe(false);
        expect(req.hasFile('doc', true)).toBe(true);
    });

    test('isMethod', () => {
        const raw = createMockRawReq({ method: 'post' });
        const req = new HttpRequest(raw);
        expect(req.isMethod('POST')).toBe(true);
        expect(req.isMethod('get')).toBe(false);

        // isMethod when method is undefined
        delete req.method;
        expect(req.isMethod('GET')).toBe(false);
    });

    test('auth methods: getUser, getPassword, getUserInfo, bearerToken', () => {
        const raw = createMockRawReq({
            headers: {
                'auth_user': 'admin',
                'auth_pw': 'secret',
                'authorization': 'Bearer token12345'
            }
        });
        const req = new HttpRequest(raw);

        expect(req.getUser()).toBe('admin');
        expect(req.getPassword()).toBe('secret');
        expect(req.getUserInfo()).toBe('admin:secret');
        expect(req.bearerToken()).toBe('token12345');

        const rawEmptyPw = createMockRawReq({
            headers: { auth_user: 'admin' }
        });
        const reqEmptyPw = new HttpRequest(rawEmptyPw);
        expect(reqEmptyPw.getUserInfo()).toBe('admin');

        const rawBasic = createMockRawReq({
            headers: { authorization: 'Basic xyz' }
        });
        const reqBasic = new HttpRequest(rawBasic);
        expect(reqBasic.bearerToken()).toBeUndefined();
    });

    test('__get proxy handler fallback', () => {
        const raw = createMockRawReq({
            headers: {},
            customRawProp: 'helloRaw'
        });
        const req = new HttpRequest(raw);
        req.body = { username: 'testuser' };
        req.files = { avatar: 'fileObj' };

        expect(req.username).toBe('testuser');
        expect(req.avatar).toBe('fileObj');
        expect(req.customRawProp).toBe('helloRaw');
    });
});
