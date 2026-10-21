import crossOrigin from 'cors';

/**
 * Class CrossOrigin.
 */
class CrossOrigin {

    // Configure allowed CORS header values as arrays for easy merging/extension
    public $headers: Record<string, string[]> = {
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        'Access-Control-Allow-Headers': ["*"]
    };

    /**
     * Handle incoming request CORS headers.
     *
     * @param context - Middleware context with request, response, next.
     */
    public handle({ request, response, next }: Record<string, any>): void {
        // Helper: normalize header arrays to array of strings.
        // Accepts:
        // - array of strings (items may contain commas)
        // - single string (may contain commas)
        // Returns flattened, trimmed array of non-empty strings
        const normalizeArray = (val: any): string[] => {
            if (!val) return [];
            const toItems = (item: any): string[] => String(item).split(',').map((s: string) => s.trim()).filter(Boolean);
            if (Array.isArray(val)) {
                return val.flatMap(toItems);
            }
            return toItems(val);
        };

        const origins: string[] = normalizeArray(this.$headers['Access-Control-Allow-Origin']);
        const methods: string[] = normalizeArray(this.$headers['Access-Control-Allow-Methods']);
        const allowedHeaders: string[] = normalizeArray(this.$headers['Access-Control-Allow-Headers']);

        const reqOrigin: string = request.header('Origin') || '';

        // Check whether origin is allowed. Support '*', exact match, and hostname-only matches
        const originAllowed = (origin: string): boolean => {
            if (!origin) return false;
            if (origins.includes(origin)) return true;
            const stripped: string = origin.replace(/(^\w+:|^)\/\//, ''); // remove protocol if present
            if (origins.includes(stripped)) return true;
            return false;
        };

        // Build options for cors middleware
        const options = {
            origin: origins.includes('*') ? '*' : (originAllowed(reqOrigin) ? true : false),
            methods: methods.length ? methods.join(',') : undefined,
            allowedHeaders: allowedHeaders.length ? (allowedHeaders.includes('*') ? '*' : allowedHeaders.join(',')) : (request.header('Access-Control-Request-Headers') || undefined)
        };

        // Call cors middleware with computed options
        crossOrigin(options)(request, response, next);
    }
}

export default CrossOrigin;
