// **docco-browser-shim.js** provides a fake nodejs environment
// for docco to run in the browser.

// For now, we need to actually specify the filename to document
// here. It also needs to be a JS file.
var FILE_TO_DOCUMENT = "docco-browser-shim.js";

var Docco = (function() {
  var DIVIDER_TEXT = /^\/\/DIVIDER$/gm;
  var DIVIDER_HTML = '<span class="c">//DIVIDER</span>';
  var DIR_PREFIX = "node_modules/docco/";
  var STYLESHEET_LINK = '  <link rel="stylesheet" media="all" ' +
                        'href="docco.css" />';
  var FILE_CONTENTS = {};
  var FILES = [
    "package.json",
    "resources/docco.css",
    "resources/docco.jst",
    "resources/languages.json",
    "vendor/showdown.js",
    "lib/docco.js"
  ];

  FILES.forEach(function(filename) {
    var req = new XMLHttpRequest();
    req.open("GET", DIR_PREFIX + filename);
    req.onload = function() {
      FILE_CONTENTS[filename] = req.responseText;
      if (Object.keys(FILE_CONTENTS).length == FILES.length) {
        var Showdown = loadShowdown(FILE_CONTENTS["vendor/showdown.js"]);
        modules['./../vendor/showdown'] = Showdown;
        var docco = loadDocco(FILE_CONTENTS["lib/docco.js"]);
        docco.document([FILE_TO_DOCUMENT], null, function() {
          var basename = modules.path.basename(FILE_TO_DOCUMENT, '.js');
          var html = filesOutput["docs/" + basename + ".html"];
          var css = filesOutput["docs/docco.css"];
          html = html.replace(STYLESHEET_LINK, "<style>" + css + "</style>");
          document.open();
          document.write(html);
          document.close();
        });
      }
    };
    req.send(null);
  });
  
  var loadDocco = function(doccoJs) {
    var code = "(function(exports, require, __dirname) {" +
               doccoJs +
               "})";
    var makeDoccoExports = eval(code);
    var exports = {};
    makeDoccoExports(exports, require, "");
    return exports;
  };
  
  var loadShowdown = function(showdownJs) {
    var code = "(function(exports) {" + showdownJs + "})";
    var makeShowdownExports = eval(code);
    var exports = {};
    makeShowdownExports(exports);
    console.log("EXPORTS", Object.keys(exports));
    return exports;
  };
  
  var filesOutput = {};
  var modules = {
    'fs': {
      readFile: function(filename, cb) {
        console.log("READFILE", filename);
        var req = new XMLHttpRequest();
        req.open("GET", filename);
        req.onload = function() {
          cb(null, req.responseText);
        };
        req.send(null);
      },
      readFileSync: function(filename) {
        console.log("readFileSync", filename);
        return FILE_CONTENTS[filename.slice(4)];
      },
      writeFileSync: function(path, content) {
        filesOutput[path] = content;
        console.log("writeFileSync", path);
      }
    },
    'path': {
      basename: function(p, ext) {
        var lastPart = p.split('/').slice(-1)[0];
        if (ext)
          lastPart = lastPart.slice(0, -(ext.length));
        console.log("BASENAME", p, ext, "IS", lastPart);
        return lastPart;
      },
      extname: function(filename) {
        console.log("extname", filename);
        return '.' + filename.split('.').slice(-1)[0];
      },
      join: function() {
        return [].slice.call(arguments).join('/')
          .replace(/\/\//g, '/');
      }
    },
    './../vendor/showdown': {},
    'child_process': {
      exec: function(cmdline, cb) {
        console.log("EXEC", cmdline);
        setTimeout(cb, 0);
      },
      spawn: function(executable, args) {
        console.log("SPAWN", executable, args);
        var process = {
          _cb: null,
          on: function(name, cb) {
            console.log("process.on()", name);
            this._cb = cb;
          },
          stderr: {on: function() {}},
          stdout: {
            _cb: null,
            on: function(name, cb) {
              this._cb = cb;
            }
          },
          stdin: {
            writable: true,
            on: function() {},
            write: function(content) {
              setTimeout(function() {
                var div = document.createElement('div');
                div.appendChild(document.createTextNode(content));
                var result = '<div class="highlight"><pre>' +
                             div.innerHTML +
                             '</pre></div>\n';
                result = result.replace(DIVIDER_TEXT, DIVIDER_HTML);
                console.log(result.indexOf("//DIVIDER"));
                process.stdout._cb(result);
                process._cb();
              }, 0);
            },
            end: function() {}
          }
        };
        return process;
      }
    },
    'commander': {
    }
  };
  
  var require = function(module) {
    console.log("REQUIRE", module);
    return modules[module];
  };
  
  return {};
})();
