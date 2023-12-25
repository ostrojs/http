const HttpException = require('./httpException');
class ThrottleRequestsException extends HttpException {
    constructor($retryAfter = null, $message = '', $headers = {}) {
        if ($retryAfter) {
            $headers['Retry-After'] = $retryAfter;
        }

        super(429, $message, $headers);
    }
}
module.exports = ThrottleRequestsException;
