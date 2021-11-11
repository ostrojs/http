const serveStatic = require('serve-static');
class ServeStatic {
    $defaultOptions = { 'maxAge': '180d' };

    $options = {};

    constructor() {
        this.$publicPath = this.$app['path.public']
    }

    handle({ request, response, next }) {
        serveStatic(this.$publicPath, { ...this.$defaultOptions, ...this.options })(request, response, next)
    }
}

module.exports = ServeStatic