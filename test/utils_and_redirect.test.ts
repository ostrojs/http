const _utils = require('../src/utils');
const utils = _utils.default || _utils;
const _HttpContext = require('../src/httpContext');
const HttpContext = _HttpContext.default || _HttpContext;
const _RedirectResponse = require('../src/redirectResponse');
const RedirectResponse = _RedirectResponse.default || _RedirectResponse;
const EventEmitter = require('events');

describe('Utils, HttpContext & RedirectResponse', () => {
    describe('utils.js', () => {
        test('isAbsolute', () => {
            expect(utils.isAbsolute('/foo/bar')).toBe(true);
            expect(utils.isAbsolute('C:\\foo\\bar')).toBe(true);
            expect(utils.isAbsolute('C:/foo/bar')).toBe(true);
            expect(utils.isAbsolute('\\\\server\\share')).toBe(true);
            expect(utils.isAbsolute('relative/path')).toBeUndefined();
        });

        test('acceptParams and normalizeType', () => {
            const parsed = utils.acceptParams('text/html; level=1; q=0.8', 2);
            expect(parsed).toEqual({
                value: 'text/html',
                quality: 0.8,
                params: { level: '1' },
                originalIndex: 2
            });

            const parsedNoQ = utils.acceptParams('text/plain; charset=utf-8', 0);
            expect(parsedNoQ.quality).toBe(1);
            expect(parsedNoQ.params).toEqual({ charset: 'utf-8' });

            const norm1 = utils.normalizeType('text/html');
            expect(norm1.value).toBe('text/html');

            const norm2 = utils.normalizeType('json');
            expect(norm2.value).toBe('application/json');

            const normMulti = utils.normalizeTypes(['json', 'text/html']);
            expect(normMulti.length).toBe(2);
            expect(normMulti[0].value).toBe('application/json');
            expect(normMulti[1].value).toBe('text/html');
        });

        test('setCharset', () => {
            expect(utils.setCharset(null, 'utf-8')).toBe(null);
            expect(utils.setCharset('text/html', null)).toBe('text/html');
            expect(utils.setCharset('text/html', 'utf-8')).toBe('text/html; charset=utf-8');
            expect(utils.setCharset('text/html; charset=iso-8859-1', 'utf-8')).toBe('text/html; charset=utf-8');
        });

        test('compileTrust', () => {
            const customFn = (ip) => ip === '127.0.0.1';
            expect(utils.compileTrust(customFn)).toBe(customFn);

            const trustAll = utils.compileTrust(true);
            expect(trustAll()).toBe(true);

            const trustHop = utils.compileTrust(1);
            expect(trustHop('127.0.0.1', 0)).toBe(true);
            expect(trustHop('127.0.0.1', 1)).toBe(false);

            const trustStr = utils.compileTrust('127.0.0.1, 10.0.0.1');
            expect(typeof trustStr).toBe('function');

            const trustDefault = utils.compileTrust();
            expect(typeof trustDefault).toBe('function');
        });

        test('stringify', () => {
            expect(utils.stringify({ a: 1 })).toBe('{"a":1}');
            expect(utils.stringify({ a: 1 }, null, 2)).toBe('{\n  "a": 1\n}');
            expect(utils.stringify({ tag: '<script>alert("x&y")</script>' }, null, 0, true))
                .toContain('\\u003cscript\\u003ealert(\\"x\\u0026y\\")\\u003c/script\\u003e');
            expect(utils.stringify('other chars', null, 0, true)).toBe('"other chars"');
        });

        test('sendfile lifecycle and error cases', async () => {
            class MockFile extends EventEmitter {
                pipe(dest) {
                    this.dest = dest;
                }
            }
            class MockRes extends EventEmitter {
                constructor() {
                    super();
                    this.finished = false;
                    this.headers = {};
                }
                setHeader(k, v) {
                    this.headers[k] = v;
                }
            }

            function runSendfile(options = {}, trigger) {
                return new Promise((resolve) => {
                    const file = new MockFile();
                    const res = new MockRes();
                    utils.sendfile(res, file, options, (err) => {
                        resolve({ err, file, res });
                    });
                    trigger(file, res);
                });
            }

            // Case 1: normal onfile and onend with headers
            const c1 = await runSendfile({ headers: { 'X-Custom': 'val' } }, (f, r) => {
                f.emit('headers', r);
                f.emit('file');
                f.emit('end');
            });
            expect(c1.err).toBeUndefined();
            expect(c1.res.headers['X-Custom']).toBe('val');

            // Case 2: onfinish normal streaming=false
            const c2 = await runSendfile({}, (f, r) => {
                f.emit('file');
                r.emit('finish');
            });
            expect(c2.err).toBeUndefined();

            // Case 3: socket close (aborted)
            const c3 = await runSendfile({}, (f, r) => {
                const socket = new EventEmitter();
                r.emit('socket', socket);
                socket.emit('close');
            });
            expect(c3.err.code).toBe('ECONNABORTED');

            // Case 4: directory
            const c4 = await runSendfile({}, (f) => {
                f.emit('directory');
            });
            expect(c4.err.code).toBe('EISDIR');

            // Case 5: file error
            const c5 = await runSendfile({}, (f) => {
                f.emit('error', new Error('file err'));
            });
            expect(c5.err.message).toBe('file err');

            // Case 6: onfinish ECONNRESET
            const c6 = await runSendfile({}, (f, r) => {
                const err = new Error('conn reset');
                err.code = 'ECONNRESET';
                r.__onFinished(err);
            });
            expect(c6.err.code).toBe('ECONNABORTED');

            // Case 7: onfinish other error
            const c7 = await runSendfile({}, (f, r) => {
                r.__onFinished(new Error('finish err'));
            });
            expect(c7.err.message).toBe('finish err');

            // Case 8: onfinish streaming !== false (aborted)
            const c8 = await runSendfile({}, (f, r) => {
                f.emit('stream');
                r.emit('finish');
            });
            expect(c8.err.code).toBe('ECONNABORTED');

            // Case 9: already done when onaborted (via ECONNRESET in onfinish), ondirectory, onerror, onend fire
            await runSendfile({}, (f, r) => {
                // First end fires callback and marks done = true
                f.emit('file');
                f.emit('end');
                // Triggering again exercises `if (done) return`
                f.emit('end');
                f.emit('directory');
                f.emit('error', new Error('secondary err'));
                // onfinish with ECONNRESET when done is true hits onaborted -> `if (done) return`
                const rawOnFinish = r.__onFinished.queue[0];
                const errReset = new Error('reset');
                errReset.code = 'ECONNRESET';
                rawOnFinish(errReset);
                // onfinish without error when done is true hits L134 `if (done) return`
                rawOnFinish(null);
            });

            // Case 10: onfinish setImmediate when done becomes true before immediate runs
            await new Promise((resolve) => {
                const file = new MockFile();
                const res = new MockRes();
                utils.sendfile(res, file, {}, () => {});
                file.emit('file'); // streaming = false
                res.emit('finish'); // schedules setImmediate
                file.emit('end'); // done becomes true synchronously
                setImmediate(resolve); // wait for setImmediate to execute and hit `if (done) return`
            });
        });
    });

    describe('HttpContext', () => {
        test('wraps request and response, handles url and next', () => {
            const req = { url: '/test/path?q=1' };
            const res = { redirect: jest.fn() };
            const next = jest.fn();

            const context = new HttpContext(req, res, next);
            expect(context.request).toBe(req);
            expect(context.response).toBe(res);
            expect(req._parsedUrl).toBeDefined();

            // Re-instantiate when _parsedUrl is already an object
            const context2 = new HttpContext(req, res, next);
            expect(context2.request._parsedUrl).toBe(req._parsedUrl);

            // next
            context.setCurrentNext(next);
            context.next('arg1', 'arg2');
            expect(next).toHaveBeenCalledWith('arg1', 'arg2');

            // url getter
            expect(context.url.$url).toBe(req._parsedUrl);
            expect(context.url.segment(1)).toBe('test');

            // redirect getter
            const redir = context.redirect;
            expect(redir).toBeInstanceOf(RedirectResponse);
        });
    });

    describe('RedirectResponse', () => {
        test('methods set and return properties correctly', (done) => {
            const res = {
                request: { session: true },
                with: jest.fn().mockReturnThis(),
                withErrors: jest.fn().mockReturnThis(),
                withInput: jest.fn().mockReturnThis(),
                redirect: jest.fn()
            };

            const redirect = new RedirectResponse(res);
            redirect.with('status', 'Success')
                .withErrors('Invalid email')
                .withInput('username');

            expect(redirect.getFlash()).toEqual(['status', 'Success']);
            expect(redirect.getErrors()).toEqual(['Invalid email']);
            expect(redirect.getInputs()).toEqual(['username']);
            expect(redirect.wantedInput()).toBe(1);

            // Default withInput
            const redir2 = new RedirectResponse(res);
            redir2.withInput();
            expect(redir2.getInputs()).toEqual([true]);

            // away
            redirect.away('https://example.com');
            expect(res.redirect).toHaveBeenCalledWith('https://example.com');

            // to() triggers nextTick
            redirect.to('/dashboard');
            expect(redirect.getUrl()).toBe('/dashboard');

            process.nextTick(() => {
                expect(res.with).toHaveBeenCalled();
                expect(res.withErrors).toHaveBeenCalled();
                expect(res.withInput).toHaveBeenCalled();
                expect(res.redirect).toHaveBeenCalledWith('/dashboard');

                // test to() without response
                const redirNoRes = new RedirectResponse(null);
                redirNoRes.to('/login');
                expect(redirNoRes.getUrl()).toBe('/login');

                // test back()
                const redirBack = new RedirectResponse(res);
                redirBack.back();
                expect(redirBack.getUrl()).toBe('back');

                const redirBackNoRes = new RedirectResponse(null);
                redirBackNoRes.back();
                expect(redirBackNoRes.getUrl()).toBe('back');

                // test route()
                global.app = jest.fn().mockReturnValue({
                    route: jest.fn().mockReturnValue('/users/10')
                });
                const redirRoute = new RedirectResponse(res);
                redirRoute.route('users.show', 10);
                expect(redirRoute.getUrl()).toBe('/users/10');

                // static __get proxy access
                const customRedirectMethod = RedirectResponse.to;
                expect(typeof customRedirectMethod).toBe('function');

                done();
            });
        });

        test('to() when request has no session', (done) => {
            const res = {
                request: {},
                with: jest.fn().mockReturnThis(),
                withErrors: jest.fn().mockReturnThis(),
                withInput: jest.fn().mockReturnThis(),
                redirect: jest.fn()
            };
            const redirect = new RedirectResponse(res);
            redirect.to('/home');
            process.nextTick(() => {
                expect(res.with).not.toHaveBeenCalled();
                expect(res.redirect).toHaveBeenCalledWith('/home');
                done();
            });
        });
    });
});
