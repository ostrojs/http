const bodyParser = require('body-parser');
class BodyParserUrlEncoded {
    $defaultOptions = {
        'extended': true,
        'parameterLimist': 1000000,
        'bodySize': '80mb'
    };
    
    $options = {};

    handle({ request, response, next }) {
        bodyParser.urlencoded({
            ...this.$defaultOptions,
            ...this.$options
        })(request, response, next)
    }
}

module.exports = BodyParserUrlEncoded