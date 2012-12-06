"use strict";

// This is a simple port of [docco][] to the browser.
//
//   [docco]: http://jashkenas.github.com/docco/

var Brocco = (function() {
  var version = "0.1.0";
  
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
  function defaultHighlightSyntax(language, code, cb) {
    // We'll leverage the DOM to do HTML escaping for us.
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(code));
    var result = '<div class="highlight"><pre>' +
                 div.innerHTML +
                 '</pre></div>\n';
    // We need to make sure that the dividers that docco munges
    // into the code are properly formatted to *look* like
    // syntax highlighting, so that docco is able to process
    // our output properly.
    var parts = result.split(language.dividerText);
    var html = parts.join('\n<span class="c">' + language.symbol + 
                          'DIVIDER</span>\n');
    cb(html);
  }
  
  function getFile(path, cb) {
    var req = new XMLHttpRequest();
    req.open("GET", path);
    req.onload = function() { cb(req.responseText); };
    req.send(null);
  }
  
  function generateDocumentation(source, code, config, callback) {
    var parseAndHighlight = function() {
      var sections = parse(source, code);
      return highlight(source, sections, config, function() {
        callback(generateHtml(source, sections, config));
      });
    };

    var processConfig = function() {
      if (typeof(config.template) == "string") {
        getFile(config.template, function(contents) {
          config.template = template(contents);
          parseAndHighlight();
        });
      } else
        parseAndHighlight();
    };
    
    if (typeof(code) == "object") {
      callback = config;
      config = code;
      getFile(source, function(contents) {
        code = contents;
        processConfig();
      });
    } else
      processConfig();
  }

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
    var highlight = config.highlightSyntax || defaultHighlightSyntax;
    var showdown = config.showdown || new Showdown.converter();
    highlight(language, mungedSource, function(output) {
      var fragments, i, section, _i, _len;
      output = output.replace(highlightStart, '').replace(highlightEnd, '');
      fragments = output.split(language.dividerHtml);
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

  function getLanguage(source) {
    return languages[path.extname(source)];
  };

  function template(str) {
    return new Function('obj',
      'var p=[],print=function(){p.push.apply(p,arguments);};' +
      'with(obj){p.push(\'' + 
      str.replace(/[\r\t\n]/g, " ").replace(/'(?=[^<]*%>)/g, "\t")
         .split("'").join("\\'").split("\t").join("'")
         .replace(/<%=(.+?)%>/g, "',$1,'").split('<%').join("');")
         .split('%>').join("p.push('") + "');}return p.join('');");
  };
  
  function processLanguages(languages) {
    for (var ext in languages) {
      var l = languages[ext];
      l.commentMatcher = RegExp("^\\s*" + l.symbol + "\\s?");
      l.commentFilter = /(^#![/]|^\s*#\{)/;
      l.dividerText = "\n" + l.symbol + "DIVIDER\n";
      l.dividerHtml = RegExp("\\n*<span\\sclass=\"c1?\">" + l.symbol +
                             "DIVIDER<\\/span>\\n*");
    }
  }
  
  processLanguages(languages);
  
  return {
    version: version,
    document: generateDocumentation,
    template: template,
    languages: languages
  };
})();
