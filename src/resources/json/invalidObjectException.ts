/**
 * Class InvalidObjectException.
 */
class InvalidObjectException extends Error {
    public status: number;

    /**
     * Create a new instance.
     *
     * @param message - Exception message.
     */
    constructor(message?: string) {
        super();
        this.name = this.constructor.name;
        this.status = 500;
        this.message = message || 'Invalid Object';
        Error.captureStackTrace(this, this.constructor);
    }
}

export default InvalidObjectException;