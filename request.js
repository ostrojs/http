var accepts = require('accepts');
var { isIP } = require('net');
const { pathToRegexp } = require('path-to-regexp', { decode: decodeURIComponent });
var typeis = require('type-is');
var fresh = require('fresh');
var parseRange = require('range-parser');
var parse = require('parseurl');
var proxyaddr = require('proxy-addr');
const { compileTrust } = require('./utils')
const kRequest = Symbol('request')
const { Macroable } = require('@ostro/support/macro')
const HttpRequestContract = require('@ostro/contracts/http/request')
class HttpRequest extends Macroable.extend(HttpRequestContract) {
    constructor(req) {
        super()
        Object.defineProperty(this, kRequest, { value: req })
        this.httpVersionMajor = req.httpVersionMajor;
        this.httpVersionMinor = req.httpVersionMinor;
        this.httpVersion = req.httpVersion;
        this.complete = req.complete;
        this.headers = req.headers;
        this.rawHeaders = req.rawHeaders;
        this.trailers = req.trailers;
        this.rawTrailers = req.rawTrailers;
        this.aborted = req.aborted;
        this.upgrade = req.upgrade;
        this.url = req.url;
        this.statusCode = req.statusCode;
        this.statusMessage = req.statusMessage;
    }

    get(name) {
        return this.header(name);
    }

    header(name, defaultValue = undefined) {
        if (!name) {
            throw new TypeError('name argument is required to get');
        }

        if (typeof name !== 'string') {
            throw new TypeError('name must be a string to get');
        }
        var lc = name.toLowerCase();
        switch (lc) {
            case 'referer':
            case 'referrer':
                return this.headers.referrer ||
                    this.headers.referer || defaultValue;
            default:
                return this.headers[lc] || defaultValue;
        }
    }

    absolute() {
        return this._parsedUrl;
    }

    accepts() {
        var accept = accepts(this);
        return accept.types.apply(accept, arguments);
    }

    acceptsEncodings() {
        var accept = accepts(this);
        return accept.encodings.apply(accept, arguments);
    }

    acceptsCharsets() {
        var accept = accepts(this);
        return accept.charsets.apply(accept, arguments);
    }

    acceptsLanguages() {
        var accept = accepts(this);
        return accept.languages.apply(accept, arguments);
    }

    range(size, options) {
        var range = this.get('Range');
        if (!range) return;
        return parseRange(size, range, options);
    }

    param(name, defaultValue) {
        var params = this.params || {};

        if (null != params[name] && params.hasOwnProperty(name)) return params[name];
        return defaultValue;
    }

    is(types) {
        var arr = types;
        if (!Array.isArray(types)) {
            arr = new Array(arguments.length);
            for (var i = 0; i < arr.length; i++) {
                arr[i] = arguments[i];
            }
        }
        return typeis(this, arr);
    }
    
    protocol() {
        var proto = this.connection.encrypted ?
            'https' :
            'http';
        if (!compileTrust(this.connection.remoteAddress, 0)) {
            return proto;
        }
        var header = this.get('X-Forwarded-Proto') || proto
        var index = header.indexOf(',')

        return index !== -1 ?
            header.substring(0, index).trim() :
            header.trim()
    }

    secure() {
        return this.protocol() === 'https';
    }

    ip() {
        return proxyaddr(this, compileTrust);
    }

    ips() {
        var addrs = proxyaddr.all(this, compileTrust);
        addrs.reverse().pop()
        return addrs
    }

    subdomains() {
        var hostname = this.hostname;

        if (!hostname) return [];

        var subdomains = !isIP(hostname) ?
            hostname.split('.').reverse() : [hostname];

        return subdomains.slice(2);
    }

    path() {
        return parse(this).pathname;
    }

    hostname() {
        var host = this.get('X-Forwarded-Host');

        if (!host || !compileTrust(this.connection.remoteAddress, 0)) {
            host = this.get('Host');
        } else if (host.indexOf(',') !== -1) {

            host = host.substring(0, host.indexOf(',')).trimRight()
        }

        if (!host) return;
        var offset = host[0] === '[' ?
            host.indexOf(']') + 1 :
            0;
        var index = host.indexOf(':', offset);

        return index !== -1 ?
            host.substring(0, index) :
            host;
    }

    fresh(res) {
        var method = this.method;
        var status = res.statusCode
        if ('GET' !== method && 'HEAD' !== method) return false;
        if ((status >= 200 && status < 300) || 304 === status) {
            return fresh(this.headers, {
                'etag': res.get('ETag'),
                'last-modified': res.get('Last-Modified')
            })
        }

        return false;
    }

    xhr() {
        var val = this.get('X-Requested-With') || '';
        return val.toLowerCase() === 'xmlhttprequest';
    }

    all() {
        return { ...this.query,
            ...this.body,
            ...this.files
        }
    }

    input(key, value) {
        return (this.all()[key] || value) || null
    }

    getQuery(key, value) {
        return key ? (this.query[key] || value) : this.query
    }

    getBody(key, value) {
        return key ? (this.body[key] || value) : this.body
    }

    add(key, value) {
        this.body[key] = value
    }

    only() {
        let data = {}
        for (var i = 0; i < arguments.length; i++) {
            data[arguments[i]] = this.all()[arguments[i]]
        }
        return data
    }

    except() {
        let data = { ...this.all()
        }
        for (var i = 0; i <= arguments.length; i++) {
            delete data[arguments[i]]
        }
        return data
    }

    has(key) {
        return Boolean(this.all()[key])
    }

    file(key) {
        return this.files[key]
    }

    hasFile(key, value = false) {
        return Boolean(this.files[key] || value)
    }

    isMethod(value) {
        return Boolean((this.method == value.toUpperCase()))
    }

    ajax() {
        return this.xhr()
    }

    wantJson() {
        return (this.headers.accept || '').toLowerCase() == 'application/json'
    }
    expectsJson() {
        return this.wantJson()
    }

    fullUrlIs(except) {
        return pathToRegexp(except).test(this.url)
    }

    getUser() {
        return this.header('AUTH_USER');
    }

    bearerToken() {
        let $header = this.header('Authorization', '');

        if ($header.startsWith('Bearer ')) {
            return $header.substr(7);
        }
    }

    getPassword() {
        return this.header('AUTH_PW');
    }

    getUserInfo() {
        let $userinfo = this.getUser();

        let $pass = this.getPassword();
        if ('' != $pass) {
            $userinfo += ":" + $pass;
        }

        return $userinfo;
    }

    __get(target, key) {
        return this.make(target[kRequest], key)
    }

}

module.exports = HttpRequest