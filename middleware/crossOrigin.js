const crossOrigin = require('cors');
class CrossOrigin {

    $headers = {
        'Access-Control-Allow-Origin': '*'
    };
    
    handle({ request, response, next }) {
        crossOrigin((req, callback) => {
            callback(null, {
                origin: this.$headers['Access-Control-Allow-Origin'].includes(req.header('Origin', '').replace(/(^\w+:|^)\/\//, ''))
            })
        })(request, response, next)
    }
}

module.exports = CrossOrigin