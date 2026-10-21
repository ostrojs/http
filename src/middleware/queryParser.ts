import qs from 'qs';

/**
 * Class QueryParser.
 */
class QueryParser {
    
    public $extended: boolean = false;

    /**
     * Handle incoming request query string.
     *
     * @param context - Middleware context with request, response, next.
     */
    public handle({ request, response, next }: Record<string, any>): void {
        request.query = qs.parse(request._parsedUrl.query, {
            allowPrototypes: this.$extended
        });
        next();
    }
}

export default QueryParser;