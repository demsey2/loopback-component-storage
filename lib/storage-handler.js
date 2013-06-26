var factory = require('./index');

var IncomingForm = require('formidable');
var StringDecoder = require('string_decoder').StringDecoder;

module.exports = Uploader;

function Uploader(options) {
    if (!(this instanceof Uploader)) {
        return new Uploader(options);
    }
    this.client = factory.createClient(options);
    this.options = options;
}

Uploader.prototype.processUpload = function (req, res, cb) {
    var client = this.client;
    var form = new IncomingForm(this.options);
    var container = req.params.container;
    var fields = {};
    var files = {};
    form.handlePart = function (part) {
        var self = this;

        if (part.filename === undefined) {
            var value = ''
                , decoder = new StringDecoder(this.encoding);

            part.on('data', function (buffer) {
                self._fieldsSize += buffer.length;
                if (self._fieldsSize > self.maxFieldsSize) {
                    self._error(new Error('maxFieldsSize exceeded, received ' + self._fieldsSize + ' bytes of field data'));
                    return;
                }
                value += decoder.write(buffer);
            });

            part.on('end', function () {
                fields[part.name] = value;
                self.emit('field', part.name, value);
            });
            return;
        }

        this._flushing++;

        var writer = client.upload({container: container, remote: part.filename});

        part.on('data', function (buffer) {
            self.pause();
            writer.write(buffer, function () {
                self.resume();
            });
        });

        part.on('end', function () {
            writer.end(function () {
                self._flushing--;
                files[part.name] = part.filename;
                self._maybeEnd();
            });
        });
    };

    form.parse(req, function (err, result) {
        console.log(result);
        cb && cb(err, {files: files, fields: fields});
    });
}

Uploader.prototype.processDownload = function(req, res, cb) {
    var reader = this.client.download({
        container: req.params.container,
        remote: req.params.file
    });
    reader.pipe(res);
    reader.on('error', function(err) {
       cb && cb(err);
    });
    reader.on('end', function(err, result) {
       cb && cb(err, result);
    });
}



