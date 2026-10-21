import accepts from 'accepts';
import bytes from 'bytes';
import compressible from 'compressible';
import onHeaders from 'on-headers';
import vary from 'vary';
import zlib from 'zlib';

const kOptions: unique symbol = Symbol('options');

/**
 * Class Compression.
 */
class Compression {
    [kOptions]: Record<string, any>;

    public $defaultOptions: Record<string, any> = { threshold: 1024 };
    declare $options?: Record<string, any>;

    public $cacheControlNoTransformRegExp: RegExp = /(?:^|,)\s*?no-transform\s*?(?:,|$)/;

    /**
     * Create a new instance.
     */
    constructor() {
        this[kOptions] = {
            ...(this.$defaultOptions),
            ...(this.$options || {})
        };
    }

    /**
     * Handle incoming request compression.
     *
     * @param context - Middleware context with request, response, next.
     */
    public handle({ request, response, next }: Record<string, any>): void {
        if (request.httpVersion == '2.0') {
            return next();
        }
        let self = this;
        var threshold = bytes.parse(this[kOptions]['threshold']);

        var ended = false;
        var length: any;
        var listeners: any = [];
        var stream: any;

        var _end = response.end;
        var _on = response.on;
        var _write = response.write;

        response.flush = function flush(): void {
            if (stream) {
                stream.flush();
            }
        };

        response.write = function write(chunk: any, encoding: any): any {
            if (ended) {
                return false;
            }

            if (!this._header) {
                this._implicitHeader();
            }

            return stream ?
                stream.write(self.toBuffer(chunk, encoding)) :
                _write.call(this, chunk, encoding);
        };

        response.end = function end(chunk: any, encoding: any): any {
            if (ended) {
                return false;
            }

            if (!this._header) {

                if (!this.getHeader('Content-Length')) {
                    length = self.chunkLength(chunk, encoding);
                }

                this._implicitHeader();
            }

            if (!stream) {
                return _end.call(this, chunk, encoding);
            }

            ended = true;

            return chunk ?
                stream.end(self.toBuffer(chunk, encoding)) :
                stream.end();
        };

        response.on = function on(type: any, listener: any): any {
            if (!listeners || type !== 'drain') {
                return _on.call(this, type, listener);
            }

            if (stream) {
                return stream.on(type, listener);
            }

            listeners.push([type, listener]);

            return this;
        };

        /**
         * nocompress handler.
         *
         * @param msg - Filter message.
         */
        function nocompress(msg?: any): void {
            self.addListeners(response, _on, listeners);
            listeners = null;
        }

        /**
         * onHeaders callback.
         */
        onHeaders(response, function onResponseHeaders(): void {

            if (!self.shouldCompress(request, response)) {
                nocompress('filtered');
                return;
            }

            if (!self.shouldTransform(request, response)) {
                nocompress('no transform');
                return;
            }

            vary(response, 'Accept-Encoding');

            var contentLength = Number(response.getHeader('Content-Length')) || length;
            if (contentLength !== undefined && contentLength < threshold) {
                nocompress('size below threshold');
                return;
            }

            var encoding = response.getHeader('Content-Encoding') || 'identity';

            if (encoding !== 'identity') {
                nocompress('already encoded');
                return;
            }

            if (request.method === 'HEAD') {
                nocompress('HEAD requestuest');
                return;
            }

            var accept = accepts(request);
            var method = accept.encoding(['gzip', 'deflate', 'identity']);

            if (method === 'deflate' && accept.encoding(['gzip'])) {
                method = accept.encoding(['gzip', 'identity']);
            }

            if (!method || method === 'identity') {
                nocompress('not acceptable');
                return;
            }

            stream = method === 'gzip' ?
                zlib.createGzip(self[kOptions]) :
                zlib.createDeflate(self[kOptions]);

            self.addListeners(stream, stream.on, listeners);

            response.setHeader('Content-Encoding', method);
            response.removeHeader('Content-Length');

            stream.on('data', function onStreamData(chunk: any): void {
                if (_write.call(response, chunk) === false) {
                    stream.pause();
                }
            });

            stream.on('end', function onStreamEnd(): void {
                _end.call(response);
            });

            _on.call(response, 'drain', function onResponseDrain(): void {
                stream.resume();
            });
        });

        next();
    }

    /**
     * Attach listeners to stream.
     *
     * @param stream - Target stream.
     * @param on - On function.
     * @param listeners - Listeners array.
     */
    public addListeners(stream: any, on: any, listeners: any): void {
        for (var i = 0; i < listeners.length; i++) {
            on.apply(stream, listeners[i]);
        }
    }

    /**
     * Calculate byte length of chunk.
     *
     * @param chunk - Chunk data.
     * @param encoding - Character encoding.
     * @returns Byte length.
     */
    public chunkLength(chunk: any, encoding: any): number {
        if (!chunk) {
            return 0;
        }

        return !Buffer.isBuffer(chunk) ?
            Buffer.byteLength(chunk, encoding) :
            chunk.length;
    }

    /**
     * Determine if response should be compressed.
     *
     * @param request - Request instance.
     * @param response - Response instance.
     * @returns True if compressible.
     */
    public shouldCompress(request: any, response: any): boolean {
        var type = response.getHeader('Content-Type');

        if (type === undefined || !compressible(type)) {
            return false;
        }

        return true;
    }

    /**
     * Determine if response should be transformed.
     *
     * @param request - Request instance.
     * @param response - Response instance.
     * @returns True if transform allowed.
     */
    public shouldTransform(request: any, response: any): boolean {
        var cacheControl = response.getHeader('Cache-Control');

        return !cacheControl ||
            !this.$cacheControlNoTransformRegExp.test(cacheControl);
    }

    /**
     * Convert chunk to buffer.
     *
     * @param chunk - Chunk data.
     * @param encoding - Character encoding.
     * @returns Buffer.
     */
    public toBuffer(chunk: any, encoding: any): Buffer {
        return !Buffer.isBuffer(chunk) ?
            Buffer.from(chunk, encoding) :
            chunk;
    }
}

export default Compression;