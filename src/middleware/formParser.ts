import File from '../file';
import lodash from 'lodash';
import qs from 'qs';
import Busboy from 'busboy';
import path from 'path';

/**
 * Customizer handler for lodash.mergeWith.
 *
 * @param objValue - Target object value.
 * @param srcValue - Source object value.
 * @returns Concatenated array or undefined.
 */
function customizer(objValue: any, srcValue: any): any {
    if (lodash.isArray(objValue)) {
        return objValue.concat(srcValue);
    }
}

/**
 * Class FormParser.
 */
class FormParser {
    /**
     * Handle incoming multipart form data.
     *
     * @param context - Middleware context with request, response, next.
     */
    public handle({ request, response, next }: Record<string, any>): void {
        if (typeof request.files != 'object') {
            request.files = {};
        }
        if (!request.headers['content-type']) {
            next();
        } else if (request.headers['content-type'].includes('multipart/form-data')) {
            let busboy = Busboy({
                headers: request.headers
            });
            busboy.on('file', function(fieldname: string, fileReader: any, info: any): void {
                let datas: any[] = [];
                fileReader.on('data', function(data: any): void {
                    datas.push(data);
                });
                fileReader.on('end', function(): void {
                    lodash.mergeWith(request.files, qs.parse(`${fieldname}=''`, {
                        depth: Infinity,
                        decoder: function(str: string, defaultEncoder: any, charset: string, type: string): any {
                            if (type === 'value') {
                                return new File({
                                    filename: info.filename,
                                    mimetype: info.mimeType,
                                    encoding: info.encoding,
                                    buffer: datas
                                });

                            } else {
                                return str;
                            }
                        }
                    }), customizer);
                });
            });
            busboy.on('field', function(fieldname: string, val: any, fieldnameTruncated: boolean, valTruncated: boolean): void {
                lodash.mergeWith(request.body, (qs.parse(fieldname + '=' + encodeURIComponent(val))), customizer);
            });
            busboy.on('finish', function(): void {
                next();
            });
            request.pipe(busboy);
        } else {
            next();
        }
    }
}

export default FormParser;
