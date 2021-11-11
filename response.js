const Buffer = require('safe-buffer').Buffer
const contentDisposition = require('content-disposition');
const encodeUrl = require('encodeurl');
const escapeHtml = require('escape-html');
const {
    isAbsolute,
    normalizeType,
    normalizeTypes,
    setCharset,
    stringify,
    sendfile
} = require('./utils');

const {
    extname,
    resolve
} = require('path');
const statuses = require('statuses')
const merge = require('utils-merge');
const send = require('send');
const mime = send.mime;
const vary = require('vary');
const etag = require('etag');
var charsetRegExp = /;\s*charset\s*=/;
const kResponse = Symbol('response')
const { Macroable } = require('@ostro/support/macro')
const HttpResponseContract = require('@ostro/contracts/http/response')
class HttpResponse extends Macroable.extend(HttpResponseContract){

    constructor(res){
        super()
        Object.defineProperty(this,kResponse,{value:res})
    }

    response(){
        return this[kResponse]
    }

    links(links) {
        var link = this.header('Link') || '';
        if (link) link += ', ';
        return this.header('Link', link + Object.keys(links).map(function(rel) {
            return '<' + links[rel] + '>; rel="' + rel + '"';
        }).join(', '));
    }

    send(body, status = 200) {
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
            var buf = !Buffer.isBuffer(body) ?
                Buffer.from(body, encoding) :
                body
            this.header('ETag', etag(buf,{weak: true}));
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

    json(obj, status = 200) {
        var val = obj;
        this.statusCode = status

        var body = stringify(val)
        if (!this.header('Content-Type')) {
            this.header('Content-Type', 'application/json');
        }

        return this.send(body, status);
    }

    jsonp(obj, status = 200, callback = 'callback') {
        var val = obj;
        this.statusCode = status
        var body = stringify(val, null, 2, null)
        var callback = this.req.query[callback];
        if (!this.header('Content-Type', )) {
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

    sendStatus(statusCode) {
        var body = statuses[statusCode] || String(statusCode)

        this.statusCode = statusCode;
        this.type('txt');

        return this.send(body);
    }

    sendFile(path, options, callback) {
        var done = callback;
        var req = this.req;
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
        sendfile(res, file, opts, function(err) {
            if (done) return done(err);
            if (err && err.code === 'EISDIR') return next();
            if (err && err.code !== 'ECONNABORTED' && err.syscall !== 'write') {
                next(err);
            }
        });

    }

    download(path, filename, options, callback) {
        var done = callback;
        var name = filename;
        var opts = options || null
        if (typeof filename === 'function') {
            done = filename;
            name = null;
            opts = null
        } else if (typeof options === 'function') {
            done = options
            opts = null
        }
        var headers = {
            'Content-Disposition': contentDisposition(name || path)
        };
        if (opts && opts.headers) {
            var keys = Object.keys(opts.headers)
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i]
                if (key.toLowerCase() !== 'content-disposition') {
                    headers[key] = opts.headers[key]
                }
            }
        }
        opts = Object.create(opts)
        opts.headers = headers
        var fullPath = resolve(path);
        return this.sendFile(fullPath, opts, done)
    }

    contentType(type) {
        return this.type(type)
    }

    type(type) {
        var ct = type.indexOf('/') === -1 ?
            mime.lookup(type) :
            type;

        return this.header('Content-Type', ct);
    }

    format(obj) {
        var req = this.req;
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
            var err = new Error('Not Acceptable');
            err.status = err.statusCode = 406;
            err.types = normalizeTypes(keys).map(function(o) {
                return o.value
            });
            next(err);
        }

        return this;
    }

    attachment(filename) {
        if (filename) {
            this.type(extname(filename));
        }

        this.header('Content-Disposition', contentDisposition(filename));

        return this;
    }

    append(field, val) {
        var prev = this.header(field);
        var value = val;

        if (prev) {
            value = Array.isArray(prev) ? prev.concat(val) :
                Array.isArray(val) ? [prev].concat(val) : [prev, val];
        }

        return this.header(field, value);
    }

    header(field, val) {
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

    get(field) {
        return this.getHeader(field);
    }

    location(url) {
        var loc = url;
        if (url === 'back') {
            loc = this.req.get('Referrer') || '/';
        }
        return this.header('Location', encodeUrl(loc));
    }

    vary(field) {
        if (!field || (Array.isArray(field) && !field.length)) {
            return this;
        }

        vary(this, field);

        return this;
    }

    redirect(url) {
        if (!url) {
            return this
        }
        var address = url;
        var body;
        var status = 302;
        address = this.location(address).get('Location');
        this.format({
            text: function() {
                body = statuses[status] + '. Redirecting to ' + address
            },

            html: function() {
                var u = escapeHtml(address);
                body = '<p>' + statuses[status] + '. Redirecting to <a href="' + u + '">' + u + '</a></p>'
            },

            default: function() {
                body = '';
            }
        });
        this.statusCode = status;
        this.header('Content-Length', Buffer.byteLength(body));

        if (this.req.method === 'HEAD') {
            this.end();
        } else {
            this.end(body);
        }
    }

    to(url) {
        return this.redirect(url)
    }

    back() {
        return this.redirect('back')
    }

    continue() {
        return this.send(null, 100);
    }

    switchingProtocols() {
        return this.send(null, 101);
    }

    ok(body) {
        return this.send(body, 200);
    }

    created(body) {
        return this.send(body, 201);
    }

    accepted(body) {
        return this.send(body, 202);
    }

    nonAuthoritativeInformation(body) {
        return this.send(body, 203);
    }

    noContent() {
        return this.send(null,204);
    }

    resetContent() {
        return this.send(null,205);
    }

    partialContent(body) {
        return this.send(body, 206);
    }

    multipleChoices(body) {
        return this.send(body, 300);
    }

    movedPermanently(body) {
        return this.send(body, 301);
    }

    movedTemporarily(body) {
        return this.send(body, 302);
    }

    seeOther(body) {
        return this.send(body, 303);
    }

    notModified(body) {
        return this.send(body, 304);
    }

    useProxy(body) {
        return this.send(body, 305);
    }

    temporaryRedirect(body) {
        return this.send(body, 307);
    }

    badRequest(body) {
        return this.send(body, 400);
    }

    unauthorized(body) {
        return this.send(body, 401);
    }

    paymentRequired(body) {
        return this.send(body, 402);
    }

    forbidden(body) {
        return this.send(body, 403);
    }

    notFound(body) {
        return this.send(body, 404);
    }

    methodNotAllowed(body) {
        return this.send(body, 405);
    }

    notAcceptable(body) {
        return this.send(body, 406);
    }

    proxyAuthenticationRequired(body) {
        return this.send(body, 407);
    }

    requestTimeout(body) {
        return this.send(body, 408);
    }

    conflict(body) {
        return this.send(body, 409);
    }

    gone(body) {
        return this.send(body, 410);
    }

    lengthRequired(body) {
        return this.send(body, 411);
    }

    preconditionFailed(body) {
        return this.send(body, 412);
    }

    requestEntityTooLarge(body) {
        return this.send(body, 413);
    }

    requestUriTooLong(body) {
        return this.send(body, 414);
    }

    unsupportedMediaType(body) {
        return this.send(body, 415);
    }

    requestedRangeNotSatisfiable(body) {
        return this.send(body, 416);
    }

    expectationFailed(body) {
        return this.send(body, 417);
    }

    unprocessableEntity(body) {
        return this.send(body, 422);
    }

    tooManyRequests(body) {
        return this.send(body, 429);
    }

    internalServerError(body) {
        return this.send(body, 500);
    }

    notImplemented(body) {
        return this.send(body, 501);
    }

    badGateway(body) {
        return this.send(body, 502);
    }

    serviceUnavailable(body) {
        return this.send(body, 503);
    }

    gatewayTimeout(body) {
        return this.send(body, 504);
    }

    httpVersionNotSupported(body) {
        return this.send(body, 505);
    }

    toJSON() {
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

    __get(target,key){
        return this.make(target[kResponse],key)
    }
    __set(target,key,value){
        if(key in target[kResponse]){
            return target[kResponse][key] = value
        }else{
            return target[key] = value
        }
    }

}

module.exports = HttpResponse