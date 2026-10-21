import proxyaddr from 'proxy-addr';
import { Buffer } from 'safe-buffer';
import contentType from 'content-type';
import { mime } from 'send';
import onFinished from 'on-finished';

export function isAbsolute(path: any) {
    if ('/' === path[0]) return true;
    if (':' === path[1] && ('\\' === path[2] || '/' === path[2])) return true;
    if ('\\\\' === path.substring(0, 2)) return true;
};

/**
 * acceptParams handler.
 * @param {*} str
 * @param {*} index
 * @returns {any}
 */
export function acceptParams(str: any, index?: any) {
    var parts = str.split(/ *; */);
    var ret = { value: parts[0], quality: 1, params: {}, originalIndex: index };
    for (var i = 1; i < parts.length; ++i) {
        var pms = parts[i].split(/ *= */);
        if ('q' === pms[0]) {
            ret.quality = parseFloat(pms[1]);
        } else {
            ret.params[pms[0]] = pms[1];
        }
    }
    return ret;
}



export function normalizeType(type: any) {
    return ~type.indexOf('/') ?
        acceptParams(type) : {
            value: mime.lookup(type),
            params: {}
        };
};
export function normalizeTypes(types: any) {
    var ret = [];

    for (var i = 0; i < types.length; ++i) {
        ret.push(normalizeType(types[i]));
    }

    return ret;
};

export function setCharset(type: any, charset: any) {
    if (!type || !charset) {
        return type;
    }
    var parsed = contentType.parse(type);
    parsed.parameters.charset = charset;
    return contentType.format(parsed);
};


export function compileTrust(val: any) {
    if (typeof val === 'function') return val;

    if (val === true) {
        return function() {
            return true
        };
    }

    if (typeof val === 'number') {
        return function(a, i) {
            return i < val
        };
    }

    if (typeof val === 'string') {
        val = val.split(/ *, */);
    }

    return proxyaddr.compile(val || []);
}

export function stringify(value: any, replacer?: any, spaces?: any, escape?: any) {
    var json = replacer || spaces ?
        JSON.stringify(value, replacer, spaces) :
        JSON.stringify(value);

    if (escape) {
        var escapeChars = { '<': '\\u003c', '>': '\\u003e', '&': '\\u0026' };
        json = json.replace(/[<>&]/g, function(c) {
            return escapeChars[c];
        })
    }

    return json
}

export function sendfile(res: any, file: any, options: any, callback: any) {
    var done = false;
    var streaming;

    /**
     * onaborted handler.
     * @returns {any}
     */
    function onaborted() {
        if (done) return;
        done = true;

        var err: any = new Error('Request aborted');
        err.code = 'ECONNABORTED';
        callback(err);
    }

    /**
     * ondirectory handler.
     * @returns {any}
     */
    function ondirectory() {
        if (done) return;
        done = true;

        var err: any = new Error('EISDIR, read');
        err.code = 'EISDIR';
        callback(err);
    }

    /**
     * onerror handler.
     * @param {*} err
     * @returns {any}
     */
    function onerror(err) {
        if (done) return;
        done = true;
        callback(err);
    }

    /**
     * onend handler.
     * @returns {any}
     */
    function onend() {
        if (done) return;
        done = true;
        callback();
    }

    /**
     * onfile handler.
     * @returns {any}
     */
    function onfile() {
        streaming = false;
    }

    /**
     * onfinish handler.
     * @param {*} err
     * @returns {any}
     */
    function onfinish(err) {
        if (err && err.code === 'ECONNRESET') return onaborted();
        if (err) return onerror(err);
        if (done) return;

        /**
         * setImmediate method.
         * @param {*} function(
         * @returns {any}
         */
        setImmediate(function() {
            if (streaming !== false && !done) {
                onaborted();
                return;
            }

            if (done) return;
            done = true;
            callback();
        });
    }

    /**
     * onstream handler.
     * @returns {any}
     */
    function onstream() {
        streaming = true;
    }
    file.on('directory', ondirectory);
    file.on('end', onend);
    file.on('error', onerror);
    file.on('file', onfile);
    file.on('stream', onstream);
    onFinished(res, onfinish);

    if (options.headers) {

        file.on('headers', function headers(res) {
            var obj = options.headers;
            var keys = Object.keys(obj);

            for (var i = 0; i < keys.length; i++) {
                var k = keys[i];
                res.setHeader(k, obj[k]);
            }
        });
    }

    file.pipe(res);
}
const utils = { isAbsolute, acceptParams, normalizeType, normalizeTypes, setCharset, compileTrust, stringify, sendfile };
export default utils;
