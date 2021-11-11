const TokenMismatchExceptionContract = require('@ostro/contracts/http/tokenMismatchException')
class TokenMismatchException extends TokenMismatchExceptionContract {
    constructor(message) {
        super();
        this.name = this.constructor.name;
        this.message = message;
        this.statusCode = 403;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = TokenMismatchException