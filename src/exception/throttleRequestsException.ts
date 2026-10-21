import HttpException from './httpException';

/**
 * Class ThrottleRequestsException.
 */
class ThrottleRequestsException extends HttpException {

    /**
     * Create a new instance.
     *
     * @param retryAfter - Retry-After duration or header value.
     * @param message - Exception message.
     * @param headers - Response headers.
     */
    constructor($retryAfter: any = null, $message: string = '', $headers: Record<string, any> = {}) {
        if ($retryAfter) {
            $headers['Retry-After'] = $retryAfter;
        }

        super(429, $message, $headers);
    }
}

export default ThrottleRequestsException;
