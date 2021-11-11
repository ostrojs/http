class InvalidObjectException extends Error {
    constructor(message) {
        super();
        this.name = this.constructor.name;
        this.status = 500;
        this.message = message || 'Invalid Object';
        Error.captureStackTrace(this, this.constructor);
    }
}
module.exports = InvalidObjectException