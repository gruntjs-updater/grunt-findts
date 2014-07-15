import references = require('references');
import path = require('path');
import fs = require('fs');
import https = require('https');
import Promise = require('bluebird');
import _ = require('lodash');
import async = require('asyncawait/async');
import await = require('asyncawait/await');
var EOL = require('os').EOL;
var fsTools = require('fs-tools');
export = task;


var task = function (grunt) {
    grunt.registerMultiTask('findts', 'Find TypeScript type definitions for dependencies.', function() {
        var done = this.async();
        var log = msg => grunt.log.writeln(msg);
        taskInner(log).then(() => done(), err => { log(err); done(false); });

    });
};


var taskInner = async ((log: (msg: string) => void) => {

    // Assume the current working directory is that of the module we are working it.
    var basePath = process.cwd();
    var pkgPath = path.join(basePath, 'package.json');
    var pkg = require(pkgPath);

    // Get the names of all the module's direct dependencies, and add them to the 'pending' queue.
    var pending = <string[]> _.keys(_.assign({}, pkg.dependencies, pkg.peerDependencies, pkg.devDependencies, pkg.optionalDependencies));

    // Always add 'node' as an implicit dependency.
    pending.unshift('node');

    // Keep track of already-handled dependencies, and ones for which type definitions were found.
    var handled = [], located = [];

    // Process pending dependencies until they are all done.
    while (pending.length > 0) {
        var depName = pending.shift();

        // Update the handled list, and skip this dependency if it was already handled.
        if (handled.indexOf(depName) !== -1) continue;
        handled.push(depName);

        // Give feedback.
        log('Finding type definition for ' + depName + '...');

        // Determine the module location that the dependency will resolve to, if possible.
        var searchPath = basePath;
        while (true) {
            var depPath = path.join(searchPath, 'node_modules', depName);
            if (fs.existsSync(depPath)) break;
            var newSearchPath = path.join(searchPath, '..');
            if (path.relative(searchPath, newSearchPath) !== '..') break;
            searchPath = newSearchPath;
        }

        // If the module's location is found, look for its type definition there.
        if (fs.existsSync(depPath)) {

            // Determine where to look for the type definition file. If the module's package.json
            // has a 'typescript' key, use the associated value as the relative path to the file.
            // Otherwise, use the canonical module-relative path of './typings/<modname>/<modname>.d.ts'.
            // Otherwise, try the module-relative paths of './<modname>.d.ts', then './module.d.ts'.
            var pkgPath = path.join(depPath, 'package.json');
            var pkg = require(pkgPath);
            var srcRelPaths = [
                pkg.typescript || ('./typings/' + depName + '/' + depName + '.d.ts'),
                './' + depName + '.d.ts',
                './module.d.ts'
            ];
            var srcPath = _.find(srcRelPaths.map(rel => path.join(depPath, rel)), fs.existsSync);

            // If the type definition file exists at the target location, continue processing it.
            if (srcPath) {
                located.push(depName);

                // Give feedback.
                log('...found at ' + srcPath);

                // Copy the file to the canonical location of our module. Overwrite anything already there.
                var tgtPath = path.join(basePath, 'typings', depName);
                fsTools.mkdirSync(tgtPath);
                tgtPath = path.join(tgtPath, depName + '.d.ts');
                var content: string = <any> fs.readFileSync(srcPath, { encoding: 'utf8' });
                fs.writeFileSync(tgtPath, content, { encoding: 'utf8' });

                // Find other canonical module references within the file, and add them to the pending list.
                var pattern = /^\/\/\/<reference[ ]+path[ ]*=[ ]*['"]..[/\\][^\/]*[/\\][^.]*[.]d[.]ts['"][ ]*\/>$/gm;
                var refLines = content.match(pattern) || [];
                var refNames = refLines.map(refLine => /[^.]+[.][.][/\\]([^/\\]+)/.exec(refLine)[1]);
                pending = pending.concat(refNames);
            }
        }

        // If the type definition wasn't found locally, look for one on Github/DefinitelyTyped.
        if (!_.contains(located, depName)) {


            // Attempt to get the file over HTTPS from Github/DefinitelyTyped.
            var urlTemplate = 'https://raw.githubusercontent.com/borisyankov/DefinitelyTyped/master/{1}/{2}.d.ts';
            var url = urlTemplate.replace('{1}', depName).replace('{2}', depName);
            try { content = await (httpsGet(url)); } catch (err) { content = null; }

            // If the type definition file exists at the target url, continue processing it.
            if (content) {
                located.push(depName);

                // Give feedback.
                log('...found at ' + url);

                //TODO: address code duplication of next two paras with 'local' case above

                // Create the file at the canonical location of our module. Overwrite anything already there.
                var tgtPath = path.join(basePath, 'typings', depName);
                fsTools.mkdirSync(tgtPath);
                tgtPath = path.join(tgtPath, depName + '.d.ts');
                fs.writeFileSync(tgtPath, content, { encoding: 'utf8' });

                // Find other canonical module references within the file, and add them to the pending list.
                var pattern = /^\/\/\/<reference[ ]+path[ ]*=[ ]*['"]..[/\\][^\/]*[/\\][^.]*[.]d[.]ts['"][ ]*\/>$/gm;
                var refLines = content.match(pattern) || [];
                var refNames = refLines.map(refLine => /[^.]+[.][.][/\\]([^/\\]+)/.exec(refLine)[1]);
                pending = pending.concat(refNames);
            }
        }

        // Give feedback.
        if (!_.contains(located, depName)) {
            log('...NOTHING FOUND');
        }
    }

    // Generate the new reference section of our module's references.d.ts file.
    var prolog = '/*----------findts----------*/';
    var epilog = '/*----------/findts----------*/';
    var section = prolog + EOL +
        '/* NB: This section is generated and maintained by grunt-findts. */'+ EOL +
        '/* NB: Any manual changes here will be overwritten whenever grunt-findts runs. */'+ EOL;
    located.forEach(depName => {
        section += '///<reference path="typings/' + depName + '/' + depName + '.d.ts" />'+ EOL;
    });
    section += epilog;

    // Parse the current references.d.ts, if any.
    var refPath = path.join(basePath, 'references.d.ts');
    var content: string = fs.existsSync(refPath) ? <any> fs.readFileSync(refPath, { encoding: 'utf8' }) : '';
    var start = content.indexOf(prolog), end = content.indexOf(epilog);
    if (end !== -1) end = end + epilog.length;
    if (start === -1 && end === -1) {
        var pre = '', post = EOL + EOL + content;
    }
    else if (start !== -1 && end !== -1 && start < end) {
        var pre = content.substr(0, start);
        var post = content.substr(end);
    }
    else throw new Error('Invalid references.d.ts');

    // Write back the updated references.d.ts with the new section spliced in.
    fs.writeFileSync(refPath, pre + section + post, { encoding: 'utf8' });
});


/** Promise-returning helper method to fetch a resource over HTTPS. */
function httpsGet(url: string) {
    return new Promise((resolve: (s: string) => void, reject) => {
        var chunks = [];
        var req = https.get(url, res => {
            if (res['statusCode'] === 200) {
                res.on('data', data => chunks.push(data));
                res.on('end', () => resolve(chunks.join('')));
                res.on('error', reject);
            }
            else reject(new Error('Expected HTTP status 200 but got ' + res['statusCode']));
        });
        req.on('error', reject);
    });
}
