const accepts = require('accepts')
const bytes = require('bytes')
const compressible = require('compressible')
const onHeaders = require('on-headers')
const vary = require('vary')
const zlib = require('zlib')
const kOptions = Symbol('options')
class Compression {

    $defaultOptions = { threshold: 1024 };


    $cacheControlNoTransformRegExp = /(?:^|,)\s*?no-transform\s*?(?:,|$)/;

    constructor() {
        this[kOptions] = { ...(this.$defaultOptions || {}),
            ...(this.$options || {})
        }
    }
    handle({ request, response, next }) {
        if (request.httpVersion == '2.0') {
            return next()
        }
        let self = this
        var threshold = bytes.parse(this[kOptions]['threshold'])

        var ended = false
        var length
        var listeners = []
        var stream

        var _end = response.end
        var _on = response.on
        var _write = response.write

        response.flush = function flush() {
            if (stream) {
                stream.flush()
            }
        }

        response.write = function write(chunk, encoding) {
            if (ended) {
                return false
            }

            if (!this._header) {
                this._implicitHeader()
            }

            return stream ?
                stream.write(self.toBuffer(chunk, encoding)) :
                _write.call(this, chunk, encoding)
        }

        response.end = function end(chunk, encoding) {
            if (ended) {
                return false
            }

            if (!this._header) {

                if (!this.getHeader('Content-Length')) {
                    length = self.chunkLength(chunk, encoding)
                }

                this._implicitHeader()
            }

            if (!stream) {
                return _end.call(this, chunk, encoding)
            }

            ended = true

            return chunk ?
                stream.end(self.toBuffer(chunk, encoding)) :
                stream.end()
        }

        response.on = function on(type, listener) {
            if (!listeners || type !== 'drain') {
                return _on.call(this, type, listener)
            }

            if (stream) {
                return stream.on(type, listener)
            }

            listeners.push([type, listener])

            return this
        }

        function nocompress(msg) {
            self.addListeners(response, _on, listeners)
            listeners = null
        }

        onHeaders(response, function onResponseHeaders() {

            if (!self.shouldCompress(request, response)) {
                nocompress(response, _on, 'filtered')
                return
            }

            if (!self.shouldTransform(request, response)) {
                nocompress(response, _on, 'no transform')
                return
            }

            vary(response, 'Accept-Encoding')

            if (Number(response.getHeader('Content-Length')) < threshold || length < threshold) {
                nocompress(response, _on, 'size below threshold')
                return
            }

            var encoding = response.getHeader('Content-Encoding') || 'identity'

            if (encoding !== 'identity') {
                nocompress(response, _on, 'already encoded')
                return
            }

            if (request.method === 'HEAD') {
                nocompress(response, _on, 'HEAD requestuest')
                return
            }

            var accept = accepts(request)
            var method = accept.encoding(['gzip', 'deflate', 'identity'])

            if (method === 'deflate' && accept.encoding(['gzip'])) {
                method = accept.encoding(['gzip', 'identity'])
            }

            if (!method || method === 'identity') {
                nocompress(response, _on, 'not acceptable')
                return
            }

            stream = method === 'gzip' ?
                zlib.createGzip(self[kOptions]) :
                zlib.createDeflate(self[kOptions])

            self.addListeners(stream, stream.on, listeners)

            response.setHeader('Content-Encoding', method)
            response.removeHeader('Content-Length')

            stream.on('data', function onStreamData(chunk) {
                if (_write.call(response, chunk) === false) {
                    stream.pause()
                }
            })

            stream.on('end', function onStreamEnd() {
                _end.call(response)
            })

            _on.call(response, 'drain', function onResponseDrain() {
                stream.resume()
            })
        })

        next()

    }

    addListeners(stream, on, listeners) {
        for (var i = 0; i < listeners.length; i++) {
            on.apply(stream, listeners[i])
        }
    }

    chunkLength(chunk, encoding) {
        if (!chunk) {
            return 0
        }

        return !Buffer.isBuffer(chunk) ?
            Buffer.byteLength(chunk, encoding) :
            chunk.length
    }

    shouldCompress(request, response) {
        var type = response.getHeader('Content-Type')

        if (type === undefined || !compressible(type)) {
            return false
        }

        return true
    }

    shouldTransform(request, response) {
        var cacheControl = response.getHeader('Cache-Control')

        return !cacheControl ||
            !this.$cacheControlNoTransformRegExp.test(cacheControl)
    }

    toBuffer(chunk, encoding) {
        return !Buffer.isBuffer(chunk) ?
            Buffer.from(chunk, encoding) :
            chunk

    }

}

module.exports = Compression