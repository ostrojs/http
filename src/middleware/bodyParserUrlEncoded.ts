import bodyParser from 'body-parser';

/**
 * Class BodyParserUrlEncoded.
 */
class BodyParserUrlEncoded {
    public $defaultOptions: Record<string, any> = {
        'extended': true,
        'parameterLimist': 1000000,
        'bodySize': '80mb'
    };
    
    public $options: Record<string, any> = {};

    /**
     * Handle incoming request.
     *
     * @param context - Middleware context with request, response, next.
     */
    handle({ request, response, next }: { request: any; response: any; next: (err?: any) => void }): void {
        bodyParser.urlencoded({
            ...this.$defaultOptions,
            ...this.$options
        })(request, response, next);
    }
}

export default BodyParserUrlEncoded;