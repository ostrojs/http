/**
 * Class InvalidArrayException.
 */
class InvalidArrayException extends Error {
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
        this.message = message || 'Invalid Array';
        Error.captureStackTrace(this, this.constructor);
    }
}

export default InvalidArrayException;