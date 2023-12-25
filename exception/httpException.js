
const HttpExceptionContract = require('@ostro/contracts/http/httpException')

class HttpException extends HttpExceptionContract {
    statusCode;
    headers = {};
    message;
    constructor($statusCode, $message = '', $headers = {}) {
        super($message);
        this.name = this.constructor.name;
        this.statusCode = $statusCode;
        this.headers = $headers;
        this.message = $message;
        Error.captureStackTrace(this, this.constructor);

    }

    getStatusCode() {
        return this.statusCode;
    }

    getHeaders() {
        return this.headers;
    }

    setHeaders($headers) {
        this.headers = $headers;
    }
}
module.exports = HttpException;
