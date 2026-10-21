import { Buffer } from 'safe-buffer';
import contentDisposition from 'content-disposition';
import encodeUrl from 'encodeurl';
import escapeHtml from 'escape-html';
import utils, {
    isAbsolute,
    normalizeType,
    normalizeTypes,
    setCharset,
    stringify,
} from './utils';


import { extname, resolve } from 'path';
import statuses from 'statuses';
import send from 'send';
const mime = send.mime;
import vary from 'vary';
import etag from 'etag';
var charsetRegExp = /;\s*charset\s*=/;
const kResponse = Symbol('response');
import { Macroable } from '@ostro/support/macro';
import HttpResponseContract from '@ostro/contracts/http/response';
import type { IHttpResponse } from '@ostro/contracts/http/response';

/**
 * Class HttpResponse.
 */
class HttpResponse extends Macroable.extend(HttpResponseContract) implements IHttpResponse {
    [kResponse]: any;
    [key: string]: any;

    /**
     * Create a new instance.
     * @param {*} res
     */
    constructor(res: any) {
        super();
        Object.defineProperty(this, kResponse, { value: res });
    }

    /**
     * response method.
     * @returns {any}
     */
    public response() {
        return this[kResponse]
    }

    /**
     * links method.
     * @param {*} links
     * @returns {any}
     */
    public links(links: any) {
        var link = this.header('Link') || '';
        if (link) link += ', ';
        return this.header('Link', link + Object.keys(links).map(function (rel) {
            return '<' + links[rel] + '>; rel="' + rel + '"';
        }).join(', '));
    }

    /**
     * send method.
     * @param {*} body
     * @param {*} status
     * @returns {any}
     */
    public send(body: any, status: number = 200) {
        var chunk = body;
        var encoding;
        var type;

        if (arguments.length === 2) {
            if (typeof arguments[0] !== 'number' && typeof arguments[1] === 'number') {
                this.statusCode = arguments[1];
            } else {
                this.statusCode = arguments[0];
                chunk = arguments[1];
            }
        }

        if (typeof chunk === 'number' && arguments.length === 1) {
            if (!this.header('Content-Type')) {
                this.type('txt');
            }

            this.statusCode = chunk;
            chunk = statuses[chunk]
        }

        switch (typeof chunk) {
            case 'string':
                if (!this.header('Content-Type')) {
                    this.type('html');
                }
                break;
            case 'boolean':
            case 'number':
            case 'object':
                if (chunk === null) {
                    chunk = '';
                } else if (Buffer.isBuffer(chunk)) {
                    if (!this.header('Content-Type')) {
                        this.type('bin');
                    }
                } else {
                    return this.json(chunk, status);
                }
                break;
        }

        if (typeof chunk === 'string') {
            encoding = 'utf8';
            type = this.header('Content-Type');

            if (typeof type === 'string') {
                this.header('Content-Type', setCharset(type, 'utf-8'));
            }
        }

        var len
        if (chunk !== undefined) {
            if (Buffer.isBuffer(chunk)) {
                len = chunk.length
            } else {
                chunk = Buffer.from(chunk, encoding)
                encoding = undefined;
                len = chunk.length
            }
            this.header('Content-Length', len);
        }
        if (len !== undefined) {
            this.header('ETag', etag(chunk, { weak: true }));
        }

        if (this.fresh) this.statusCode = 304;

        if (204 === this.statusCode || 304 === this.statusCode) {
            this.removeHeader('Content-Type');
            this.removeHeader('Content-Length');
            this.removeHeader('Transfer-Encoding');
            chunk = '';
        }

        if (this.method === 'HEAD') {
            this.end();

        } else {

            this.end(chunk, encoding);
        }

        return this;
    }

    /**
     * json method.
     * @param {*} obj
     * @param {*} status
     * @returns {any}
     */
    public json(obj: any, status: number = 200) {
        var val = obj;
        this.statusCode = status

        var body = stringify(val)
        if (!this.header('Content-Type')) {
            this.header('Content-Type', 'application/json');
        }

        return this.send(body, status);
    }

    /**
     * jsonp method.
     * @param {*} obj
     * @param {*} rest
     * @returns {any}
     */
    public jsonp(obj: any, ...rest: any[]) {
        rest = Array.from(rest)
        var callback = rest.find(arg => typeof arg == 'string' || Array.isArray(arg));
        this.statusCode = rest.find(arg => typeof arg == 'number') || 200;
        var body = stringify(obj, null, 2, null)
        if (!this.header('Content-Type',)) {
            this.header('X-Content-Type-Options', 'nosniff');
            this.header('Content-Type', 'application/json');
        }
        if (Array.isArray(callback)) {
            callback = callback[0];
        }
        if (typeof callback === 'string' && callback.length !== 0) {
            this.header('X-Content-Type-Options', 'nosniff');
            this.header('Content-Type', 'text/javascript');
            callback = callback.replace(/[^\[\]\w$.]/g, '');
            body = body
                .replace(/\u2028/g, '\\u2028')
                .replace(/\u2029/g, '\\u2029');

            body = '/**/ typeof ' + callback + ' === \'function\' && ' + callback + '(' + body + ');';
        }

        return this.send(body);
    }

    /**
     * sendStatus method.
     * @param {*} statusCode
     * @returns {any}
     */
    public sendStatus(statusCode: any) {
        var body = statuses[statusCode] || String(statusCode)

        this.statusCode = statusCode;
        this.type('txt');

        return this.send(body);
    }

    /**
     * sendFile method.
     * @param {*} path
     * @param {*} options
     * @param {*} callback
     * @returns {any}
     */
    public sendFile(path: string, options: Record<string, any>, callback: Function) {
        var done = callback;
        var req = this.request;
        var res = this;
        var next = req.next;
        var opts = options || {};

        if (!path) {
            throw new TypeError('path argument is required to sendFile');
        }

        if (typeof path !== 'string') {
            throw new TypeError('path must be a string to sendFile')
        }
        if (typeof options === 'function') {
            done = options;
            opts = {};
        }

        if (!opts.root && !isAbsolute(path)) {
            throw new TypeError('path must be absolute or specify root to sendFile');
        }
        var pathname = encodeURI(path);
        var file = send(req, pathname, opts);
        utils.sendfile(res[kResponse], file, opts, function (err) {
            if (done) return done(err);
            if (err && err.code === 'EISDIR') return next();
            if (err && err.code !== 'ECONNABORTED' && err.syscall !== 'write') {
                next(err);
            }
        });

    }

    /**
     * download method.
     * @param {*} path
     * @param {*} rest
     * @returns {any}
     */
    public download(path: string, ...rest: any[]) {
        rest = Array.from(rest)
        let filename = rest.find(arg => typeof arg == 'string')
        let callback = rest.find(arg => typeof arg == 'function')
        let options = rest.find(arg => typeof arg == 'object') || {}

        var headers = {
            'Content-Disposition': contentDisposition(filename || path)
        };

        if (options && options.headers) {
            var keys = Object.keys(options.headers)
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i]
                if (key.toLowerCase() !== 'content-disposition') {
                    headers[key] = options.headers[key]
                }
            }
        }

        options = Object.create(options)
        options.headers = headers
        var fullPath = resolve(path);
        return this.sendFile(fullPath, options, callback)
    }

    /**
     * contentType method.
     * @param {*} type
     * @returns {any}
     */
    public contentType(type: string) {
        return this.type(type)
    }

    /**
     * type method.
     * @param {*} type
     * @returns {any}
     */
    public type(type: string) {
        var ct = type.indexOf('/') === -1 ?
            mime.lookup(type) :
            type;

        return this.header('Content-Type', ct);
    }

    /**
     * format method.
     * @param {*} obj
     * @returns {any}
     */
    public format(obj: any) {
        var req = this.request;
        var next = req.next;

        var fn = obj.default;
        if (fn) delete obj.default;
        var keys = Object.keys(obj);

        var key = keys.length > 0 ?
            req.accepts(keys) :
            false;

        this.vary("Accept");

        if (key) {
            this.header('Content-Type', normalizeType(key).value);
            obj[key](req, this, next);
        } else if (fn) {
            fn();
        } else {
            var err: any = new Error('Not Acceptable');
            err.status = err.statusCode = 406;
            err.types = normalizeTypes(keys).map(function (o) {
                return o.value
            });
            next(err);
        }

        return this;
    }

    /**
     * attachment method.
     * @param {*} filename
     * @returns {any}
     */
    public attachment(filename: any) {
        if (filename) {
            this.type(extname(filename));
        }

        this.header('Content-Disposition', contentDisposition(filename));

        return this;
    }

    /**
     * append method.
     * @param {*} field
     * @param {*} val
     * @returns {any}
     */
    public append(field: string, val: any) {
        var prev = this.header(field);
        var value = val;

        if (prev) {
            value = Array.isArray(prev) ? prev.concat(val) :
                Array.isArray(val) ? [prev].concat(val) : [prev, val];
        }

        return this.header(field, value);
    }

    /**
     * header method.
     * @param {*} field
     * @param {*} val
     * @returns {any}
     */
    public header(field: string, val?: any) {
        if (arguments.length === 2) {
            var value = Array.isArray(val) ?
                val.map(String) :
                String(val);
            if (field.toLowerCase() === 'content-type') {
                if (Array.isArray(value)) {
                    throw new TypeError('Content-Type cannot be set to an Array');
                }
                if (!charsetRegExp.test(value)) {
                    var charset = mime.charsets.lookup(value.split(';')[0]);
                    if (charset) value += '; charset=' + charset.toLowerCase();
                }
            }

            this.setHeader(field, value);
            return this
        } else {
            return this.getHeader(field);
        }
    }

    /**
     * get method.
     * @param {*} field
     * @returns {any}
     */
    get(field: string) {
        return this.getHeader(field);
    }

    /**
     * location method.
     * @param {*} url
     * @returns {any}
     */
    public location(url: string) {
        var loc = url;
        if (url === 'back') {
            loc = this.request.get('Referrer') || '/';
        }
        return this.header('Location', encodeUrl(loc));
    }

    /**
     * vary method.
     * @param {*} field
     * @returns {any}
     */
    public vary(field: string) {
        if (!field || (Array.isArray(field) && !field.length)) {
            return this;
        }

        vary(this, field);

        return this;
    }

    /**
     * redirect method.
     * @param {*} url
     * @returns {any}
     */
    public redirect(url: string) {
        if (!url) {
            return this
        }
        var address = url;
        var body;
        var status = 302;
        address = this.location(address).get('Location');
        this.format({
            text: function () {
                body = statuses[status] + '. Redirecting to ' + address
            },

            html: function () {
                var u = escapeHtml(address);
                body = '<p>' + statuses[status] + '. Redirecting to <a href="' + u + '">' + u + '</a></p>'
            },

            default: function () {
                body = '';
            }
        });
        this.statusCode = status;
        this.header('Content-Length', Buffer.byteLength(body));

        if (this.request.method === 'HEAD') {
            this.end();
        } else {
            this.end(body);
        }
    }

    /**
     * to method.
     * @param {*} url
     * @returns {any}
     */
    public to(url: string) {
        return this.redirect(url)
    }

    /**
     * back method.
     * @returns {any}
     */
    public back() {
        return this.redirect('back')
    }

    /**
     * continue method.
     * @returns {any}
     */
    public continue() {
        return this.send(null, 100);
    }

    /**
     * switchingProtocols method.
     * @returns {any}
     */
    public switchingProtocols() {
        return this.send(null, 101);
    }

    /**
     * ok method.
     * @param {*} body
     * @returns {any}
     */
    public ok(body: any) {
        return this.send(body, 200);
    }

    /**
     * created method.
     * @param {*} body
     * @returns {any}
     */
    public created(body: any) {
        return this.send(body, 201);
    }

    /**
     * accepted method.
     * @param {*} body
     * @returns {any}
     */
    public accepted(body: any) {
        return this.send(body, 202);
    }

    /**
     * nonAuthoritativeInformation method.
     * @param {*} body
     * @returns {any}
     */
    public nonAuthoritativeInformation(body: any) {
        return this.send(body, 203);
    }

    /**
     * noContent method.
     * @returns {any}
     */
    public noContent() {
        return this.send(null, 204);
    }

    /**
     * resetContent method.
     * @returns {any}
     */
    public resetContent() {
        return this.send(null, 205);
    }

    /**
     * partialContent method.
     * @param {*} body
     * @returns {any}
     */
    public partialContent(body: any) {
        return this.send(body, 206);
    }

    /**
     * multipleChoices method.
     * @param {*} body
     * @returns {any}
     */
    public multipleChoices(body: any) {
        return this.send(body, 300);
    }

    /**
     * movedPermanently method.
     * @param {*} body
     * @returns {any}
     */
    public movedPermanently(body: any) {
        return this.send(body, 301);
    }

    /**
     * movedTemporarily method.
     * @param {*} body
     * @returns {any}
     */
    public movedTemporarily(body: any) {
        return this.send(body, 302);
    }

    /**
     * seeOther method.
     * @param {*} body
     * @returns {any}
     */
    public seeOther(body: any) {
        return this.send(body, 303);
    }

    /**
     * notModified method.
     * @param {*} body
     * @returns {any}
     */
    public notModified(body: any) {
        return this.send(body, 304);
    }

    /**
     * useProxy method.
     * @param {*} body
     * @returns {any}
     */
    public useProxy(body: any) {
        return this.send(body, 305);
    }

    /**
     * temporaryRedirect method.
     * @param {*} body
     * @returns {any}
     */
    public temporaryRedirect(body: any) {
        return this.send(body, 307);
    }

    /**
     * badRequest method.
     * @param {*} body
     * @returns {any}
     */
    public badRequest(body: any) {
        return this.send(body, 400);
    }

    /**
     * unauthorized method.
     * @param {*} body
     * @returns {any}
     */
    public unauthorized(body: any) {
        return this.send(body, 401);
    }

    /**
     * paymentRequired method.
     * @param {*} body
     * @returns {any}
     */
    public paymentRequired(body: any) {
        return this.send(body, 402);
    }

    /**
     * forbidden method.
     * @param {*} body
     * @returns {any}
     */
    public forbidden(body: any) {
        return this.send(body, 403);
    }

    /**
     * notFound method.
     * @param {*} body
     * @returns {any}
     */
    public notFound(body: any) {
        return this.send(body, 404);
    }

    /**
     * methodNotAllowed method.
     * @param {*} body
     * @returns {any}
     */
    public methodNotAllowed(body: any) {
        return this.send(body, 405);
    }

    /**
     * notAcceptable method.
     * @param {*} body
     * @returns {any}
     */
    public notAcceptable(body: any) {
        return this.send(body, 406);
    }

    /**
     * proxyAuthenticationRequired method.
     * @param {*} body
     * @returns {any}
     */
    public proxyAuthenticationRequired(body: any) {
        return this.send(body, 407);
    }

    /**
     * requestTimeout method.
     * @param {*} body
     * @returns {any}
     */
    public requestTimeout(body: any) {
        return this.send(body, 408);
    }

    /**
     * conflict method.
     * @param {*} body
     * @returns {any}
     */
    public conflict(body: any) {
        return this.send(body, 409);
    }

    /**
     * gone method.
     * @param {*} body
     * @returns {any}
     */
    public gone(body: any) {
        return this.send(body, 410);
    }

    /**
     * lengthRequired method.
     * @param {*} body
     * @returns {any}
     */
    public lengthRequired(body: any) {
        return this.send(body, 411);
    }

    /**
     * preconditionFailed method.
     * @param {*} body
     * @returns {any}
     */
    public preconditionFailed(body: any) {
        return this.send(body, 412);
    }

    /**
     * requestEntityTooLarge method.
     * @param {*} body
     * @returns {any}
     */
    public requestEntityTooLarge(body: any) {
        return this.send(body, 413);
    }

    /**
     * requestUriTooLong method.
     * @param {*} body
     * @returns {any}
     */
    public requestUriTooLong(body: any) {
        return this.send(body, 414);
    }

    /**
     * unsupportedMediaType method.
     * @param {*} body
     * @returns {any}
     */
    public unsupportedMediaType(body: any) {
        return this.send(body, 415);
    }

    /**
     * requestedRangeNotSatisfiable method.
     * @param {*} body
     * @returns {any}
     */
    public requestedRangeNotSatisfiable(body: any) {
        return this.send(body, 416);
    }

    /**
     * expectationFailed method.
     * @param {*} body
     * @returns {any}
     */
    public expectationFailed(body: any) {
        return this.send(body, 417);
    }

    /**
     * unprocessableEntity method.
     * @param {*} body
     * @returns {any}
     */
    public unprocessableEntity(body: any) {
        return this.send(body, 422);
    }

    /**
     * tooManyRequests method.
     * @param {*} body
     * @returns {any}
     */
    public tooManyRequests(body: any) {
        return this.send(body, 429);
    }

    /**
     * internalServerError method.
     * @param {*} body
     * @returns {any}
     */
    public internalServerError(body: any) {
        return this.send(body, 500);
    }

    /**
     * notImplemented method.
     * @param {*} body
     * @returns {any}
     */
    public notImplemented(body: any) {
        return this.send(body, 501);
    }

    /**
     * badGateway method.
     * @param {*} body
     * @returns {any}
     */
    public badGateway(body: any) {
        return this.send(body, 502);
    }

    /**
     * serviceUnavailable method.
     * @param {*} body
     * @returns {any}
     */
    public serviceUnavailable(body: any) {
        return this.send(body, 503);
    }

    /**
     * gatewayTimeout method.
     * @param {*} body
     * @returns {any}
     */
    public gatewayTimeout(body: any) {
        return this.send(body, 504);
    }

    /**
     * httpVersionNotSupported method.
     * @param {*} body
     * @returns {any}
     */
    public httpVersionNotSupported(body: any) {
        return this.send(body, 505);
    }

    /**
     * toJSON method.
     * @returns {any}
     */
    public toJSON() {
        return {
            id: this.id(),
            url: this.url(),
            query: this.parsedUrl.query,
            body: this.all(),
            params: this.params(),
            headers: this.headers(),
            method: this.method(),
            protocol: this.protocol(),
            cookies: this.cookiesList(),
            hostname: this.hostname(),
            ip: this.ip()
        };
    }

    /**
     * __get method.
     * @param {*} target
     * @param {*} key
     * @returns {any}
     */
    public __get(target: Record<string, any>, key: string) {
        return (this as any).make((target as any)[kResponse], key)
    }
    /**
     * __set method.
     * @param {*} target
     * @param {*} key
     * @param {*} value
     * @returns {any}
     */
    public __set(target: Record<string, any>, key: string, value: any) {
        const resp = (target as any)[kResponse];
        if (resp && key in resp) {
            return resp[key] = value
        } else {
            return target[key] = value
        }
    }

}

export default HttpResponse;
