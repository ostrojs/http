import bodyParser from 'body-parser';

/**
 * Class BodyParserJson.
 */
class BodyParserJson {
    public $defaultOptions: Record<string, any> = {
        'bodySize': '80mb'
    };

    public $options: Record<string, any> = {};

    /**
     * Handle incoming request.
     *
     * @param context - Middleware context with request, response, next.
     */
    handle({ request, response, next }: { request: any; response: any; next: (err?: any) => void }): void {
        bodyParser.json({
            ...this.$defaultOptions,
            ...this.$options
        })(request, response, next);
    }
}

export default BodyParserJson;