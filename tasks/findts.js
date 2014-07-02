var path = require('path');
var fs = require('fs');
var https = require('https');
var Promise = require('bluebird');
var _ = require('lodash');
var async = require('asyncawait/async');
var await = require('asyncawait/await');
var EOL = require('os').EOL;
var fsTools = require('fs-tools');

var task = function (grunt) {
    grunt.registerMultiTask('findts', 'Find TypeScript type definitions for dependencies.', function () {
        var done = this.async();
        var log = function (msg) {
            return grunt.log.writeln(msg);
        };
        taskInner(log).then(function () {
            return done();
        }, function (err) {
            log(err);
            done(false);
        });
    });
};

var taskInner = async(function (log) {
    var basePath = process.cwd();
    var pkgPath = path.join(basePath, 'package.json');
    var pkg = require(pkgPath);

    var pending = _.keys(_.assign({}, pkg.dependencies, pkg.peerDependencies, pkg.devDependencies));

    var handled = [], located = [];

    while (pending.length > 0) {
        var depName = pending.shift();

        if (handled.indexOf(depName) !== -1)
            continue;
        handled.push(depName);

        log('Finding type definition for ' + depName + '...');

        var searchPath = basePath;
        while (true) {
            var depPath = path.join(searchPath, 'node_modules', depName);
            if (fs.existsSync(depPath))
                break;
            var newSearchPath = path.join(searchPath, '..');
            if (path.relative(searchPath, newSearchPath) !== '..')
                break;
            searchPath = newSearchPath;
        }

        if (fs.existsSync(depPath)) {
            var pkgPath = path.join(depPath, 'package.json');
            var pkg = require(pkgPath);
            var srcRelPaths = [
                pkg.typescript || ('./typings/' + depName + '/' + depName + '.d.ts'),
                './' + depName + '.d.ts',
                './module.d.ts'
            ];
            var srcPath = _.find(srcRelPaths.map(function (rel) {
                return path.join(depPath, rel);
            }), fs.existsSync);

            if (srcPath) {
                located.push(depName);

                log('...found at ' + srcPath);

                var tgtPath = path.join(basePath, 'typings', depName);
                fsTools.mkdirSync(tgtPath);
                tgtPath = path.join(tgtPath, depName + '.d.ts');
                var content = fs.readFileSync(srcPath, { encoding: 'utf8' });
                fs.writeFileSync(tgtPath, content, { encoding: 'utf8' });

                var pattern = /^\/\/\/<reference[ ]+path[ ]*=[ ]*['"]..[/\\][^\/]*[/\\][^.]*[.]d[.]ts['"][ ]*\/>$/gm;
                var refLines = content.match(pattern) || [];
                var refNames = refLines.map(function (refLine) {
                    return /[^.]+[.][.][/\\]([^/\\]+)/.exec(refLine)[1];
                });
                pending = pending.concat(refNames);
            }
        }

        if (!_.contains(located, depName)) {
            var urlTemplate = 'https://raw.githubusercontent.com/borisyankov/DefinitelyTyped/master/{1}/{2}.d.ts';
            var url = urlTemplate.replace('{1}', depName).replace('{2}', depName);
            try  {
                content = await(httpsGet(url));
            } catch (err) {
                content = null;
            }

            if (content) {
                located.push(depName);

                log('...found at ' + url);

                var tgtPath = path.join(basePath, 'typings', depName);
                fsTools.mkdirSync(tgtPath);
                tgtPath = path.join(tgtPath, depName + '.d.ts');
                fs.writeFileSync(tgtPath, content, { encoding: 'utf8' });

                var pattern = /^\/\/\/<reference[ ]+path[ ]*=[ ]*['"]..[/\\][^\/]*[/\\][^.]*[.]d[.]ts['"][ ]*\/>$/gm;
                var refLines = content.match(pattern) || [];
                var refNames = refLines.map(function (refLine) {
                    return /[^.]+[.][.][/\\]([^/\\]+)/.exec(refLine)[1];
                });
                pending = pending.concat(refNames);
            }
        }

        if (!_.contains(located, depName)) {
            log('...NOTHING FOUND');
        }
    }

    var prolog = '/*----------findts----------*/';
    var epilog = '/*----------/findts----------*/';
    var section = prolog + EOL + '/* NB: This section is generated and maintained by grunt-findts. */' + EOL + '/* NB: Any manual changes here will be overwritten whenever grunt-findts runs. */' + EOL;
    located.forEach(function (depName) {
        section += '///<reference path="typings/' + depName + '/' + depName + '.d.ts" />' + EOL;
    });
    section += epilog;

    var refPath = path.join(basePath, 'references.d.ts');
    var content = fs.existsSync(refPath) ? fs.readFileSync(refPath, { encoding: 'utf8' }) : '';
    var start = content.indexOf(prolog), end = content.indexOf(epilog);
    if (end !== -1)
        end = end + epilog.length;
    if (start === -1 && end === -1) {
        var pre = '', post = EOL + EOL + content;
    } else if (start !== -1 && end !== -1 && start < end) {
        var pre = content.substr(0, start);
        var post = content.substr(end);
    } else
        throw new Error('Invalid references.d.ts');

    fs.writeFileSync(refPath, pre + section + post, { encoding: 'utf8' });
});

function httpsGet(url) {
    return new Promise(function (resolve, reject) {
        var chunks = [];
        var req = https.get(url, function (res) {
            if (res['statusCode'] === 200) {
                res.on('data', function (data) {
                    return chunks.push(data);
                });
                res.on('end', function () {
                    return resolve(chunks.join(''));
                });
                res.on('error', reject);
            } else
                reject(new Error('Expected HTTP status 200 but got ' + res['statusCode']));
        });
        req.on('error', reject);
    });
}
module.exports = task;
//# sourceMappingURL=findts.js.map
