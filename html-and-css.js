(function() {
  var START_COMMENT_REGEXP = /^(\<\!--|\/\*|\/\/)(\s*)(.*)/;
  var START_COMMENT_MODES = {
    '<!--': 'html',
    '/*': 'cmultiline',
    '//': 'csingleline'
  };
  var END_COMMENT_REGEXPS = {
    'html': /(.*)--\>$/,
    'cmultiline': /(.*)\*\/$/
  };
  
  if (typeof(CodeMirror) == "undefined")
    return;

  Brocco.addLanguages({
    '.html': {
      name : "htmlmixed",
      symbol : "",
      makeSections: makeMixedHtmlSections
    }
  });

  function makeMixedHtmlSections(source, code, config, cb) {
    var mode = CodeMirror.getMode(CodeMirror.defaults, {
      name: "htmlmixed"
    });
    
    var sections = [];
    var section = {};
    var commentMode = null;
    var commentIndent = 0;
    var match;
    var esc = Brocco.htmlEscape;
    var accum = [], col = 0;
    var finishSection = function() {
      if (!section.docsText)
        section.docsText = "";
      section.codeHtml = "<pre>" + accum.join("") + "</pre>";
      sections.push(section);
      section = {};
      accum = [];
    };
    var onText = function(text, style) {
      if (text == "\n") {
        accum.push("\n");
        col = 0;
        return;
      }
      if (!commentMode && style == "comment") {
        match = text.match(START_COMMENT_REGEXP);
        if (match) {
          commentMode = START_COMMENT_MODES[match[1]];
          commentIndent = col + match[1].length;
          if (match[2]) commentIndent += match[2].length;
          finishSection();
          text = match[3];
        }
      }
      if (commentMode) {
        if (commentMode == "html" && style === null && col == 0)
          text = text.slice(commentIndent);
        if (style == "comment") {
          if (commentMode == 'cmultiline' && col == 0 &&
              accum.length && text.trim() != '*/' &&
              text.slice(0, commentIndent).match(/^[\s*]+$/))
            text = text.slice(commentIndent);
          if (commentMode in END_COMMENT_REGEXPS) {
            match = text.match(END_COMMENT_REGEXPS[commentMode]);
            if (match) {
              commentMode = null;
              accum.push(match[1]);
              section.docsText = accum.join("");
              accum = [];
              col += text.length;
              return;
            }
          }
        }
      } else {
        col += text.length;
        if (Brocco.codeMirrorStyleMap[style])
          style = Brocco.codeMirrorStyleMap[style] + " cm-" + style;
        else
          style = "cm-" + style;
        accum.push("<span class=\"" + esc(style) +
                   "\">" + esc(text) + "</span>");
        return;
      }
      col += text.length;
      accum.push(text);
    };
  
    var lines = CodeMirror.splitLines(code),
        state = CodeMirror.startState(mode);
    for (var i = 0, e = lines.length; i < e; ++i) {
      if (i) onText("\n");
      var stream = new CodeMirror.StringStream(lines[i]);
      while (!stream.eol()) {
        var style = mode.token(stream, state);
        onText(stream.current(), style, i, stream.start);
        stream.start = stream.pos;
      }
    }
  
    if (accum.length || section.docsText)
      finishSection();
    
    cb(sections);
  }
})();
