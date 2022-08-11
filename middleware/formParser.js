const File = require('@ostro/http/file')
const lodash = require('lodash')
const qs = require('qs')
const Busboy = require('busboy')
const path = require('path')

function customizer(objValue, srcValue) {
    if (lodash.isArray(objValue)) {
        return objValue.concat(srcValue);
    }
}

class FormParser {
    handle({ request, response, next }) {
        if (typeof request.files != 'object') {
            request.files = {};
        }
        if (!request.headers['content-type']) {
            next()
        } else if (request.headers['content-type'].includes('multipart/form-data')) {
            let busboy = new Busboy({
                headers: request.headers
            });
            busboy.on('file', function(fieldname, fileReader, filename, encoding, mimetype) {
                let datas = []
                fileReader.on('data', function(data) {
                    datas.push(data)
                });
                fileReader.on('end', function() {
                    lodash.mergeWith(request.files, qs.parse(`${fieldname}=''`, {
                        depth: Infinity,
                        decoder: function(str, defaultEncoder, charset, type) {
                            if (type === 'value') {
                                return new File({
                                    filename: filename,
                                    mimetype: mimetype,
                                    encoding: encoding,
                                    buffer: datas
                                })

                            } else {
                                return str
                            }
                        }
                    }), customizer)
                });
            });
            busboy.on('field', function(fieldname, val, fieldnameTruncated, valTruncated) {
                lodash.mergeWith(request.body, (qs.parse(fieldname + '=' + encodeURIComponent(val))), customizer)
            });
            busboy.on('finish', function() {
                next()
            });
            request.pipe(busboy);
        } else {
            next()
        }
    }
}

module.exports = FormParser