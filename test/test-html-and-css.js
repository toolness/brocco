(function() {
  module("html-and-css");
  
  function makeSections(ext, code, fn) {
    var sections;
    Brocco.languages[ext].makeSections("", code, {}, function(s) {
      sections = s;
    });
    return sections;
  }
  
  test("works when /* */ comment follows // comment", function() {
    var code = '<script>// hi\n/* there */</' + 'script>';
    deepEqual(makeSections(".html", code).map(function(section) {
      return section.docsText;
    }), ['', 'hi\n', 'there ']);
  });
  
  test("works with HTML comments", function() {
    var code = '<br><!-- hi\n    there -->\n<p>sup</p>';
    deepEqual(makeSections(".html", code).map(function(section) {
      return section.docsText;
    }), ['', 'hi\nthere ']);
  });
  
  test("works w/ .css files", function() {
    var code = 'body {\n  /* cool */\n  color: blue;\n}\n';
    deepEqual(makeSections(".css", code).map(function(section) {
      return section.docsText;
    }), ['', 'cool ']);
  });
})();
