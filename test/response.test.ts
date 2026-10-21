const _HttpResponse = require('../src/response');
const HttpResponse = _HttpResponse.default || _HttpResponse;
const http = require('http');
const path = require('path');
const fs = require('fs');
const { PassThrough } = require('stream');

describe('HttpResponse', () => {
    function createMockRawRes(reqOverrides = {}) {
        const stream = new PassThrough();
        const headers = {};
        const req = {
            method: 'GET',
            headers: {},
            accepts: jest.fn((types) => types[0]),
            get: jest.fn((k) => req.headers[k ? k.toLowerCase() : '']),
            ...reqOverrides
        };
        const rawRes = Object.assign(stream, {
            statusCode: 200,
            headers,
            finished: false,
            getHeader: jest.fn((k) => headers[k.toLowerCase()]),
            setHeader: jest.fn((k, v) => { headers[k.toLowerCase()] = v; }),
            removeHeader: jest.fn((k) => { delete headers[k.toLowerCase()]; }),
            request: req,
            connection: { encrypted: false },
            socket: {
                writable: true,
                on: jest.fn(),
                removeListener: jest.fn(),
                emit: jest.fn()
            }
        });
        const origEnd = stream.end.bind(stream);
        rawRes.end = jest.fn((...args) => {
            rawRes.finished = true;
            const res = origEnd(...args);
            rawRes.emit('finish');
            return res;
        });
        return { rawRes, req };
    }

    test('constructor and response() getter', () => {
        const { rawRes } = createMockRawRes();
        const res = new HttpResponse(rawRes);
        expect(res.response()).toBe(rawRes);
    });

    test('links() sets Link header', () => {
        const { rawRes } = createMockRawRes();
        const res = new HttpResponse(rawRes);
        res.links({
            next: 'http://api.example.com/users?page=2',
            last: 'http://api.example.com/users?page=5'
        });
        expect(res.header('Link')).toContain('<http://api.example.com/users?page=2>; rel="next"');
    });

    test('send() with different payload types: string, buffer, number, boolean, null, object', () => {
        const { rawRes } = createMockRawRes();
        const res = new HttpResponse(rawRes);

        // String
        res.send('Hello World');
        expect(rawRes.end).toHaveBeenCalled();
        expect(res.header('Content-Type')).toContain('text/html');

        // Status as first argument, string as second
        const res2 = new HttpResponse(createMockRawRes().rawRes);
        res2.send(201, 'Created message');
        expect(res2.statusCode).toBe(201);

        // String first, status second
        const res3 = new HttpResponse(createMockRawRes().rawRes);
        res3.send('OK message', 200);
        expect(res3.statusCode).toBe(200);

        // Single number (status code)
        const res4 = new HttpResponse(createMockRawRes().rawRes);
        res4.send(404);
        expect(res4.statusCode).toBe(404);
        expect(res4.header('Content-Type')).toContain('text/plain');

        // Buffer
        const res5 = new HttpResponse(createMockRawRes().rawRes);
        res5.send(Buffer.from('binary data'));
        expect(res5.header('Content-Type')).toContain('application/octet-stream');

        // Null
        const res6 = new HttpResponse(createMockRawRes().rawRes);
        res6.send(null);
        expect(res6.statusCode).toBe(200);

        // Object (triggers json)
        const res7 = new HttpResponse(createMockRawRes().rawRes);
        res7.send({ message: 'json' }, 202);
        expect(res7.statusCode).toBe(202);
        expect(res7.header('Content-Type')).toContain('application/json');

        // 204 No Content removes content-type and content-length
        const res8 = new HttpResponse(createMockRawRes().rawRes);
        res8.statusCode = 204;
        res8.send('');
        expect(res8.header('Content-Type')).toBeUndefined();
    });

    test('send() with HEAD request', () => {
        const { rawRes } = createMockRawRes({ method: 'HEAD' });
        const res = new HttpResponse(rawRes);
        res.method = 'HEAD';
        res.send('Should not send body on head');
        expect(rawRes.headers['content-length']).toBeDefined();
    });

    test('send() with freshness sets 304', () => {
        const { rawRes } = createMockRawRes();
        const res = new HttpResponse(rawRes);
        res.fresh = true;
        res.send('content');
        expect(res.statusCode).toBe(304);
    });

    test('jsonp() with callback, numeric status, array callback, and sanitize', () => {
        const { rawRes } = createMockRawRes();
        const res = new HttpResponse(rawRes);

        res.jsonp({ data: 'item' }, 'myCallback', 201);
        expect(res.statusCode).toBe(201);
        expect(res.header('Content-Type')).toContain('text/javascript');

        // jsonp with array callback
        const res2 = new HttpResponse(createMockRawRes().rawRes);
        res2.jsonp({ data: 'item' }, ['cbArr']);
        expect(res2.header('Content-Type')).toContain('text/javascript');

        // jsonp without callback
        const res3 = new HttpResponse(createMockRawRes().rawRes);
        res3.jsonp({ data: 'item' });
        expect(res3.header('Content-Type')).toContain('application/json');

        // contentType alias
        res3.contentType('json');
        expect(res3.header('Content-Type')).toContain('application/json');
    });

    test('sendStatus()', () => {
        const { rawRes } = createMockRawRes();
        const res = new HttpResponse(rawRes);
        res.sendStatus(404);
        expect(res.statusCode).toBe(404);
    });

    test('format() content negotiation and error', () => {
        const { rawRes, req } = createMockRawRes();
        const res = new HttpResponse(rawRes);
        const textFn = jest.fn();
        const htmlFn = jest.fn();
        const defaultFn = jest.fn();

        req.accepts.mockReturnValue('html');
        res.format({
            text: textFn,
            html: htmlFn,
            default: defaultFn
        });
        expect(htmlFn).toHaveBeenCalled();

        // format with fallback default
        req.accepts.mockReturnValue(false);
        const res2 = new HttpResponse(createMockRawRes().rawRes);
        res2.request = req;
        res2.format({
            text: textFn,
            default: defaultFn
        });
        expect(defaultFn).toHaveBeenCalled();

        // format without match and without default (406 Not Acceptable)
        const nextFn = jest.fn();
        req.next = nextFn;
        const res3 = new HttpResponse(createMockRawRes().rawRes);
        res3.request = req;
        res3.format({ text: textFn });
        expect(nextFn).toHaveBeenCalled();
        expect(nextFn.mock.calls[0][0].status).toBe(406);
    });

    test('attachment(), append(), header(), get()', () => {
        const { rawRes } = createMockRawRes();
        const res = new HttpResponse(rawRes);

        res.attachment('report.pdf');
        expect(res.header('Content-Disposition')).toContain('attachment');
        expect(res.header('Content-Type')).toContain('application/pdf');

        res.append('X-Custom', 'one');
        res.append('X-Custom', 'two');
        expect(res.header('X-Custom')).toEqual(['one', 'two']);

        res.append('X-Another', ['a', 'b']);
        expect(res.header('X-Another')).toEqual(['a', 'b']);

        // get() alias
        expect(res.get('X-Custom')).toEqual(['one', 'two']);

        // header error when Content-Type is array
        expect(() => {
            res.header('Content-Type', ['text/html']);
        }).toThrow(TypeError);
    });

    test('location() and redirect()', () => {
        const { rawRes, req } = createMockRawRes();
        const res = new HttpResponse(rawRes);
        res.request = req;

        res.location('/login');
        expect(res.header('Location')).toBe('/login');

        // location back with Referrer
        req.headers.referrer = '/previous';
        res.location('back');
        expect(res.header('Location')).toBe('/previous');

        // location back without Referrer
        delete req.headers.referrer;
        res.location('back');
        expect(res.header('Location')).toBe('/');

        // redirect()
        res.redirect('/home');
        expect(res.statusCode).toBe(302);
        expect(res.header('Location')).toBe('/home');

        // redirect() with accepts html
        const { rawRes: rawHtmlRes, req: reqHtml } = createMockRawRes();
        reqHtml.accepts.mockReturnValue('html');
        const resHtml = new HttpResponse(rawHtmlRes);
        resHtml.request = reqHtml;
        resHtml.redirect('/home');
        expect(resHtml.header('Location')).toBe('/home');

        // redirect() with default fallback (accepts returns false)
        const { rawRes: rawDefRes, req: reqDef } = createMockRawRes();
        reqDef.accepts.mockReturnValue(false);
        const resDef = new HttpResponse(rawDefRes);
        resDef.request = reqDef;
        resDef.redirect('/home');
        expect(resDef.header('Location')).toBe('/home');

        // redirect() empty
        const resEmpty = new HttpResponse(createMockRawRes().rawRes);
        expect(resEmpty.redirect()).toBe(resEmpty);

        // redirect() on HEAD request
        const { rawRes: rawHead, req: reqHead } = createMockRawRes({ method: 'HEAD' });
        const resHead = new HttpResponse(rawHead);
        resHead.request = reqHead;
        resHead.redirect('/home');
        expect(rawHead.end).toHaveBeenCalled();

        // to() and back() aliases
        const resTo = new HttpResponse(createMockRawRes().rawRes);
        resTo.request = req;
        resTo.to('/other');
        expect(resTo.header('Location')).toBe('/other');

        const resBack = new HttpResponse(createMockRawRes().rawRes);
        resBack.request = req;
        resBack.back();
        expect(resBack.header('Location')).toBe('/');
    });

    test('HTTP status convenience helper methods', () => {
        const { rawRes } = createMockRawRes();
        const res = new HttpResponse(rawRes);

        const statusChecks = [
            ['continue', 100],
            ['switchingProtocols', 101],
            ['ok', 200],
            ['created', 201],
            ['accepted', 202],
            ['nonAuthoritativeInformation', 203],
            ['noContent', 204],
            ['resetContent', 205],
            ['partialContent', 206],
            ['multipleChoices', 300],
            ['movedPermanently', 301],
            ['movedTemporarily', 302],
            ['seeOther', 303],
            ['notModified', 304],
            ['useProxy', 305],
            ['temporaryRedirect', 307],
            ['badRequest', 400],
            ['unauthorized', 401],
            ['paymentRequired', 402],
            ['forbidden', 403],
            ['notFound', 404],
            ['methodNotAllowed', 405],
            ['notAcceptable', 406],
            ['proxyAuthenticationRequired', 407],
            ['requestTimeout', 408],
            ['conflict', 409],
            ['gone', 410],
            ['lengthRequired', 411],
            ['preconditionFailed', 412],
            ['requestEntityTooLarge', 413],
            ['requestUriTooLong', 414],
            ['unsupportedMediaType', 415],
            ['requestedRangeNotSatisfiable', 416],
            ['expectationFailed', 417],
            ['unprocessableEntity', 422],
            ['tooManyRequests', 429],
            ['internalServerError', 500],
            ['notImplemented', 501],
            ['badGateway', 502],
            ['serviceUnavailable', 503],
            ['gatewayTimeout', 504],
            ['httpVersionNotSupported', 505],
        ];

        for (const [methodName, expectedCode] of statusChecks) {
            const r = new HttpResponse(createMockRawRes().rawRes);
            r[methodName]({ test: true });
            expect(r.statusCode).toBe(expectedCode);
        }
    });

    test('vary() helper', () => {
        const { rawRes } = createMockRawRes();
        const res = new HttpResponse(rawRes);
        res.vary('Accept');
        expect(res.vary()).toBe(res);
        expect(res.vary([])).toBe(res);
    });

    test('sendFile() and download() validation and paths', async () => {
        const { rawRes, req } = createMockRawRes();
        const res = new HttpResponse(rawRes);
        res.request = req;

        expect(() => res.sendFile()).toThrow(TypeError);
        expect(() => res.sendFile(123)).toThrow(TypeError);
        expect(() => res.sendFile('relative/file.txt')).toThrow(TypeError);

        const dummyFile = path.join(__dirname, 'exceptions_and_resources.test.ts');
        await new Promise((resolve) => {
            res.sendFile(dummyFile, (err) => {
                expect(err).toBeFalsy();
                resolve();
            });
        });

        // download()
        const resDownload = new HttpResponse(createMockRawRes().rawRes);
        resDownload.request = req;
        await new Promise((resolve) => {
            resDownload.download(dummyFile, 'customName.js', { headers: { 'X-Test': '1' } }, (err) => {
                expect(err).toBeFalsy();
                resolve();
            });
        });

        // sendFile on directory without done (calls next())
        const nextMock = jest.fn();
        req.next = nextMock;
        const resDir = new HttpResponse(createMockRawRes().rawRes);
        resDir.request = req;
        await new Promise((resolve) => {
            nextMock.mockImplementationOnce(() => resolve());
            resDir.sendFile(__dirname);
        });
        expect(nextMock).toHaveBeenCalled();

        // sendFile on nonexistent file without done (calls next(err))
        const resErr = new HttpResponse(createMockRawRes().rawRes);
        resErr.request = req;
        await new Promise((resolve) => {
            nextMock.mockImplementationOnce((err) => {
                expect(err).toBeDefined();
                resolve();
            });
            resErr.sendFile(path.join(__dirname, 'non_existent_file_12345.txt'));
        });
    });

    test('toJSON and __get/__set proxies', () => {
        const { rawRes } = createMockRawRes();
        rawRes.customProp = 'existingValue';
        const res = new HttpResponse(rawRes);

        // proxy get & set
        expect(res.customProp).toBe('existingValue');
        res.customProp = 'updatedValue';
        expect(rawRes.customProp).toBe('updatedValue');

        res.newTargetProp = 'targetVal';
        expect(res.newTargetProp).toBe('targetVal');

        // toJSON
        res.id = () => 'req-1';
        res.url = () => '/api/test';
        res.parsedUrl = { query: 'a=1' };
        res.all = () => ({ a: 1 });
        res.params = () => ({});
        res.headers = () => ({});
        res.method = () => 'GET';
        res.protocol = () => 'https';
        res.cookiesList = () => ({});
        res.hostname = () => 'example.com';
        res.ip = () => '127.0.0.1';

        const json = res.toJSON();
        expect(json.id).toBe('req-1');
        expect(json.hostname).toBe('example.com');
    });

    test('additional branches in response.js', async () => {
        // links() with existing link header
        const { rawRes: rawLinks } = createMockRawRes();
        const resLinks = new HttpResponse(rawLinks);
        resLinks.header('Link', '<http://example.com>; rel="prev"');
        resLinks.links({ next: 'http://example.com/next' });
        expect(resLinks.header('Link')).toContain('<http://example.com>; rel="prev", <http://example.com/next>; rel="next"');

        // send() with single number and Content-Type already set
        const resNumCt = new HttpResponse(createMockRawRes().rawRes);
        resNumCt.header('Content-Type', 'text/custom');
        resNumCt.send(404);
        expect(resNumCt.header('Content-Type')).toBe('text/custom; charset=utf-8');

        // send() with buffer and Content-Type already set
        const resBufCt = new HttpResponse(createMockRawRes().rawRes);
        resBufCt.header('Content-Type', 'image/png');
        resBufCt.send(Buffer.from('pngdata'));
        expect(resBufCt.header('Content-Type')).toBe('image/png');

        // send() with chunk undefined
        const resUndef = new HttpResponse(createMockRawRes().rawRes);
        resUndef.send(undefined);
        expect(resUndef.header('Content-Length')).toBeUndefined();

        // send() with boolean and number
        const resBool = new HttpResponse(createMockRawRes().rawRes);
        resBool.send(true);
        expect(resBool.statusCode).toBe(200);

        const resNum = new HttpResponse(createMockRawRes().rawRes);
        resNum.send(12345, 200);
        expect(resNum.statusCode).toBe(200);

        // json() with Content-Type already set
        const resJsonCt = new HttpResponse(createMockRawRes().rawRes);
        resJsonCt.header('Content-Type', 'application/vnd.api+json');
        resJsonCt.json({ ok: true });
        expect(resJsonCt.header('Content-Type')).toBe('application/vnd.api+json; charset=utf-8');

        // jsonp() with Content-Type already set
        const resJsonpCt = new HttpResponse(createMockRawRes().rawRes);
        resJsonpCt.header('Content-Type', 'application/problem+json');
        resJsonpCt.jsonp({ error: 'fail' });
        expect(resJsonpCt.header('Content-Type')).toBe('application/problem+json; charset=utf-8');

        // sendStatus() with custom non-standard status code
        const resStatus = new HttpResponse(createMockRawRes().rawRes);
        resStatus.sendStatus(999);
        expect(resStatus.statusCode).toBe(999);

        // type() with slash already present
        const resTypeSlash = new HttpResponse(createMockRawRes().rawRes);
        resTypeSlash.type('application/xml');
        expect(resTypeSlash.header('Content-Type')).toContain('application/xml');

        // format() with empty object (keys.length === 0)
        const { rawRes: rawFmt, req: reqFmt } = createMockRawRes();
        const resFmt = new HttpResponse(rawFmt);
        resFmt.request = reqFmt;
        const nextFmt = jest.fn();
        reqFmt.next = nextFmt;
        resFmt.format({});
        expect(nextFmt).toHaveBeenCalled();
        expect(nextFmt.mock.calls[0][0].status).toBe(406);

        // attachment() without filename
        const resAttachNoFile = new HttpResponse(createMockRawRes().rawRes);
        resAttachNoFile.attachment();
        expect(resAttachNoFile.header('Content-Disposition')).toBe('attachment');

        // append() when prev is array
        const resAppArr = new HttpResponse(createMockRawRes().rawRes);
        resAppArr.header('X-List', ['a', 'b']);
        resAppArr.append('X-List', 'c');
        expect(resAppArr.header('X-List')).toEqual(['a', 'b', 'c']);

        // append() when val is array and prev is string
        const resAppValArr = new HttpResponse(createMockRawRes().rawRes);
        resAppValArr.header('X-Single', 'first');
        resAppValArr.append('X-Single', ['second', 'third']);
        expect(resAppValArr.header('X-Single')).toEqual(['first', 'second', 'third']);

        // download() without filename argument (falls back to path) and with content-disposition header in options
        const resDlPath = new HttpResponse(createMockRawRes().rawRes);
        resDlPath.request = createMockRawRes().req;
        const dummyFile = path.join(__dirname, 'exceptions_and_resources.test.ts');
        await new Promise((resolve) => {
            resDlPath.download(dummyFile, {
                headers: {
                    'Content-Disposition': 'inline',
                    'X-Custom': 'val'
                }
            }, (err) => {
                expect(err).toBeFalsy();
                resolve();
            });
        });

        // download() without options (options is falsy)
        const resDlNoOpts = new HttpResponse(createMockRawRes().rawRes);
        resDlNoOpts.request = createMockRawRes().req;
        await new Promise((resolve) => {
            resDlNoOpts.download(dummyFile, 'downloaded.js', (err) => {
                expect(err).toBeFalsy();
                resolve();
            });
        });

        // sendFile with error syscall write or ECONNABORTED
        const { rawRes: rawSf, req: reqSf } = createMockRawRes();
        const nextSf = jest.fn();
        reqSf.next = nextSf;
        rawSf.request = reqSf;
        const resSf = new HttpResponse(rawSf);
        Object.defineProperty(resSf, 'request', { value: reqSf, writable: true, configurable: true });

        // Mock sendfile utils to return error with syscall === 'write' or code === 'ECONNABORTED'
        const _utils = require('../src/utils');
const utils = _utils.default || _utils;
        const origSendfile = utils.sendfile;
        utils.sendfile = (res, file, opts, cb) => {
            const err = new Error('write failed');
            err.syscall = 'write';
            cb(err);
        };
        resSf.sendFile(dummyFile);
        expect(nextSf).not.toHaveBeenCalled();

        utils.sendfile = (res, file, opts, cb) => {
            const err = new Error('aborted');
            err.code = 'ECONNABORTED';
            cb(err);
        };
        resSf.sendFile(dummyFile);
        expect(nextSf).not.toHaveBeenCalled();

        // sendFile with err having code !== 'ECONNABORTED' and syscall === undefined (calls next(err))
        utils.sendfile = (res, file, opts, cb) => {
            const err = new Error('generic read failure');
            err.code = 'EOTHER';
            cb(err);
        };
        resSf.sendFile(dummyFile);
        expect(nextSf).toHaveBeenCalledWith(expect.objectContaining({ message: 'generic read failure' }));

        // sendFile without error and without done callback
        utils.sendfile = (res, file, opts, cb) => {
            cb();
        };
        resSf.sendFile(dummyFile);

        // Restore utils.sendfile
        utils.sendfile = origSendfile;
    });
});
