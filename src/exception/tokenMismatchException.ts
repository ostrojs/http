import TokenMismatchExceptionContract from '@ostro/contracts/http/tokenMismatchException';

/**
 * Class TokenMismatchException.
 */
class TokenMismatchException extends TokenMismatchExceptionContract {
    public declare name: string;
    public statusCode: number;
    public message: string;

    /**
     * Create a new instance.
     *
     * @param message - Exception message.
     */
    constructor(message: string) {
        super();
        this.name = this.constructor.name;
        this.message = message;
        this.statusCode = 403;
        Error.captureStackTrace(this, this.constructor);
    }
}

export default TokenMismatchException;