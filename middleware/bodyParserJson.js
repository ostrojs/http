const bodyParser = require('body-parser');
class BodyParserJson {
    $defaultOptions = {
        'bodySize': '80mb'
    };

    $options = {};

    handle({ request, response, next }) {
        bodyParser.json({
            ...this.$defaultOptions,
            ...this.$options
        })(request, response, next)
    }
}

module.exports = BodyParserJson