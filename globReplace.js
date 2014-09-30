
var glob        = require("glob"),
    glob2base   = require("glob2base"),
    through2    = require("through2"),
    extend      = require("node.extend"),
    _           = require("lodash"),
    async       = require("async"),
    File        = require("gulp-util").File,
    fs          = require("fs"),
    path        = require("path")
;

// http://stackoverflow.com/a/6969486
function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function removeBase(file, base) {
    file = path.normalize(file);
    base = path.normalize(base);
    return file.replace(new RegExp(["^(\./)?", escapeRegExp(base)].join("")), "");
}

module.exports = function(globs, opts) {
    var fileMap = {},
        pushed = [],
        opts = extend({
            extendJson: false,
            emitAll: false
        }, opts),
        globber = null,
        base;

    if(globs) {
        // allow both positive and negative array of globs, or just a positive glob string.
        if(!Array.isArray(globs)) {
            globs = [globs];
        }

        globs.forEach(function(globStr) {
            var positive = true;

            if(globStr[0] === "!") {
                positive = false;
                globStr = globStr.slice(1);
            }

            globber = new glob.Glob(globStr, {
                sync: true,
                mark: true
            });

            if(positive) {
                base = glob2base(globber);
            }

            globber.found.forEach(function(file) {
                // exclude folders
                if(file.slice(-1) !== "/") {
                    var index = removeBase(file, base);

                    if(positive) {
                        fileMap[index] = file;
                    } else {
                        delete fileMap[index];
                    }
                }
             });
        });
    }

    return through2.obj(function(file, enc, done) {
        var index = removeBase(file.path, file.base),
            fileName = fileMap[index] || false,
            stream = this;
        if(fileName) {
            fs.readFile(fileName, null, function (err, buffer) {
                if(opts.extendJson && path.extname(fileName).toLowerCase() === ".json") {
                    file.contents = new Buffer(
                        JSON.stringify(
                            extend(
                                JSON.parse(file.contents.toString("utf8")),
                                JSON.parse(buffer.toString("utf8"))
                            )
                        )
                    )
                } else {
                    file.contents = buffer;
                }
                pushed.push(index);
                stream.push(file);
                done();
            });
        } else {
            stream.push(file);
            done();
        }
    }, function(done) {
        if(opts.emitAll) {
            var stream = this,
                readFiles = [];
            _.chain(fileMap).omit(pushed).each(function (fileName, baseFile) {
                readFiles.push(function (cb) {
                    fs.readFile(fileName, function (err, data) {
                        stream.push(new File({
                            path: path.resolve(process.cwd(), baseFile),
                            contents: data
                        }));
                        cb();
                    });
                });
            });

            async.parallel(readFiles, done);
        } else {
            done();
        }
    });
};