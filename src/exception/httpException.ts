import HttpExceptionContract from '@ostro/contracts/http/httpException';

/**
 * Class HttpException.
 */
class HttpException extends HttpExceptionContract {
    public declare name: string;
    public statusCode: number;
    public headers: Record<string, any>;
    public message: string;

    /**
     * Create a new instance.
     *
     * @param statusCode - HTTP status code.
     * @param message - Exception error message.
     * @param headers - HTTP response headers.
     */
    constructor($statusCode: number, $message: string = '', $headers: Record<string, any> = {}) {
        super($message);
        this.name = this.constructor.name;
        this.statusCode = $statusCode;
        this.headers = $headers;
        this.message = $message;
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Get the HTTP status code.
     *
     * @returns HTTP status code.
     */
    public getStatusCode(): number {
        return this.statusCode;
    }

    /**
     * Get the HTTP response headers.
     *
     * @returns Headers dictionary.
     */
    public getHeaders(): Record<string, any> {
        return this.headers;
    }

    /**
     * Set the HTTP response headers.
     *
     * @param headers - Headers dictionary.
     */
    public setHeaders($headers: Record<string, any>): void {
        this.headers = $headers;
    }
}

export default HttpException;
