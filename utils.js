const proxyaddr = require('proxy-addr');
const Buffer = require('safe-buffer').Buffer
const contentType = require('content-type');
const { mime } = require('send');

const env = process.env.NODE_ENV || 'local'
const onFinished = require('on-finished');

exports.isAbsolute = function(path) {
    if ('/' === path[0]) return true;
    if (':' === path[1] && ('\\' === path[2] || '/' === path[2])) return true;
    if ('\\\\' === path.substring(0, 2)) return true;
};

exports.normalizeType = function(type) {
    return ~type.indexOf('/') ?
        acceptParams(type) : {
            value: mime.lookup(type),
            params: {}
        };
};
exports.normalizeTypes = function(types) {
    var ret = [];

    for (var i = 0; i < types.length; ++i) {
        ret.push(exports.normalizeType(types[i]));
    }

    return ret;
};

exports.setCharset = function setCharset(type, charset) {
    if (!type || !charset) {
        return type;
    }
    var parsed = contentType.parse(type);
    parsed.parameters.charset = charset;
    return contentType.format(parsed);
};


exports.compileTrust = function(val) {
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

exports.stringify = function stringify(value, replacer, spaces, escape) {
    var json = replacer || spaces ?
        JSON.stringify(value, replacer, spaces) :
        JSON.stringify(value);

    if (escape) {
        json = json.replace(/[<>&]/g, function(c) {
            switch (c.charCodeAt(0)) {
                case 0x3c:
                    return '\\u003c'
                case 0x3e:
                    return '\\u003e'
                case 0x26:
                    return '\\u0026'
                default:
                    return c
            }
        })
    }

    return json
}

exports.sendfile = function sendfile(res, file, options, callback) {
    var done = false;
    var streaming;

    function onaborted() {
        if (done) return;
        done = true;

        var err = new Error('Request aborted');
        err.code = 'ECONNABORTED';
        callback(err);
    }

    function ondirectory() {
        if (done) return;
        done = true;

        var err = new Error('EISDIR, read');
        err.code = 'EISDIR';
        callback(err);
    }

    function onerror(err) {
        if (done) return;
        done = true;
        callback(err);
    }

    function onend() {
        if (done) return;
        done = true;
        callback();
    }

    function onfile() {
        streaming = false;
    }

    function onfinish(err) {
        if (err && err.code === 'ECONNRESET') return onaborted();
        if (err) return onerror(err);
        if (done) return;

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