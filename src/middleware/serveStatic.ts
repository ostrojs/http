import serveStatic from 'serve-static';

/**
 * Class ServeStatic.
 */
class ServeStatic {
    declare $app?: any;
    declare options?: Record<string, any>;

    public $defaultOptions: Record<string, any> = { 'maxAge': '180d' };

    public $options: Record<string, any> = {};
    public $publicPath: string;

    /**
     * Create a new instance.
     */
    constructor() {
        this.$publicPath = this.$app ? this.$app['path.public'] : (typeof (global as any).$app !== 'undefined' ? (global as any).$app['path.public'] : '');
    }

    /**
     * Handle static file serving.
     *
     * @param context - Middleware context with request, response, next.
     */
    public handle({ request, response, next }: Record<string, any>): void {
        serveStatic(this.$publicPath, { ...this.$defaultOptions, ...(this.$options || this.options || {}) })(request, response, next);
    }
}

export default ServeStatic;