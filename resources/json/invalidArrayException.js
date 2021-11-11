class InvalidArrayException extends Error {
    constructor(message) {
        super();
        this.name = this.constructor.name;
        this.status = 500;
        this.message = message || 'Invalid Array';
        Error.captureStackTrace(this, this.constructor);
    }
}
module.exports = InvalidArrayException