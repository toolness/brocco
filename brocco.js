"use strict";

// This is a simple port of [Docco][] to the browser, useful for
// projects or developers who are too lazy to deal with a build/deploy step
// for their documentation. This makes it a bit like Docco combined
// with [Code Illuminated][].
//
// Syntax highlighting is optional; as an example, you can see this
// documentation [with][] or [without][] it.
//
// The [source for Brocco][source] is available on GitHub, and released under
// the MIT license.
//
// ## Dependencies
//
// The only required dependencies are `brocco.js`, `docco.css`, and
// `showdown.js`.
//
// ## Usage
//
// After including the requisite scripts and CSS file in a webpage,
// you can render basic documentation like this:
//
//     Brocco.document("myfile.js", function(html) {
//       document.getElementById("mydocs").innerHTML = html;
//     });
//
// By default, Brocco will try to fetch the source file over XHR. If
// you have it on hand, though, you can do this:
//
//     Brocco.document("myfile.js", {
//       code: "console.log('hello world.');"
//     }, function(html) {
//       document.getElementById("docs").innerHTML = html;
//     });
// 
// Syntax highlighting requires a separate third-party library, as well
// as some code to glue things together. See the source code of 
// <code>[syntax-highlighting.html][]</code> for an example of integration
// with [CodeMirror][].
//
//   [source]: https://github.com/toolness/brocco
//   [Docco]: http://jashkenas.github.com/docco/
//   [Code Illuminated]: http://www.toolness.com/wp/?p=441
//   [CodeMirror]: http://codemirror.net/demo/runmode.html
//   [with]: syntax-highlighting.html
//   [without]: index.html
//   [syntax-highlighting.html]: https://github.com/toolness/brocco/blob/gh-pages/syntax-highlighting.html

var Brocco = (function() {
  var version = "0.1.0";
  
  // ## Main Documentation Generation Functions
  
  // Generate the documentation for a source file by (optionally) reading it
  // in, splitting it up into comment/code sections, highlighting them for
  // the appropriate language, and merging them into an HTML template.
  function generateDocumentation(source, config, callback) {
    var code;

    var parseAndHighlight = function() {
      var sections = parse(source, code);
      return highlight(source, sections, config, function() {
        callback(generateHtml(source, sections, config));
      });
    };

    if (typeof(config) != "object") {
      callback = config;
      config = {};
    }

    code = config.code;
    if (!config.template)
      config.template = defaultTemplate;
    
    if (typeof(code) == "undefined") {
      getFile(source, function(contents) {
        code = contents;
        parseAndHighlight();
      });
    } else
      parseAndHighlight();
  }

  // Given a string of source code, parse out each comment and the code that
  // follows it, and create an individual **section** for it.
  // Sections take the form:
  //
  //     {
  //       docsText: ...
  //       docsHtml: ...
  //       codeText: ...
  //       codeHtml: ...
  //     }
  function parse(source, code) {
    var codeText, docsText, hasCode, language, line, lines, save, 
        sections, _i, _len;
    lines = code.split('\n');
    sections = [];
    language = getLanguage(source);
    hasCode = docsText = codeText = '';
    save = function(docsText, codeText) {
      return sections.push({
        docsText: docsText,
        codeText: codeText
      });
    };
    for (_i = 0, _len = lines.length; _i < _len; _i++) {
      line = lines[_i];
      if (line.match(language.commentMatcher) &&
          !line.match(language.commentFilter)) {
        if (hasCode) {
          save(docsText, codeText);
          hasCode = docsText = codeText = '';
        }
        docsText += line.replace(language.commentMatcher, '') + '\n';
      } else {
        hasCode = true;
        codeText += line + '\n';
      }
    }
    save(docsText, codeText);
    return sections;
  };
  
  // Highlights parsed sections of code. Runs the text of
  // their corresponding comments through **Markdown**, using
  // [Showdown.js][]. If no syntax highlighter is present, output the
  // code in plain text.
  //
  // We process all sections with a single call to the syntax highlighter,
  // by inserting marker comments between them, and then splitting the
  // result string wherever the marker occurs.
  //
  //   [Showdown.js]: http://attacklab.net/showdown/
  function highlight(source, sections, config, callback) {
    var section;
    var language = getLanguage(source);
    var text = (function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = sections.length; _i < _len; _i++) {
        section = sections[_i];
        _results.push(section.codeText);
      }
      return _results;
    })();
    var mungedSource = text.join(language.dividerText);
    var highlighter = config.highlighter || defaultHighlighter;
    var showdown = config.showdown || new Showdown.converter();
    highlighter(language, mungedSource, function(output, dividerHtml) {
      var fragments, i, section, _i, _len;
      output = output.replace(highlightStart, '').replace(highlightEnd, '');
      fragments = output.split(dividerHtml);
      for (i = _i = 0, _len = sections.length; _i < _len; i = ++_i) {
        section = sections[i];
        section.codeHtml = highlightStart + fragments[i] + highlightEnd;
        section.docsHtml = showdown.makeHtml(section.docsText);
      }
      return callback();
    });
  }
  
  function generateHtml(source, sections, config) {
    var title = path.basename(source);
    return config.template({
      title: title,
      sections: sections
    });
  };

  // ## Helpers & Setup
  
  // Originally, this was in a separate JSON file, but we're including
  // it inline for simplicity.
  var languages = {
    ".coffee" :
      {"name" : "coffee-script", "symbol" : "#"},
    ".rb":
      {"name" : "ruby", "symbol" : "#"},
    ".py":
      {"name": "python", "symbol" : "#"},
    ".feature":
      {"name" : "gherkin", "symbol" : "#"},
    ".yaml":
      {"name" : "yaml", "symbol" : "#"},
    ".tex":
      {"name" : "tex", "symbol" : "%"},
    ".latex":
      {"name" : "tex", "symbol" : "%"},
    ".js":
      {"name" : "javascript", "symbol" : "//"},
    ".c":
      {"name" : "c", "symbol" : "//"},
    ".h":
      {"name" : "c", "symbol" : "//"},
    ".cpp":
      {"name" : "cpp", "symbol" : "//"},
    ".php":
      {"name" : "php", "symbol" : "//"},
    ".hs":
      {"name" : "haskell", "symbol" : "--"},
    ".erl":
      {"name" : "erlang", "symbol" : "%"},
    ".hrl":
      {"name" : "erlang", "symbol" : "%"}
  };
  var highlightStart = '<div class="highlight"><pre>';
  var highlightEnd = '</pre></div>';
  
  // This is a stand-in for node's `path` module.
  var path = {
    basename: function(p, ext) {
      var lastPart = p.split('/').slice(-1)[0];
      if (ext)
        lastPart = lastPart.slice(0, -(ext.length));
      return lastPart;
    },
    extname: function(filename) {
      return '.' + filename.split('.').slice(-1)[0];
    }
  };

  // This default syntax highlighter really doesn't do any
  // syntax highlighting at all; it just plops the plain-text
  // source code in a `<pre>` element.
  function defaultHighlighter(language, code, cb) {
    // We leverage the DOM to do HTML escaping for us.
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(code));
    var result = '<div class="highlight"><pre>' +
                 div.innerHTML +
                 '</pre></div>\n';
    cb(result, language.dividerText);
  }
  
  // This default template produces an identical DOM to the 
  // [docco.jst][] template used by Docco for single-source files. It's just
  // easier to inline it than grab it via XHR because it complicates
  // the use and deployment of this browser-side script.
  //
  //   [docco.jst]: https://github.com/jashkenas/docco/blob/master/resources/docco.jst
  function defaultTemplate(context) {
    function el(name, attrs, children) {
      var element = document.createElement(name);
      Object.keys(attrs).forEach(function(attr) {
        element.setAttribute(attr, attrs[attr]);
      });
      (children || []).forEach(function(child) {
        if (typeof(child) == "string") {
          var temp = document.createElement("div");
          temp.innerHTML = child;
          for (var i = 0; i < temp.childNodes.length; i++)
            element.appendChild(temp.childNodes[i]);
        } else
          element.appendChild(child);
      });
      return element;
    }

    return el("div", {}, [
      el("div", {id: "container"}, [
        el("div", {id: "background"}),
        el("table", {cellpadding: 0, cellspacing: 0}, [
          el("thead", {}, [
            el("tr", {}, [
              el("th", {"class": "docs"}, [el("h1", {}, [context.title])]),
              el("th", {"class": "code"})
            ])
          ]),
          el("tbody", {}, context.sections.map(function(section, i) {
            return el("tr", {id: "section-" + (i+1)}, [
              el("td", {"class": "docs"}, [
                el("div", {"class": "pilwrap"}, [
                  el("a", {
                    "class": "pilcrow",
                    "href": "#section-" + (i+1)
                  }, ["&#182;"])
                ]),
                section.docsHtml
              ]),
              el("td", {"class": "code"}, [section.codeHtml])
            ]);
          }))
        ])
      ])
    ]).innerHTML;
  }
  
  // Retrieve the given file over XHR.
  function getFile(path, cb) {
    var req = new XMLHttpRequest();
    req.open("GET", path);
    req.onload = function() { cb(req.responseText); };
    req.send(null);
  }
  
  // Get the current language we're documenting, based on the extension.
  function getLanguage(source) {
    return languages[path.extname(source)];
  };
  
  // Build out the appropriate matchers and delimiters for each language.
  function processLanguages(languages) {
    for (var ext in languages) {
      var l = languages[ext];
      // Does the line begin with a comment?
      l.commentMatcher = RegExp("^\\s*" + l.symbol + "\\s?");
      
      // Ignore [hashbangs][] and interpolations...
      //
      //   [hashbangs]: http://en.wikipedia.org/wiki/Shebang_(Unix\)
      l.commentFilter = /(^#![/]|^\s*#\{)/;
        
      // The dividing token we feed into the syntax highlighter, to delimit
      // the boundaries between sections.
      l.dividerText = "\n" + l.symbol + "DIVIDER\n";
    }
  }
  
  processLanguages(languages);
  
  // ## Exports
  //
  // Information about Brocco, and functions for programmatic usage.
  return {
    version: version,
    document: generateDocumentation,
    defaultHighlighter: defaultHighlighter,
    languages: languages
  };
})();
