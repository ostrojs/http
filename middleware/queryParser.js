const qs = require('qs');
class QueryParser {
    
    $extended = false;

    handle({ request, response, next }) {
        request.query = qs.parse(request._parsedUrl.query, {
            allowPrototypes: this.$extended
        })
        next()
    }
}

module.exports = QueryParser