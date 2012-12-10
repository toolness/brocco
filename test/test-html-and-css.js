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
})();
