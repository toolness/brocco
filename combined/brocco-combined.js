(function() {
  // This file contains Brocco with all optional dependencies for
  // documenting HTML, CSS, and JS.

  // Begin vendor/showdown.js

  //
  // showdown.js -- A javascript port of Markdown.
  //
  // Copyright (c) 2007 John Fraser.
  //
  // Original Markdown Copyright (c) 2004-2005 John Gruber
  //   <http://daringfireball.net/projects/markdown/>
  //
  // Redistributable under a BSD-style open source license.
  // See license.txt for more information.
  //
  // The full source distribution is at:
  //
  //				A A L
  //				T C A
  //				T K B
  //
  //   <http://www.attacklab.net/>
  //
  
  //
  // Wherever possible, Showdown is a straight, line-by-line port
  // of the Perl version of Markdown.
  //
  // This is not a normal parser design; it's basically just a
  // series of string substitutions.  It's hard to read and
  // maintain this way,  but keeping Showdown close to the original
  // design makes it easier to port new features.
  //
  // More importantly, Showdown behaves like markdown.pl in most
  // edge cases.  So web applications can do client-side preview
  // in Javascript, and then build identical HTML on the server.
  //
  // This port needs the new RegExp functionality of ECMA 262,
  // 3rd Edition (i.e. Javascript 1.5).  Most modern web browsers
  // should do fine.  Even with the new regular expression features,
  // We do a lot of work to emulate Perl's regex functionality.
  // The tricky changes in this file mostly have the "attacklab:"
  // label.  Major or self-explanatory changes don't.
  //
  // Smart diff tools like Araxis Merge will be able to match up
  // this file with markdown.pl in a useful way.  A little tweaking
  // helps: in a copy of markdown.pl, replace "#" with "//" and
  // replace "$text" with "text".  Be sure to ignore whitespace
  // and line endings.
  //
  
  
  //
  // Showdown usage:
  //
  //   var text = "Markdown *rocks*.";
  //
  //   var converter = new Showdown.converter();
  //   var html = converter.makeHtml(text);
  //
  //   alert(html);
  //
  // Note: move the sample code to the bottom of this
  // file before uncommenting it.
  //
  
  
  //
  // Showdown namespace
  //
  var Showdown = {};
  
  //
  // converter
  //
  // Wraps all "globals" so that the only thing
  // exposed is makeHtml().
  //
  Showdown.converter = function() {
  
  //
  // Globals:
  //
  
  // Global hashes, used by various utility routines
  var g_urls;
  var g_titles;
  var g_html_blocks;
  
  // Used to track when we're inside an ordered or unordered list
  // (see _ProcessListItems() for details):
  var g_list_level = 0;
  
  
  this.makeHtml = function(text) {
  //
  // Main function. The order in which other subs are called here is
  // essential. Link and image substitutions need to happen before
  // _EscapeSpecialCharsWithinTagAttributes(), so that any *'s or _'s in the <a>
  // and <img> tags get encoded.
  //
  
  	// Clear the global hashes. If we don't clear these, you get conflicts
  	// from other articles when generating a page which contains more than
  	// one article (e.g. an index page that shows the N most recent
  	// articles):
  	g_urls = new Array();
  	g_titles = new Array();
  	g_html_blocks = new Array();
  
  	// attacklab: Replace ~ with ~T
  	// This lets us use tilde as an escape char to avoid md5 hashes
  	// The choice of character is arbitray; anything that isn't
      // magic in Markdown will work.
  	text = text.replace(/~/g,"~T");
  
  	// attacklab: Replace $ with ~D
  	// RegExp interprets $ as a special character
  	// when it's in a replacement string
  	text = text.replace(/\$/g,"~D");
  
  	// Standardize line endings
  	text = text.replace(/\r\n/g,"\n"); // DOS to Unix
  	text = text.replace(/\r/g,"\n"); // Mac to Unix
  
  	// Make sure text begins and ends with a couple of newlines:
  	text = "\n\n" + text + "\n\n";
  
  	// Convert all tabs to spaces.
  	text = _Detab(text);
  
  	// Strip any lines consisting only of spaces and tabs.
  	// This makes subsequent regexen easier to write, because we can
  	// match consecutive blank lines with /\n+/ instead of something
  	// contorted like /[ \t]*\n+/ .
  	text = text.replace(/^[ \t]+$/mg,"");
  
  	// Turn block-level HTML blocks into hash entries
  	text = _HashHTMLBlocks(text);
  
  	// Strip link definitions, store in hashes.
  	text = _StripLinkDefinitions(text);
  
  	text = _RunBlockGamut(text);
  
  	text = _UnescapeSpecialChars(text);
  
  	// attacklab: Restore dollar signs
  	text = text.replace(/~D/g,"$$");
  
  	// attacklab: Restore tildes
  	text = text.replace(/~T/g,"~");
  
  	return text;
  }
  
  
  var _StripLinkDefinitions = function(text) {
  //
  // Strips link definitions from text, stores the URLs and titles in
  // hash references.
  //
  
  	// Link defs are in the form: ^[id]: url "optional title"
  
  	/*
  		var text = text.replace(/
  				^[ ]{0,3}\[(.+)\]:  // id = $1  attacklab: g_tab_width - 1
  				  [ \t]*
  				  \n?				// maybe *one* newline
  				  [ \t]*
  				<?(\S+?)>?			// url = $2
  				  [ \t]*
  				  \n?				// maybe one newline
  				  [ \t]*
  				(?:
  				  (\n*)				// any lines skipped = $3 attacklab: lookbehind removed
  				  ["(]
  				  (.+?)				// title = $4
  				  [")]
  				  [ \t]*
  				)?					// title is optional
  				(?:\n+|$)
  			  /gm,
  			  function(){...});
  	*/
  	var text = text.replace(/^[ ]{0,3}\[(.+)\]:[ \t]*\n?[ \t]*<?(\S+?)>?[ \t]*\n?[ \t]*(?:(\n*)["(](.+?)[")][ \t]*)?(?:\n+|\Z)/gm,
  		function (wholeMatch,m1,m2,m3,m4) {
  			m1 = m1.toLowerCase();
  			g_urls[m1] = _EncodeAmpsAndAngles(m2);  // Link IDs are case-insensitive
  			if (m3) {
  				// Oops, found blank lines, so it's not a title.
  				// Put back the parenthetical statement we stole.
  				return m3+m4;
  			} else if (m4) {
  				g_titles[m1] = m4.replace(/"/g,"&quot;");
  			}
  
  			// Completely remove the definition from the text
  			return "";
  		}
  	);
  
  	return text;
  }
  
  
  var _HashHTMLBlocks = function(text) {
  	// attacklab: Double up blank lines to reduce lookaround
  	text = text.replace(/\n/g,"\n\n");
  
  	// Hashify HTML blocks:
  	// We only want to do this for block-level HTML tags, such as headers,
  	// lists, and tables. That's because we still want to wrap <p>s around
  	// "paragraphs" that are wrapped in non-block-level tags, such as anchors,
  	// phrase emphasis, and spans. The list of tags we're looking for is
  	// hard-coded:
  	var block_tags_a = "p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|ins|del"
  	var block_tags_b = "p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math"
  
  	// First, look for nested blocks, e.g.:
  	//   <div>
  	//     <div>
  	//     tags for inner block must be indented.
  	//     </div>
  	//   </div>
  	//
  	// The outermost tags must start at the left margin for this to match, and
  	// the inner nested divs must be indented.
  	// We need to do this before the next, more liberal match, because the next
  	// match will start at the first `<div>` and stop at the first `</div>`.
  
  	// attacklab: This regex can be expensive when it fails.
  	/*
  		var text = text.replace(/
  		(						// save in $1
  			^					// start of line  (with /m)
  			<($block_tags_a)	// start tag = $2
  			\b					// word break
  								// attacklab: hack around khtml/pcre bug...
  			[^\r]*?\n			// any number of lines, minimally matching
  			</\2>				// the matching end tag
  			[ \t]*				// trailing spaces/tabs
  			(?=\n+)				// followed by a newline
  		)						// attacklab: there are sentinel newlines at end of document
  		/gm,function(){...}};
  	*/
  	text = text.replace(/^(<(p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math|ins|del)\b[^\r]*?\n<\/\2>[ \t]*(?=\n+))/gm,hashElement);
  
  	//
  	// Now match more liberally, simply from `\n<tag>` to `</tag>\n`
  	//
  
  	/*
  		var text = text.replace(/
  		(						// save in $1
  			^					// start of line  (with /m)
  			<($block_tags_b)	// start tag = $2
  			\b					// word break
  								// attacklab: hack around khtml/pcre bug...
  			[^\r]*?				// any number of lines, minimally matching
  			.*</\2>				// the matching end tag
  			[ \t]*				// trailing spaces/tabs
  			(?=\n+)				// followed by a newline
  		)						// attacklab: there are sentinel newlines at end of document
  		/gm,function(){...}};
  	*/
  	text = text.replace(/^(<(p|div|h[1-6]|blockquote|pre|table|dl|ol|ul|script|noscript|form|fieldset|iframe|math)\b[^\r]*?.*<\/\2>[ \t]*(?=\n+)\n)/gm,hashElement);
  
  	// Special case just for <hr />. It was easier to make a special case than
  	// to make the other regex more complicated.
  
  	/*
  		text = text.replace(/
  		(						// save in $1
  			\n\n				// Starting after a blank line
  			[ ]{0,3}
  			(<(hr)				// start tag = $2
  			\b					// word break
  			([^<>])*?			//
  			\/?>)				// the matching end tag
  			[ \t]*
  			(?=\n{2,})			// followed by a blank line
  		)
  		/g,hashElement);
  	*/
  	text = text.replace(/(\n[ ]{0,3}(<(hr)\b([^<>])*?\/?>)[ \t]*(?=\n{2,}))/g,hashElement);
  
  	// Special case for standalone HTML comments:
  
  	/*
  		text = text.replace(/
  		(						// save in $1
  			\n\n				// Starting after a blank line
  			[ ]{0,3}			// attacklab: g_tab_width - 1
  			<!
  			(--[^\r]*?--\s*)+
  			>
  			[ \t]*
  			(?=\n{2,})			// followed by a blank line
  		)
  		/g,hashElement);
  	*/
  	text = text.replace(/(\n\n[ ]{0,3}<!(--[^\r]*?--\s*)+>[ \t]*(?=\n{2,}))/g,hashElement);
  
  	// PHP and ASP-style processor instructions (<?...?> and <%...%>)
  
  	/*
  		text = text.replace(/
  		(?:
  			\n\n				// Starting after a blank line
  		)
  		(						// save in $1
  			[ ]{0,3}			// attacklab: g_tab_width - 1
  			(?:
  				<([?%])			// $2
  				[^\r]*?
  				\2>
  			)
  			[ \t]*
  			(?=\n{2,})			// followed by a blank line
  		)
  		/g,hashElement);
  	*/
  	text = text.replace(/(?:\n\n)([ ]{0,3}(?:<([?%])[^\r]*?\2>)[ \t]*(?=\n{2,}))/g,hashElement);
  
  	// attacklab: Undo double lines (see comment at top of this function)
  	text = text.replace(/\n\n/g,"\n");
  	return text;
  }
  
  var hashElement = function(wholeMatch,m1) {
  	var blockText = m1;
  
  	// Undo double lines
  	blockText = blockText.replace(/\n\n/g,"\n");
  	blockText = blockText.replace(/^\n/,"");
  
  	// strip trailing blank lines
  	blockText = blockText.replace(/\n+$/g,"");
  
  	// Replace the element text with a marker ("~KxK" where x is its key)
  	blockText = "\n\n~K" + (g_html_blocks.push(blockText)-1) + "K\n\n";
  
  	return blockText;
  };
  
  var _RunBlockGamut = function(text) {
  //
  // These are all the transformations that form block-level
  // tags like paragraphs, headers, and list items.
  //
  	text = _DoHeaders(text);
  
  	// Do Horizontal Rules:
  	var key = hashBlock("<hr />");
  	text = text.replace(/^[ ]{0,2}([ ]?\*[ ]?){3,}[ \t]*$/gm,key);
  	text = text.replace(/^[ ]{0,2}([ ]?\-[ ]?){3,}[ \t]*$/gm,key);
  	text = text.replace(/^[ ]{0,2}([ ]?\_[ ]?){3,}[ \t]*$/gm,key);
  
  	text = _DoLists(text);
  	text = _DoCodeBlocks(text);
  	text = _DoBlockQuotes(text);
  
  	// We already ran _HashHTMLBlocks() before, in Markdown(), but that
  	// was to escape raw HTML in the original Markdown source. This time,
  	// we're escaping the markup we've just created, so that we don't wrap
  	// <p> tags around block-level tags.
  	text = _HashHTMLBlocks(text);
  	text = _FormParagraphs(text);
  
  	return text;
  }
  
  
  var _RunSpanGamut = function(text) {
  //
  // These are all the transformations that occur *within* block-level
  // tags like paragraphs, headers, and list items.
  //
  
  	text = _DoCodeSpans(text);
  	text = _EscapeSpecialCharsWithinTagAttributes(text);
  	text = _EncodeBackslashEscapes(text);
  
  	// Process anchor and image tags. Images must come first,
  	// because ![foo][f] looks like an anchor.
  	text = _DoImages(text);
  	text = _DoAnchors(text);
  
  	// Make links out of things like `<http://example.com/>`
  	// Must come after _DoAnchors(), because you can use < and >
  	// delimiters in inline links like [this](<url>).
  	text = _DoAutoLinks(text);
  	text = _EncodeAmpsAndAngles(text);
  	text = _DoItalicsAndBold(text);
  
  	// Do hard breaks:
  	text = text.replace(/  +\n/g," <br />\n");
  
  	return text;
  }
  
  var _EscapeSpecialCharsWithinTagAttributes = function(text) {
  //
  // Within tags -- meaning between < and > -- encode [\ ` * _] so they
  // don't conflict with their use in Markdown for code, italics and strong.
  //
  
  	// Build a regex to find HTML tags and comments.  See Friedl's
  	// "Mastering Regular Expressions", 2nd Ed., pp. 200-201.
  	var regex = /(<[a-z\/!$]("[^"]*"|'[^']*'|[^'">])*>|<!(--.*?--\s*)+>)/gi;
  
  	text = text.replace(regex, function(wholeMatch) {
  		var tag = wholeMatch.replace(/(.)<\/?code>(?=.)/g,"$1`");
  		tag = escapeCharacters(tag,"\\`*_");
  		return tag;
  	});
  
  	return text;
  }
  
  var _DoAnchors = function(text) {
  //
  // Turn Markdown link shortcuts into XHTML <a> tags.
  //
  	//
  	// First, handle reference-style links: [link text] [id]
  	//
  
  	/*
  		text = text.replace(/
  		(							// wrap whole match in $1
  			\[
  			(
  				(?:
  					\[[^\]]*\]		// allow brackets nested one level
  					|
  					[^\[]			// or anything else
  				)*
  			)
  			\]
  
  			[ ]?					// one optional space
  			(?:\n[ ]*)?				// one optional newline followed by spaces
  
  			\[
  			(.*?)					// id = $3
  			\]
  		)()()()()					// pad remaining backreferences
  		/g,_DoAnchors_callback);
  	*/
  	text = text.replace(/(\[((?:\[[^\]]*\]|[^\[\]])*)\][ ]?(?:\n[ ]*)?\[(.*?)\])()()()()/g,writeAnchorTag);
  
  	//
  	// Next, inline-style links: [link text](url "optional title")
  	//
  
  	/*
  		text = text.replace(/
  			(						// wrap whole match in $1
  				\[
  				(
  					(?:
  						\[[^\]]*\]	// allow brackets nested one level
  					|
  					[^\[\]]			// or anything else
  				)
  			)
  			\]
  			\(						// literal paren
  			[ \t]*
  			()						// no id, so leave $3 empty
  			<?(.*?)>?				// href = $4
  			[ \t]*
  			(						// $5
  				(['"])				// quote char = $6
  				(.*?)				// Title = $7
  				\6					// matching quote
  				[ \t]*				// ignore any spaces/tabs between closing quote and )
  			)?						// title is optional
  			\)
  		)
  		/g,writeAnchorTag);
  	*/
  	text = text.replace(/(\[((?:\[[^\]]*\]|[^\[\]])*)\]\([ \t]*()<?(.*?)>?[ \t]*((['"])(.*?)\6[ \t]*)?\))/g,writeAnchorTag);
  
  	//
  	// Last, handle reference-style shortcuts: [link text]
  	// These must come last in case you've also got [link test][1]
  	// or [link test](/foo)
  	//
  
  	/*
  		text = text.replace(/
  		(		 					// wrap whole match in $1
  			\[
  			([^\[\]]+)				// link text = $2; can't contain '[' or ']'
  			\]
  		)()()()()()					// pad rest of backreferences
  		/g, writeAnchorTag);
  	*/
  	text = text.replace(/(\[([^\[\]]+)\])()()()()()/g, writeAnchorTag);
  
  	return text;
  }
  
  var writeAnchorTag = function(wholeMatch,m1,m2,m3,m4,m5,m6,m7) {
  	if (m7 == undefined) m7 = "";
  	var whole_match = m1;
  	var link_text   = m2;
  	var link_id	 = m3.toLowerCase();
  	var url		= m4;
  	var title	= m7;
  
  	if (url == "") {
  		if (link_id == "") {
  			// lower-case and turn embedded newlines into spaces
  			link_id = link_text.toLowerCase().replace(/ ?\n/g," ");
  		}
  		url = "#"+link_id;
  
  		if (g_urls[link_id] != undefined) {
  			url = g_urls[link_id];
  			if (g_titles[link_id] != undefined) {
  				title = g_titles[link_id];
  			}
  		}
  		else {
  			if (whole_match.search(/\(\s*\)$/m)>-1) {
  				// Special case for explicit empty url
  				url = "";
  			} else {
  				return whole_match;
  			}
  		}
  	}
  
  	url = escapeCharacters(url,"*_");
  	var result = "<a href=\"" + url + "\"";
  
  	if (title != "") {
  		title = title.replace(/"/g,"&quot;");
  		title = escapeCharacters(title,"*_");
  		result +=  " title=\"" + title + "\"";
  	}
  
  	result += ">" + link_text + "</a>";
  
  	return result;
  }
  
  
  var _DoImages = function(text) {
  //
  // Turn Markdown image shortcuts into <img> tags.
  //
  
  	//
  	// First, handle reference-style labeled images: ![alt text][id]
  	//
  
  	/*
  		text = text.replace(/
  		(						// wrap whole match in $1
  			!\[
  			(.*?)				// alt text = $2
  			\]
  
  			[ ]?				// one optional space
  			(?:\n[ ]*)?			// one optional newline followed by spaces
  
  			\[
  			(.*?)				// id = $3
  			\]
  		)()()()()				// pad rest of backreferences
  		/g,writeImageTag);
  	*/
  	text = text.replace(/(!\[(.*?)\][ ]?(?:\n[ ]*)?\[(.*?)\])()()()()/g,writeImageTag);
  
  	//
  	// Next, handle inline images:  ![alt text](url "optional title")
  	// Don't forget: encode * and _
  
  	/*
  		text = text.replace(/
  		(						// wrap whole match in $1
  			!\[
  			(.*?)				// alt text = $2
  			\]
  			\s?					// One optional whitespace character
  			\(					// literal paren
  			[ \t]*
  			()					// no id, so leave $3 empty
  			<?(\S+?)>?			// src url = $4
  			[ \t]*
  			(					// $5
  				(['"])			// quote char = $6
  				(.*?)			// title = $7
  				\6				// matching quote
  				[ \t]*
  			)?					// title is optional
  		\)
  		)
  		/g,writeImageTag);
  	*/
  	text = text.replace(/(!\[(.*?)\]\s?\([ \t]*()<?(\S+?)>?[ \t]*((['"])(.*?)\6[ \t]*)?\))/g,writeImageTag);
  
  	return text;
  }
  
  var writeImageTag = function(wholeMatch,m1,m2,m3,m4,m5,m6,m7) {
  	var whole_match = m1;
  	var alt_text   = m2;
  	var link_id	 = m3.toLowerCase();
  	var url		= m4;
  	var title	= m7;
  
  	if (!title) title = "";
  
  	if (url == "") {
  		if (link_id == "") {
  			// lower-case and turn embedded newlines into spaces
  			link_id = alt_text.toLowerCase().replace(/ ?\n/g," ");
  		}
  		url = "#"+link_id;
  
  		if (g_urls[link_id] != undefined) {
  			url = g_urls[link_id];
  			if (g_titles[link_id] != undefined) {
  				title = g_titles[link_id];
  			}
  		}
  		else {
  			return whole_match;
  		}
  	}
  
  	alt_text = alt_text.replace(/"/g,"&quot;");
  	url = escapeCharacters(url,"*_");
  	var result = "<img src=\"" + url + "\" alt=\"" + alt_text + "\"";
  
  	// attacklab: Markdown.pl adds empty title attributes to images.
  	// Replicate this bug.
  
  	//if (title != "") {
  		title = title.replace(/"/g,"&quot;");
  		title = escapeCharacters(title,"*_");
  		result +=  " title=\"" + title + "\"";
  	//}
  
  	result += " />";
  
  	return result;
  }
  
  
  var _DoHeaders = function(text) {
  
  	// Setext-style headers:
  	//	Header 1
  	//	========
  	//
  	//	Header 2
  	//	--------
  	//
  	text = text.replace(/^(.+)[ \t]*\n=+[ \t]*\n+/gm,
  		function(wholeMatch,m1){return hashBlock("<h1>" + _RunSpanGamut(m1) + "</h1>");});
  
  	text = text.replace(/^(.+)[ \t]*\n-+[ \t]*\n+/gm,
  		function(matchFound,m1){return hashBlock("<h2>" + _RunSpanGamut(m1) + "</h2>");});
  
  	// atx-style headers:
  	//  # Header 1
  	//  ## Header 2
  	//  ## Header 2 with closing hashes ##
  	//  ...
  	//  ###### Header 6
  	//
  
  	/*
  		text = text.replace(/
  			^(\#{1,6})				// $1 = string of #'s
  			[ \t]*
  			(.+?)					// $2 = Header text
  			[ \t]*
  			\#*						// optional closing #'s (not counted)
  			\n+
  		/gm, function() {...});
  	*/
  
  	text = text.replace(/^(\#{1,6})[ \t]*(.+?)[ \t]*\#*\n+/gm,
  		function(wholeMatch,m1,m2) {
  			var h_level = m1.length;
  			return hashBlock("<h" + h_level + ">" + _RunSpanGamut(m2) + "</h" + h_level + ">");
  		});
  
  	return text;
  }
  
  // This declaration keeps Dojo compressor from outputting garbage:
  var _ProcessListItems;
  
  var _DoLists = function(text) {
  //
  // Form HTML ordered (numbered) and unordered (bulleted) lists.
  //
  
  	// attacklab: add sentinel to hack around khtml/safari bug:
  	// http://bugs.webkit.org/show_bug.cgi?id=11231
  	text += "~0";
  
  	// Re-usable pattern to match any entirel ul or ol list:
  
  	/*
  		var whole_list = /
  		(									// $1 = whole list
  			(								// $2
  				[ ]{0,3}					// attacklab: g_tab_width - 1
  				([*+-]|\d+[.])				// $3 = first list item marker
  				[ \t]+
  			)
  			[^\r]+?
  			(								// $4
  				~0							// sentinel for workaround; should be $
  			|
  				\n{2,}
  				(?=\S)
  				(?!							// Negative lookahead for another list item marker
  					[ \t]*
  					(?:[*+-]|\d+[.])[ \t]+
  				)
  			)
  		)/g
  	*/
  	var whole_list = /^(([ ]{0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(~0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/gm;
  
  	if (g_list_level) {
  		text = text.replace(whole_list,function(wholeMatch,m1,m2) {
  			var list = m1;
  			var list_type = (m2.search(/[*+-]/g)>-1) ? "ul" : "ol";
  
  			// Turn double returns into triple returns, so that we can make a
  			// paragraph for the last item in a list, if necessary:
  			list = list.replace(/\n{2,}/g,"\n\n\n");;
  			var result = _ProcessListItems(list);
  
  			// Trim any trailing whitespace, to put the closing `</$list_type>`
  			// up on the preceding line, to get it past the current stupid
  			// HTML block parser. This is a hack to work around the terrible
  			// hack that is the HTML block parser.
  			result = result.replace(/\s+$/,"");
  			result = "<"+list_type+">" + result + "</"+list_type+">\n";
  			return result;
  		});
  	} else {
  		whole_list = /(\n\n|^\n?)(([ ]{0,3}([*+-]|\d+[.])[ \t]+)[^\r]+?(~0|\n{2,}(?=\S)(?![ \t]*(?:[*+-]|\d+[.])[ \t]+)))/g;
  		text = text.replace(whole_list,function(wholeMatch,m1,m2,m3) {
  			var runup = m1;
  			var list = m2;
  
  			var list_type = (m3.search(/[*+-]/g)>-1) ? "ul" : "ol";
  			// Turn double returns into triple returns, so that we can make a
  			// paragraph for the last item in a list, if necessary:
  			var list = list.replace(/\n{2,}/g,"\n\n\n");;
  			var result = _ProcessListItems(list);
  			result = runup + "<"+list_type+">\n" + result + "</"+list_type+">\n";
  			return result;
  		});
  	}
  
  	// attacklab: strip sentinel
  	text = text.replace(/~0/,"");
  
  	return text;
  }
  
  _ProcessListItems = function(list_str) {
  //
  //  Process the contents of a single ordered or unordered list, splitting it
  //  into individual list items.
  //
  	// The $g_list_level global keeps track of when we're inside a list.
  	// Each time we enter a list, we increment it; when we leave a list,
  	// we decrement. If it's zero, we're not in a list anymore.
  	//
  	// We do this because when we're not inside a list, we want to treat
  	// something like this:
  	//
  	//    I recommend upgrading to version
  	//    8. Oops, now this line is treated
  	//    as a sub-list.
  	//
  	// As a single paragraph, despite the fact that the second line starts
  	// with a digit-period-space sequence.
  	//
  	// Whereas when we're inside a list (or sub-list), that line will be
  	// treated as the start of a sub-list. What a kludge, huh? This is
  	// an aspect of Markdown's syntax that's hard to parse perfectly
  	// without resorting to mind-reading. Perhaps the solution is to
  	// change the syntax rules such that sub-lists must start with a
  	// starting cardinal number; e.g. "1." or "a.".
  
  	g_list_level++;
  
  	// trim trailing blank lines:
  	list_str = list_str.replace(/\n{2,}$/,"\n");
  
  	// attacklab: add sentinel to emulate \z
  	list_str += "~0";
  
  	/*
  		list_str = list_str.replace(/
  			(\n)?							// leading line = $1
  			(^[ \t]*)						// leading whitespace = $2
  			([*+-]|\d+[.]) [ \t]+			// list marker = $3
  			([^\r]+?						// list item text   = $4
  			(\n{1,2}))
  			(?= \n* (~0 | \2 ([*+-]|\d+[.]) [ \t]+))
  		/gm, function(){...});
  	*/
  	list_str = list_str.replace(/(\n)?(^[ \t]*)([*+-]|\d+[.])[ \t]+([^\r]+?(\n{1,2}))(?=\n*(~0|\2([*+-]|\d+[.])[ \t]+))/gm,
  		function(wholeMatch,m1,m2,m3,m4){
  			var item = m4;
  			var leading_line = m1;
  			var leading_space = m2;
  
  			if (leading_line || (item.search(/\n{2,}/)>-1)) {
  				item = _RunBlockGamut(_Outdent(item));
  			}
  			else {
  				// Recursion for sub-lists:
  				item = _DoLists(_Outdent(item));
  				item = item.replace(/\n$/,""); // chomp(item)
  				item = _RunSpanGamut(item);
  			}
  
  			return  "<li>" + item + "</li>\n";
  		}
  	);
  
  	// attacklab: strip sentinel
  	list_str = list_str.replace(/~0/g,"");
  
  	g_list_level--;
  	return list_str;
  }
  
  
  var _DoCodeBlocks = function(text) {
  //
  //  Process Markdown `<pre><code>` blocks.
  //
  
  	/*
  		text = text.replace(text,
  			/(?:\n\n|^)
  			(								// $1 = the code block -- one or more lines, starting with a space/tab
  				(?:
  					(?:[ ]{4}|\t)			// Lines must start with a tab or a tab-width of spaces - attacklab: g_tab_width
  					.*\n+
  				)+
  			)
  			(\n*[ ]{0,3}[^ \t\n]|(?=~0))	// attacklab: g_tab_width
  		/g,function(){...});
  	*/
  
  	// attacklab: sentinel workarounds for lack of \A and \Z, safari\khtml bug
  	text += "~0";
  
  	text = text.replace(/(?:\n\n|^)((?:(?:[ ]{4}|\t).*\n+)+)(\n*[ ]{0,3}[^ \t\n]|(?=~0))/g,
  		function(wholeMatch,m1,m2) {
  			var codeblock = m1;
  			var nextChar = m2;
  
  			codeblock = _EncodeCode( _Outdent(codeblock));
  			codeblock = _Detab(codeblock);
  			codeblock = codeblock.replace(/^\n+/g,""); // trim leading newlines
  			codeblock = codeblock.replace(/\n+$/g,""); // trim trailing whitespace
  
  			codeblock = "<pre><code>" + codeblock + "\n</code></pre>";
  
  			return hashBlock(codeblock) + nextChar;
  		}
  	);
  
  	// attacklab: strip sentinel
  	text = text.replace(/~0/,"");
  
  	return text;
  }
  
  var hashBlock = function(text) {
  	text = text.replace(/(^\n+|\n+$)/g,"");
  	return "\n\n~K" + (g_html_blocks.push(text)-1) + "K\n\n";
  }
  
  
  var _DoCodeSpans = function(text) {
  //
  //   *  Backtick quotes are used for <code></code> spans.
  //
  //   *  You can use multiple backticks as the delimiters if you want to
  //	 include literal backticks in the code span. So, this input:
  //
  //		 Just type ``foo `bar` baz`` at the prompt.
  //
  //	   Will translate to:
  //
  //		 <p>Just type <code>foo `bar` baz</code> at the prompt.</p>
  //
  //	There's no arbitrary limit to the number of backticks you
  //	can use as delimters. If you need three consecutive backticks
  //	in your code, use four for delimiters, etc.
  //
  //  *  You can use spaces to get literal backticks at the edges:
  //
  //		 ... type `` `bar` `` ...
  //
  //	   Turns to:
  //
  //		 ... type <code>`bar`</code> ...
  //
  
  	/*
  		text = text.replace(/
  			(^|[^\\])					// Character before opening ` can't be a backslash
  			(`+)						// $2 = Opening run of `
  			(							// $3 = The code block
  				[^\r]*?
  				[^`]					// attacklab: work around lack of lookbehind
  			)
  			\2							// Matching closer
  			(?!`)
  		/gm, function(){...});
  	*/
  
  	text = text.replace(/(^|[^\\])(`+)([^\r]*?[^`])\2(?!`)/gm,
  		function(wholeMatch,m1,m2,m3,m4) {
  			var c = m3;
  			c = c.replace(/^([ \t]*)/g,"");	// leading whitespace
  			c = c.replace(/[ \t]*$/g,"");	// trailing whitespace
  			c = _EncodeCode(c);
  			return m1+"<code>"+c+"</code>";
  		});
  
  	return text;
  }
  
  
  var _EncodeCode = function(text) {
  //
  // Encode/escape certain characters inside Markdown code runs.
  // The point is that in code, these characters are literals,
  // and lose their special Markdown meanings.
  //
  	// Encode all ampersands; HTML entities are not
  	// entities within a Markdown code span.
  	text = text.replace(/&/g,"&amp;");
  
  	// Do the angle bracket song and dance:
  	text = text.replace(/</g,"&lt;");
  	text = text.replace(/>/g,"&gt;");
  
  	// Now, escape characters that are magic in Markdown:
  	text = escapeCharacters(text,"\*_{}[]\\",false);
  
  // jj the line above breaks this:
  //---
  
  //* Item
  
  //   1. Subitem
  
  //            special char: *
  //---
  
  	return text;
  }
  
  
  var _DoItalicsAndBold = function(text) {
  
  	// <strong> must go first:
  	text = text.replace(/(\*\*|__)(?=\S)([^\r]*?\S[*_]*)\1/g,
  		"<strong>$2</strong>");
  
  	text = text.replace(/(\*|_)(?=\S)([^\r]*?\S)\1/g,
  		"<em>$2</em>");
  
  	return text;
  }
  
  
  var _DoBlockQuotes = function(text) {
  
  	/*
  		text = text.replace(/
  		(								// Wrap whole match in $1
  			(
  				^[ \t]*>[ \t]?			// '>' at the start of a line
  				.+\n					// rest of the first line
  				(.+\n)*					// subsequent consecutive lines
  				\n*						// blanks
  			)+
  		)
  		/gm, function(){...});
  	*/
  
  	text = text.replace(/((^[ \t]*>[ \t]?.+\n(.+\n)*\n*)+)/gm,
  		function(wholeMatch,m1) {
  			var bq = m1;
  
  			// attacklab: hack around Konqueror 3.5.4 bug:
  			// "----------bug".replace(/^-/g,"") == "bug"
  
  			bq = bq.replace(/^[ \t]*>[ \t]?/gm,"~0");	// trim one level of quoting
  
  			// attacklab: clean up hack
  			bq = bq.replace(/~0/g,"");
  
  			bq = bq.replace(/^[ \t]+$/gm,"");		// trim whitespace-only lines
  			bq = _RunBlockGamut(bq);				// recurse
  
  			bq = bq.replace(/(^|\n)/g,"$1  ");
  			// These leading spaces screw with <pre> content, so we need to fix that:
  			bq = bq.replace(
  					/(\s*<pre>[^\r]+?<\/pre>)/gm,
  				function(wholeMatch,m1) {
  					var pre = m1;
  					// attacklab: hack around Konqueror 3.5.4 bug:
  					pre = pre.replace(/^  /mg,"~0");
  					pre = pre.replace(/~0/g,"");
  					return pre;
  				});
  
  			return hashBlock("<blockquote>\n" + bq + "\n</blockquote>");
  		});
  	return text;
  }
  
  
  var _FormParagraphs = function(text) {
  //
  //  Params:
  //    $text - string to process with html <p> tags
  //
  
  	// Strip leading and trailing lines:
  	text = text.replace(/^\n+/g,"");
  	text = text.replace(/\n+$/g,"");
  
  	var grafs = text.split(/\n{2,}/g);
  	var grafsOut = new Array();
  
  	//
  	// Wrap <p> tags.
  	//
  	var end = grafs.length;
  	for (var i=0; i<end; i++) {
  		var str = grafs[i];
  
  		// if this is an HTML marker, copy it
  		if (str.search(/~K(\d+)K/g) >= 0) {
  			grafsOut.push(str);
  		}
  		else if (str.search(/\S/) >= 0) {
  			str = _RunSpanGamut(str);
  			str = str.replace(/^([ \t]*)/g,"<p>");
  			str += "</p>"
  			grafsOut.push(str);
  		}
  
  	}
  
  	//
  	// Unhashify HTML blocks
  	//
  	end = grafsOut.length;
  	for (var i=0; i<end; i++) {
  		// if this is a marker for an html block...
  		while (grafsOut[i].search(/~K(\d+)K/) >= 0) {
  			var blockText = g_html_blocks[RegExp.$1];
  			blockText = blockText.replace(/\$/g,"$$$$"); // Escape any dollar signs
  			grafsOut[i] = grafsOut[i].replace(/~K\d+K/,blockText);
  		}
  	}
  
  	return grafsOut.join("\n\n");
  }
  
  
  var _EncodeAmpsAndAngles = function(text) {
  // Smart processing for ampersands and angle brackets that need to be encoded.
  
  	// Ampersand-encoding based entirely on Nat Irons's Amputator MT plugin:
  	//   http://bumppo.net/projects/amputator/
  	text = text.replace(/&(?!#?[xX]?(?:[0-9a-fA-F]+|\w+);)/g,"&amp;");
  
  	// Encode naked <'s
  	text = text.replace(/<(?![a-z\/?\$!])/gi,"&lt;");
  
  	return text;
  }
  
  
  var _EncodeBackslashEscapes = function(text) {
  //
  //   Parameter:  String.
  //   Returns:	The string, with after processing the following backslash
  //			   escape sequences.
  //
  
  	// attacklab: The polite way to do this is with the new
  	// escapeCharacters() function:
  	//
  	// 	text = escapeCharacters(text,"\\",true);
  	// 	text = escapeCharacters(text,"`*_{}[]()>#+-.!",true);
  	//
  	// ...but we're sidestepping its use of the (slow) RegExp constructor
  	// as an optimization for Firefox.  This function gets called a LOT.
  
  	text = text.replace(/\\(\\)/g,escapeCharacters_callback);
  	text = text.replace(/\\([`*_{}\[\]()>#+-.!])/g,escapeCharacters_callback);
  	return text;
  }
  
  
  var _DoAutoLinks = function(text) {
  
  	text = text.replace(/<((https?|ftp|dict):[^'">\s]+)>/gi,"<a href=\"$1\">$1</a>");
  
  	// Email addresses: <address@domain.foo>
  
  	/*
  		text = text.replace(/
  			<
  			(?:mailto:)?
  			(
  				[-.\w]+
  				\@
  				[-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+
  			)
  			>
  		/gi, _DoAutoLinks_callback());
  	*/
  	text = text.replace(/<(?:mailto:)?([-.\w]+\@[-a-z0-9]+(\.[-a-z0-9]+)*\.[a-z]+)>/gi,
  		function(wholeMatch,m1) {
  			return _EncodeEmailAddress( _UnescapeSpecialChars(m1) );
  		}
  	);
  
  	return text;
  }
  
  
  var _EncodeEmailAddress = function(addr) {
  //
  //  Input: an email address, e.g. "foo@example.com"
  //
  //  Output: the email address as a mailto link, with each character
  //	of the address encoded as either a decimal or hex entity, in
  //	the hopes of foiling most address harvesting spam bots. E.g.:
  //
  //	<a href="&#x6D;&#97;&#105;&#108;&#x74;&#111;:&#102;&#111;&#111;&#64;&#101;
  //	   x&#x61;&#109;&#x70;&#108;&#x65;&#x2E;&#99;&#111;&#109;">&#102;&#111;&#111;
  //	   &#64;&#101;x&#x61;&#109;&#x70;&#108;&#x65;&#x2E;&#99;&#111;&#109;</a>
  //
  //  Based on a filter by Matthew Wickline, posted to the BBEdit-Talk
  //  mailing list: <http://tinyurl.com/yu7ue>
  //
  
  	// attacklab: why can't javascript speak hex?
  	function char2hex(ch) {
  		var hexDigits = '0123456789ABCDEF';
  		var dec = ch.charCodeAt(0);
  		return(hexDigits.charAt(dec>>4) + hexDigits.charAt(dec&15));
  	}
  
  	var encode = [
  		function(ch){return "&#"+ch.charCodeAt(0)+";";},
  		function(ch){return "&#x"+char2hex(ch)+";";},
  		function(ch){return ch;}
  	];
  
  	addr = "mailto:" + addr;
  
  	addr = addr.replace(/./g, function(ch) {
  		if (ch == "@") {
  		   	// this *must* be encoded. I insist.
  			ch = encode[Math.floor(Math.random()*2)](ch);
  		} else if (ch !=":") {
  			// leave ':' alone (to spot mailto: later)
  			var r = Math.random();
  			// roughly 10% raw, 45% hex, 45% dec
  			ch =  (
  					r > .9  ?	encode[2](ch)   :
  					r > .45 ?	encode[1](ch)   :
  								encode[0](ch)
  				);
  		}
  		return ch;
  	});
  
  	addr = "<a href=\"" + addr + "\">" + addr + "</a>";
  	addr = addr.replace(/">.+:/g,"\">"); // strip the mailto: from the visible part
  
  	return addr;
  }
  
  
  var _UnescapeSpecialChars = function(text) {
  //
  // Swap back in all the special characters we've hidden.
  //
  	text = text.replace(/~E(\d+)E/g,
  		function(wholeMatch,m1) {
  			var charCodeToReplace = parseInt(m1);
  			return String.fromCharCode(charCodeToReplace);
  		}
  	);
  	return text;
  }
  
  
  var _Outdent = function(text) {
  //
  // Remove one level of line-leading tabs or spaces
  //
  
  	// attacklab: hack around Konqueror 3.5.4 bug:
  	// "----------bug".replace(/^-/g,"") == "bug"
  
  	text = text.replace(/^(\t|[ ]{1,4})/gm,"~0"); // attacklab: g_tab_width
  
  	// attacklab: clean up hack
  	text = text.replace(/~0/g,"")
  
  	return text;
  }
  
  var _Detab = function(text) {
  // attacklab: Detab's completely rewritten for speed.
  // In perl we could fix it by anchoring the regexp with \G.
  // In javascript we're less fortunate.
  
  	// expand first n-1 tabs
  	text = text.replace(/\t(?=\t)/g,"    "); // attacklab: g_tab_width
  
  	// replace the nth with two sentinels
  	text = text.replace(/\t/g,"~A~B");
  
  	// use the sentinel to anchor our regex so it doesn't explode
  	text = text.replace(/~B(.+?)~A/g,
  		function(wholeMatch,m1,m2) {
  			var leadingText = m1;
  			var numSpaces = 4 - leadingText.length % 4;  // attacklab: g_tab_width
  
  			// there *must* be a better way to do this:
  			for (var i=0; i<numSpaces; i++) leadingText+=" ";
  
  			return leadingText;
  		}
  	);
  
  	// clean up sentinels
  	text = text.replace(/~A/g,"    ");  // attacklab: g_tab_width
  	text = text.replace(/~B/g,"");
  
  	return text;
  }
  
  
  //
  //  attacklab: Utility functions
  //
  
  
  var escapeCharacters = function(text, charsToEscape, afterBackslash) {
  	// First we have to escape the escape characters so that
  	// we can build a character class out of them
  	var regexString = "([" + charsToEscape.replace(/([\[\]\\])/g,"\\$1") + "])";
  
  	if (afterBackslash) {
  		regexString = "\\\\" + regexString;
  	}
  
  	var regex = new RegExp(regexString,"g");
  	text = text.replace(regex,escapeCharacters_callback);
  
  	return text;
  }
  
  
  var escapeCharacters_callback = function(wholeMatch,m1) {
  	var charCodeToEscape = m1.charCodeAt(0);
  	return "~E"+charCodeToEscape+"E";
  }
  
  } // end of Showdown.converter

  // End vendor/showdown.js

  // Begin vendor/codemirror.js

  // All functions that need access to the editor's state live inside
  // the CodeMirror function. Below that, at the bottom of the file,
  // some utilities are defined.
  
  // CodeMirror is the only global var we claim
  var CodeMirror = (function() {
    "use strict";
    // This is the function that produces an editor instance. Its
    // closure is used to store the editor state.
    function CodeMirror(place, givenOptions) {
      // Determine effective options based on given values and defaults.
      var options = {}, defaults = CodeMirror.defaults;
      for (var opt in defaults)
        if (defaults.hasOwnProperty(opt))
          options[opt] = (givenOptions && givenOptions.hasOwnProperty(opt) ? givenOptions : defaults)[opt];
  
      var input = elt("textarea", null, null, "position: absolute; padding: 0; width: 1px; height: 1em");
      input.setAttribute("wrap", "off"); input.setAttribute("autocorrect", "off"); input.setAttribute("autocapitalize", "off");
      // Wraps and hides input textarea
      var inputDiv = elt("div", [input], null, "overflow: hidden; position: relative; width: 3px; height: 0px;");
      // The empty scrollbar content, used solely for managing the scrollbar thumb.
      var scrollbarInner = elt("div", null, "CodeMirror-scrollbar-inner");
      // The vertical scrollbar. Horizontal scrolling is handled by the scroller itself.
      var scrollbar = elt("div", [scrollbarInner], "CodeMirror-scrollbar");
      // DIVs containing the selection and the actual code
      var lineDiv = elt("div"), selectionDiv = elt("div", null, null, "position: relative; z-index: -1");
      // Blinky cursor, and element used to ensure cursor fits at the end of a line
      var cursor = elt("pre", "\u00a0", "CodeMirror-cursor"), widthForcer = elt("pre", "\u00a0", "CodeMirror-cursor", "visibility: hidden");
      // Used to measure text size
      var measure = elt("div", null, null, "position: absolute; width: 100%; height: 0px; overflow: hidden; visibility: hidden;");
      var lineSpace = elt("div", [measure, cursor, widthForcer, selectionDiv, lineDiv], null, "position: relative; z-index: 0");
      var gutterText = elt("div", null, "CodeMirror-gutter-text"), gutter = elt("div", [gutterText], "CodeMirror-gutter");
      // Moved around its parent to cover visible view
      var mover = elt("div", [gutter, elt("div", [lineSpace], "CodeMirror-lines")], null, "position: relative");
      // Set to the height of the text, causes scrolling
      var sizer = elt("div", [mover], null, "position: relative");
      // Provides scrolling
      var scroller = elt("div", [sizer], "CodeMirror-scroll");
      scroller.setAttribute("tabIndex", "-1");
      // The element in which the editor lives.
      var wrapper = elt("div", [inputDiv, scrollbar, scroller], "CodeMirror" + (options.lineWrapping ? " CodeMirror-wrap" : ""));
      if (place.appendChild) place.appendChild(wrapper); else place(wrapper);
  
      themeChanged(); keyMapChanged();
      // Needed to hide big blue blinking cursor on Mobile Safari
      if (ios) input.style.width = "0px";
      if (!webkit) scroller.draggable = true;
      lineSpace.style.outline = "none";
      if (options.tabindex != null) input.tabIndex = options.tabindex;
      if (options.autofocus) focusInput();
      if (!options.gutter && !options.lineNumbers) gutter.style.display = "none";
      // Needed to handle Tab key in KHTML
      if (khtml) inputDiv.style.height = "1px", inputDiv.style.position = "absolute";
  
      // Check for OS X >= 10.7. This has transparent scrollbars, so the
      // overlaying of one scrollbar with another won't work. This is a
      // temporary hack to simply turn off the overlay scrollbar. See
      // issue #727.
      if (mac_geLion) { scrollbar.style.zIndex = -2; scrollbar.style.visibility = "hidden"; }
      // Need to set a minimum width to see the scrollbar on IE7 (but must not set it on IE8).
      else if (ie_lt8) scrollbar.style.minWidth = "18px";
  
      // Delayed object wrap timeouts, making sure only one is active. blinker holds an interval.
      var poll = new Delayed(), highlight = new Delayed(), blinker;
  
      // mode holds a mode API object. doc is the tree of Line objects,
      // frontier is the point up to which the content has been parsed,
      // and history the undo history (instance of History constructor).
      var mode, doc = new BranchChunk([new LeafChunk([new Line("")])]), frontier = 0, focused;
      loadMode();
      // The selection. These are always maintained to point at valid
      // positions. Inverted is used to remember that the user is
      // selecting bottom-to-top.
      var sel = {from: {line: 0, ch: 0}, to: {line: 0, ch: 0}, inverted: false};
      // Selection-related flags. shiftSelecting obviously tracks
      // whether the user is holding shift.
      var shiftSelecting, lastClick, lastDoubleClick, lastScrollTop = 0, draggingText,
          overwrite = false, suppressEdits = false, pasteIncoming = false;
      // Variables used by startOperation/endOperation to track what
      // happened during the operation.
      var updateInput, userSelChange, changes, textChanged, selectionChanged,
          gutterDirty, callbacks;
      // Current visible range (may be bigger than the view window).
      var displayOffset = 0, showingFrom = 0, showingTo = 0, lastSizeC = 0;
      // bracketHighlighted is used to remember that a bracket has been
      // marked.
      var bracketHighlighted;
      // Tracks the maximum line length so that the horizontal scrollbar
      // can be kept static when scrolling.
      var maxLine = getLine(0), updateMaxLine = false, maxLineChanged = true;
      var pollingFast = false; // Ensures slowPoll doesn't cancel fastPoll
      var goalColumn = null;
  
      // Initialize the content.
      operation(function(){setValue(options.value || ""); updateInput = false;})();
      var history = new History();
  
      // Register our event handlers.
      connect(scroller, "mousedown", operation(onMouseDown));
      connect(scroller, "dblclick", operation(onDoubleClick));
      connect(lineSpace, "selectstart", e_preventDefault);
      // Gecko browsers fire contextmenu *after* opening the menu, at
      // which point we can't mess with it anymore. Context menu is
      // handled in onMouseDown for Gecko.
      if (!gecko) connect(scroller, "contextmenu", onContextMenu);
      connect(scroller, "scroll", onScrollMain);
      connect(scrollbar, "scroll", onScrollBar);
      connect(scrollbar, "mousedown", function() {if (focused) setTimeout(focusInput, 0);});
      var resizeHandler = connect(window, "resize", function() {
        if (wrapper.parentNode) updateDisplay(true);
        else resizeHandler();
      }, true);
      connect(input, "keyup", operation(onKeyUp));
      connect(input, "input", fastPoll);
      connect(input, "keydown", operation(onKeyDown));
      connect(input, "keypress", operation(onKeyPress));
      connect(input, "focus", onFocus);
      connect(input, "blur", onBlur);
  
      function drag_(e) {
        if (options.onDragEvent && options.onDragEvent(instance, addStop(e))) return;
        e_stop(e);
      }
      if (options.dragDrop) {
        connect(scroller, "dragstart", onDragStart);
        connect(scroller, "dragenter", drag_);
        connect(scroller, "dragover", drag_);
        connect(scroller, "drop", operation(onDrop));
      }
      connect(scroller, "paste", function(){focusInput(); fastPoll();});
      connect(input, "paste", function(){pasteIncoming = true; fastPoll();});
      connect(input, "cut", operation(function(){
        if (!options.readOnly) replaceSelection("");
      }));
  
      // Needed to handle Tab key in KHTML
      if (khtml) connect(sizer, "mouseup", function() {
          if (document.activeElement == input) input.blur();
          focusInput();
      });
  
      // IE throws unspecified error in certain cases, when
      // trying to access activeElement before onload
      var hasFocus; try { hasFocus = (document.activeElement == input); } catch(e) { }
      if (hasFocus || options.autofocus) setTimeout(onFocus, 20);
      else onBlur();
  
      function isLine(l) {return l >= 0 && l < doc.size;}
      // The instance object that we'll return. Mostly calls out to
      // local functions in the CodeMirror function. Some do some extra
      // range checking and/or clipping. operation is used to wrap the
      // call so that changes it makes are tracked, and the display is
      // updated afterwards.
      var instance = wrapper.CodeMirror = {
        getValue: getValue,
        setValue: operation(setValue),
        getSelection: getSelection,
        replaceSelection: operation(replaceSelection),
        focus: function(){window.focus(); focusInput(); onFocus(); fastPoll();},
        setOption: function(option, value) {
          var oldVal = options[option];
          options[option] = value;
          if (option == "mode" || option == "indentUnit") loadMode();
          else if (option == "readOnly" && value == "nocursor") {onBlur(); input.blur();}
          else if (option == "readOnly" && !value) {resetInput(true);}
          else if (option == "theme") themeChanged();
          else if (option == "lineWrapping" && oldVal != value) operation(wrappingChanged)();
          else if (option == "tabSize") updateDisplay(true);
          else if (option == "keyMap") keyMapChanged();
          else if (option == "tabindex") input.tabIndex = value;
          else if (option == "showCursorWhenSelecting") updateSelection();
          if (option == "lineNumbers" || option == "gutter" || option == "firstLineNumber" ||
              option == "theme" || option == "lineNumberFormatter") {
            gutterChanged();
            updateDisplay(true);
          }
        },
        getOption: function(option) {return options[option];},
        getMode: function() {return mode;},
        undo: operation(undo),
        redo: operation(redo),
        indentLine: operation(function(n, dir) {
          if (typeof dir != "string") {
            if (dir == null) dir = options.smartIndent ? "smart" : "prev";
            else dir = dir ? "add" : "subtract";
          }
          if (isLine(n)) indentLine(n, dir);
        }),
        indentSelection: operation(indentSelected),
        historySize: function() {return {undo: history.done.length, redo: history.undone.length};},
        clearHistory: function() {history = new History();},
        setHistory: function(histData) {
          history = new History();
          history.done = histData.done;
          history.undone = histData.undone;
        },
        getHistory: function() {
          function cp(arr) {
            for (var i = 0, nw = [], nwelt; i < arr.length; ++i) {
              nw.push(nwelt = []);
              for (var j = 0, elt = arr[i]; j < elt.length; ++j) {
                var old = [], cur = elt[j];
                nwelt.push({start: cur.start, added: cur.added, old: old});
                for (var k = 0; k < cur.old.length; ++k) old.push(hlText(cur.old[k]));
              }
            }
            return nw;
          }
          return {done: cp(history.done), undone: cp(history.undone)};
        },
        matchBrackets: operation(function(){matchBrackets(true);}),
        getTokenAt: operation(function(pos) {
          pos = clipPos(pos);
          return getLine(pos.line).getTokenAt(mode, getStateBefore(pos.line), options.tabSize, pos.ch);
        }),
        getStateAfter: function(line) {
          line = clipLine(line == null ? doc.size - 1: line);
          return getStateBefore(line + 1);
        },
        cursorCoords: function(start, mode) {
          if (start == null) start = sel.inverted;
          return this.charCoords(start ? sel.from : sel.to, mode);
        },
        charCoords: function(pos, mode) {
          pos = clipPos(pos);
          if (mode == "local") return localCoords(pos, false);
          if (mode == "div") return localCoords(pos, true);
          return pageCoords(pos);
        },
        coordsChar: function(coords) {
          var off = eltOffset(lineSpace);
          return coordsChar(coords.x - off.left, coords.y - off.top);
        },
        defaultTextHeight: function() { return textHeight(); },
        markText: operation(markText),
        setBookmark: setBookmark,
        findMarksAt: findMarksAt,
        setMarker: operation(addGutterMarker),
        clearMarker: operation(removeGutterMarker),
        setLineClass: operation(setLineClass),
        hideLine: operation(function(h) {return setLineHidden(h, true);}),
        showLine: operation(function(h) {return setLineHidden(h, false);}),
        onDeleteLine: function(line, f) {
          if (typeof line == "number") {
            if (!isLine(line)) return null;
            line = getLine(line);
          }
          (line.handlers || (line.handlers = [])).push(f);
          return line;
        },
        lineInfo: lineInfo,
        getViewport: function() { return {from: showingFrom, to: showingTo};},
        addWidget: function(pos, node, scroll, vert, horiz) {
          pos = localCoords(clipPos(pos));
          var top = pos.yBot, left = pos.x;
          node.style.position = "absolute";
          sizer.appendChild(node);
          if (vert == "over") top = pos.y;
          else if (vert == "near") {
            var vspace = Math.max(scroller.offsetHeight, doc.height * textHeight()),
                hspace = Math.max(sizer.clientWidth, lineSpace.clientWidth) - paddingLeft();
            if (pos.yBot + node.offsetHeight > vspace && pos.y > node.offsetHeight)
              top = pos.y - node.offsetHeight;
            if (left + node.offsetWidth > hspace)
              left = hspace - node.offsetWidth;
          }
          node.style.top = (top + paddingTop()) + "px";
          node.style.left = node.style.right = "";
          if (horiz == "right") {
            left = sizer.clientWidth - node.offsetWidth;
            node.style.right = "0px";
          } else {
            if (horiz == "left") left = 0;
            else if (horiz == "middle") left = (sizer.clientWidth - node.offsetWidth) / 2;
            node.style.left = (left + paddingLeft()) + "px";
          }
          if (scroll)
            scrollIntoView(left, top, left + node.offsetWidth, top + node.offsetHeight);
        },
  
        lineCount: function() {return doc.size;},
        clipPos: clipPos,
        getCursor: function(start) {
          if (start == null || start == "head") start = sel.inverted;
          if (start == "anchor") start = !sel.inverted;
          if (start == "end") start = false;
          return copyPos(start ? sel.from : sel.to);
        },
        somethingSelected: function() {return !posEq(sel.from, sel.to);},
        setCursor: operation(function(line, ch, user) {
          if (ch == null && typeof line.line == "number") setCursor(line.line, line.ch, user);
          else setCursor(line, ch, user);
        }),
        setSelection: operation(function(from, to, user) {
          (user ? setSelectionUser : setSelection)(clipPos(from), clipPos(to || from));
        }),
        getLine: function(line) {if (isLine(line)) return getLine(line).text;},
        getLineHandle: function(line) {if (isLine(line)) return getLine(line);},
        setLine: operation(function(line, text) {
          if (isLine(line)) replaceRange(text, {line: line, ch: 0}, {line: line, ch: getLine(line).text.length});
        }),
        removeLine: operation(function(line) {
          if (isLine(line)) replaceRange("", {line: line, ch: 0}, clipPos({line: line+1, ch: 0}));
        }),
        replaceRange: operation(replaceRange),
        getRange: function(from, to, lineSep) {return getRange(clipPos(from), clipPos(to), lineSep);},
  
        triggerOnKeyDown: operation(onKeyDown),
        execCommand: function(cmd) {return commands[cmd](instance);},
        // Stuff used by commands, probably not much use to outside code.
        moveH: operation(moveH),
        deleteH: operation(deleteH),
        moveV: operation(moveV),
        toggleOverwrite: function() {
          if(overwrite){
            overwrite = false;
            cursor.className = cursor.className.replace(" CodeMirror-overwrite", "");
          } else {
            overwrite = true;
            cursor.className += " CodeMirror-overwrite";
          }
        },
  
        posFromIndex: function(off) {
          var lineNo = 0, ch;
          doc.iter(0, doc.size, function(line) {
            var sz = line.text.length + 1;
            if (sz > off) { ch = off; return true; }
            off -= sz;
            ++lineNo;
          });
          return clipPos({line: lineNo, ch: ch});
        },
        indexFromPos: function (coords) {
          if (coords.line < 0 || coords.ch < 0) return 0;
          var index = coords.ch;
          doc.iter(0, coords.line, function (line) {
            index += line.text.length + 1;
          });
          return index;
        },
        scrollTo: function(x, y) {
          if (x != null) scroller.scrollLeft = x;
          if (y != null) scrollbar.scrollTop = scroller.scrollTop = y;
          updateDisplay([]);
        },
        getScrollInfo: function() {
          return {x: scroller.scrollLeft, y: scrollbar.scrollTop,
                  height: scrollbar.scrollHeight, width: scroller.scrollWidth};
        },
        scrollIntoView: function(pos) {
          var coords = localCoords(pos ? clipPos(pos) : sel.inverted ? sel.from : sel.to);
          scrollIntoView(coords.x, coords.y, coords.x, coords.yBot);
        },
  
        setSize: function(width, height) {
          function interpret(val) {
            val = String(val);
            return /^\d+$/.test(val) ? val + "px" : val;
          }
          if (width != null) wrapper.style.width = interpret(width);
          if (height != null) scroller.style.height = interpret(height);
          instance.refresh();
        },
  
        operation: function(f){return operation(f)();},
        compoundChange: function(f){return compoundChange(f);},
        refresh: function(){
          updateDisplay(true, null, lastScrollTop);
          if (scrollbar.scrollHeight > lastScrollTop)
            scrollbar.scrollTop = lastScrollTop;
        },
        getInputField: function(){return input;},
        getWrapperElement: function(){return wrapper;},
        getScrollerElement: function(){return scroller;},
        getGutterElement: function(){return gutter;}
      };
  
      function getLine(n) { return getLineAt(doc, n); }
      function updateLineHeight(line, height) {
        gutterDirty = true;
        var diff = height - line.height;
        for (var n = line; n; n = n.parent) n.height += diff;
      }
  
      function lineContent(line, wrapAt) {
        if (!line.styles)
          line.highlight(mode, line.stateAfter = getStateBefore(lineNo(line)), options.tabSize);
        return line.getContent(options.tabSize, wrapAt, options.lineWrapping);
      }
  
      function setValue(code) {
        var top = {line: 0, ch: 0};
        updateLines(top, {line: doc.size - 1, ch: getLine(doc.size-1).text.length},
                    splitLines(code), top, top);
        updateInput = true;
      }
      function getValue(lineSep) {
        var text = [];
        doc.iter(0, doc.size, function(line) { text.push(line.text); });
        return text.join(lineSep || "\n");
      }
  
      function onScrollBar(e) {
        if (Math.abs(scrollbar.scrollTop - lastScrollTop) > 1) {
          lastScrollTop = scroller.scrollTop = scrollbar.scrollTop;
          updateDisplay([]);
        }
      }
  
      function onScrollMain(e) {
        if (options.fixedGutter && gutter.style.left != scroller.scrollLeft + "px")
          gutter.style.left = scroller.scrollLeft + "px";
        if (Math.abs(scroller.scrollTop - lastScrollTop) > 1) {
          lastScrollTop = scroller.scrollTop;
          if (scrollbar.scrollTop != lastScrollTop)
            scrollbar.scrollTop = lastScrollTop;
          updateDisplay([]);
        }
        if (options.onScroll) options.onScroll(instance);
      }
  
      function onMouseDown(e) {
        setShift(e_prop(e, "shiftKey"));
        // Check whether this is a click in a widget
        for (var n = e_target(e); n != wrapper; n = n.parentNode)
          if (n.parentNode == sizer && n != mover) return;
  
        // See if this is a click in the gutter
        for (var n = e_target(e); n != wrapper; n = n.parentNode)
          if (n.parentNode == gutterText) {
            if (options.onGutterClick)
              options.onGutterClick(instance, indexOf(gutterText.childNodes, n) + showingFrom, e);
            return e_preventDefault(e);
          }
  
        var start = posFromMouse(e);
  
        switch (e_button(e)) {
        case 3:
          if (gecko) onContextMenu(e);
          return;
        case 2:
          if (start) setCursor(start.line, start.ch, true);
          setTimeout(focusInput, 20);
          e_preventDefault(e);
          return;
        }
        // For button 1, if it was clicked inside the editor
        // (posFromMouse returning non-null), we have to adjust the
        // selection.
        if (!start) {if (e_target(e) == scroller) e_preventDefault(e); return;}
  
        if (!focused) onFocus();
  
        var now = +new Date, type = "single";
        if (lastDoubleClick && lastDoubleClick.time > now - 400 && posEq(lastDoubleClick.pos, start)) {
          type = "triple";
          e_preventDefault(e);
          setTimeout(focusInput, 20);
          selectLine(start.line);
        } else if (lastClick && lastClick.time > now - 400 && posEq(lastClick.pos, start)) {
          type = "double";
          lastDoubleClick = {time: now, pos: start};
          e_preventDefault(e);
          var word = findWordAt(start);
          setSelectionUser(word.from, word.to);
        } else { lastClick = {time: now, pos: start}; }
  
        function dragEnd(e2) {
          if (webkit) scroller.draggable = false;
          draggingText = false;
          up(); drop();
          if (Math.abs(e.clientX - e2.clientX) + Math.abs(e.clientY - e2.clientY) < 10) {
            e_preventDefault(e2);
            setCursor(start.line, start.ch, true);
            focusInput();
          }
        }
        var last = start, going;
        if (options.dragDrop && dragAndDrop && !options.readOnly && !posEq(sel.from, sel.to) &&
            !posLess(start, sel.from) && !posLess(sel.to, start) && type == "single") {
          // Let the drag handler handle this.
          if (webkit) scroller.draggable = true;
          var up = connect(document, "mouseup", operation(dragEnd), true);
          var drop = connect(scroller, "drop", operation(dragEnd), true);
          draggingText = true;
          // IE's approach to draggable
          if (scroller.dragDrop) scroller.dragDrop();
          return;
        }
        e_preventDefault(e);
        if (type == "single") setCursor(start.line, start.ch, true);
  
        var startstart = sel.from, startend = sel.to;
  
        function doSelect(cur) {
          if (type == "single") {
            setSelectionUser(clipPos(start), cur);
            return;
          }
          startstart = clipPos(startstart);
          startend = clipPos(startend);
          if (type == "double") {
            var word = findWordAt(cur);
            if (posLess(cur, startstart)) setSelectionUser(word.from, startend);
            else setSelectionUser(startstart, word.to);
          } else if (type == "triple") {
            if (posLess(cur, startstart)) setSelectionUser(startend, clipPos({line: cur.line, ch: 0}));
            else setSelectionUser(startstart, clipPos({line: cur.line + 1, ch: 0}));
          }
        }
  
        function extend(e) {
          var cur = posFromMouse(e, true);
          if (cur && !posEq(cur, last)) {
            if (!focused) onFocus();
            last = cur;
            doSelect(cur);
            updateInput = false;
            var visible = visibleLines();
            if (cur.line >= visible.to || cur.line < visible.from)
              going = setTimeout(operation(function(){extend(e);}), 150);
          }
        }
  
        function done(e) {
          clearTimeout(going);
          var cur = posFromMouse(e);
          if (cur) doSelect(cur);
          e_preventDefault(e);
          focusInput();
          updateInput = true;
          move(); up();
        }
        var move = connect(document, "mousemove", operation(function(e) {
          clearTimeout(going);
          e_preventDefault(e);
          if (!ie && !e_button(e)) done(e);
          else extend(e);
        }), true);
        var up = connect(document, "mouseup", operation(done), true);
      }
      function onDoubleClick(e) {
        for (var n = e_target(e); n != wrapper; n = n.parentNode)
          if (n.parentNode == gutterText) return e_preventDefault(e);
        e_preventDefault(e);
      }
      function onDrop(e) {
        if (options.onDragEvent && options.onDragEvent(instance, addStop(e))) return;
        e_preventDefault(e);
        var pos = posFromMouse(e, true), files = e.dataTransfer.files;
        if (!pos || options.readOnly) return;
        if (files && files.length && window.FileReader && window.File) {
          var n = files.length, text = Array(n), read = 0;
          var loadFile = function(file, i) {
            var reader = new FileReader;
            reader.onload = function() {
              text[i] = reader.result;
              if (++read == n) {
                pos = clipPos(pos);
                operation(function() {
                  var end = replaceRange(text.join(""), pos, pos);
                  setSelectionUser(pos, end);
                })();
              }
            };
            reader.readAsText(file);
          };
          for (var i = 0; i < n; ++i) loadFile(files[i], i);
        } else {
          // Don't do a replace if the drop happened inside of the selected text.
          if (draggingText && !(posLess(pos, sel.from) || posLess(sel.to, pos))) return;
          try {
            var text = e.dataTransfer.getData("Text");
            if (text) {
              compoundChange(function() {
                var curFrom = sel.from, curTo = sel.to;
                setSelectionUser(pos, pos);
                if (draggingText) replaceRange("", curFrom, curTo);
                replaceSelection(text);
                focusInput();
              });
            }
          }
          catch(e){}
        }
      }
      function onDragStart(e) {
        var txt = getSelection();
        e.dataTransfer.setData("Text", txt);
  
        // Use dummy image instead of default browsers image.
        if (e.dataTransfer.setDragImage)
          e.dataTransfer.setDragImage(elt('img'), 0, 0);
      }
  
      function doHandleBinding(bound, dropShift) {
        if (typeof bound == "string") {
          bound = commands[bound];
          if (!bound) return false;
        }
        var prevShift = shiftSelecting;
        try {
          if (options.readOnly) suppressEdits = true;
          if (dropShift) shiftSelecting = null;
          bound(instance);
        } catch(e) {
          if (e != Pass) throw e;
          return false;
        } finally {
          shiftSelecting = prevShift;
          suppressEdits = false;
        }
        return true;
      }
      var maybeTransition;
      function handleKeyBinding(e) {
        // Handle auto keymap transitions
        var startMap = getKeyMap(options.keyMap), next = startMap.auto;
        clearTimeout(maybeTransition);
        if (next && !isModifierKey(e)) maybeTransition = setTimeout(function() {
          if (getKeyMap(options.keyMap) == startMap) {
            options.keyMap = (next.call ? next.call(null, instance) : next);
          }
        }, 50);
  
        var name = keyNames[e_prop(e, "keyCode")], handled = false;
        var flipCtrlCmd = opera && mac;
        if (name == null || e.altGraphKey) return false;
        if (e_prop(e, "altKey")) name = "Alt-" + name;
        if (e_prop(e, flipCtrlCmd ? "metaKey" : "ctrlKey")) name = "Ctrl-" + name;
        if (e_prop(e, flipCtrlCmd ? "ctrlKey" : "metaKey")) name = "Cmd-" + name;
  
        var stopped = false;
        function stop() { stopped = true; }
  
        if (e_prop(e, "shiftKey")) {
          handled = lookupKey("Shift-" + name, options.extraKeys, options.keyMap,
                              function(b) {return doHandleBinding(b, true);}, stop)
                 || lookupKey(name, options.extraKeys, options.keyMap, function(b) {
                   if (typeof b == "string" && /^go[A-Z]/.test(b)) return doHandleBinding(b);
                 }, stop);
        } else {
          handled = lookupKey(name, options.extraKeys, options.keyMap, doHandleBinding, stop);
        }
        if (stopped) handled = false;
        if (handled) {
          e_preventDefault(e);
          restartBlink();
          if (ie_lt9) { e.oldKeyCode = e.keyCode; e.keyCode = 0; }
        }
        return handled;
      }
      function handleCharBinding(e, ch) {
        var handled = lookupKey("'" + ch + "'", options.extraKeys,
                                options.keyMap, function(b) { return doHandleBinding(b, true); });
        if (handled) {
          e_preventDefault(e);
          restartBlink();
        }
        return handled;
      }
  
      var lastStoppedKey = null;
      function onKeyDown(e) {
        if (!focused) onFocus();
        if (ie && e.keyCode == 27) { e.returnValue = false; }
        if (pollingFast) { if (readInput()) pollingFast = false; }
        if (options.onKeyEvent && options.onKeyEvent(instance, addStop(e))) return;
        var code = e_prop(e, "keyCode");
        // IE does strange things with escape.
        setShift(code == 16 || e_prop(e, "shiftKey"));
        // First give onKeyEvent option a chance to handle this.
        var handled = handleKeyBinding(e);
        if (opera) {
          lastStoppedKey = handled ? code : null;
          // Opera has no cut event... we try to at least catch the key combo
          if (!handled && code == 88 && e_prop(e, mac ? "metaKey" : "ctrlKey"))
            replaceSelection("");
        }
      }
      function onKeyPress(e) {
        if (pollingFast) readInput();
        if (options.onKeyEvent && options.onKeyEvent(instance, addStop(e))) return;
        var keyCode = e_prop(e, "keyCode"), charCode = e_prop(e, "charCode");
        if (opera && keyCode == lastStoppedKey) {lastStoppedKey = null; e_preventDefault(e); return;}
        if (((opera && (!e.which || e.which < 10)) || khtml) && handleKeyBinding(e)) return;
        var ch = String.fromCharCode(charCode == null ? keyCode : charCode);
        if (options.electricChars && mode.electricChars && options.smartIndent && !options.readOnly) {
          if (mode.electricChars.indexOf(ch) > -1)
            setTimeout(operation(function() {indentLine(sel.to.line, "smart");}), 75);
        }
        if (handleCharBinding(e, ch)) return;
        fastPoll();
      }
      function onKeyUp(e) {
        if (options.onKeyEvent && options.onKeyEvent(instance, addStop(e))) return;
        if (e_prop(e, "keyCode") == 16) shiftSelecting = null;
      }
  
      function onFocus() {
        if (options.readOnly == "nocursor") return;
        if (!focused) {
          if (options.onFocus) options.onFocus(instance);
          focused = true;
          if (scroller.className.search(/\bCodeMirror-focused\b/) == -1)
            scroller.className += " CodeMirror-focused";
        }
        slowPoll();
        restartBlink();
      }
      function onBlur() {
        if (focused) {
          if (options.onBlur) options.onBlur(instance);
          focused = false;
          if (bracketHighlighted)
            operation(function(){
              if (bracketHighlighted) { bracketHighlighted(); bracketHighlighted = null; }
            })();
          scroller.className = scroller.className.replace(" CodeMirror-focused", "");
        }
        clearInterval(blinker);
        setTimeout(function() {if (!focused) shiftSelecting = null;}, 150);
      }
  
      // Replace the range from from to to by the strings in newText.
      // Afterwards, set the selection to selFrom, selTo.
      function updateLines(from, to, newText, selFrom, selTo) {
        if (suppressEdits) return;
        var old = [];
        doc.iter(from.line, to.line + 1, function(line) {
          old.push(newHL(line.text, line.markedSpans));
        });
        if (history) {
          history.addChange(from.line, newText.length, old);
          while (history.done.length > options.undoDepth) history.done.shift();
        }
        var lines = updateMarkedSpans(hlSpans(old[0]), hlSpans(lst(old)), from.ch, to.ch, newText);
        updateLinesNoUndo(from, to, lines, selFrom, selTo);
      }
      function unredoHelper(from, to) {
        if (!from.length) return;
        var set = from.pop(), out = [];
        for (var i = set.length - 1; i >= 0; i -= 1) {
          var change = set[i];
          var replaced = [], end = change.start + change.added;
          doc.iter(change.start, end, function(line) { replaced.push(newHL(line.text, line.markedSpans)); });
          out.push({start: change.start, added: change.old.length, old: replaced});
          var pos = {line: change.start + change.old.length - 1,
                     ch: editEnd(hlText(lst(replaced)), hlText(lst(change.old)))};
          updateLinesNoUndo({line: change.start, ch: 0}, {line: end - 1, ch: getLine(end-1).text.length},
                            change.old, pos, pos);
        }
        updateInput = true;
        to.push(out);
      }
      function undo() {unredoHelper(history.done, history.undone);}
      function redo() {unredoHelper(history.undone, history.done);}
  
      function updateLinesNoUndo(from, to, lines, selFrom, selTo) {
        if (suppressEdits) return;
        var recomputeMaxLength = false, maxLineLength = maxLine.text.length;
        if (!options.lineWrapping)
          doc.iter(from.line, to.line + 1, function(line) {
            if (!line.hidden && line.text.length == maxLineLength) {recomputeMaxLength = true; return true;}
          });
        if (from.line != to.line || lines.length > 1) gutterDirty = true;
  
        var nlines = to.line - from.line, firstLine = getLine(from.line), lastLine = getLine(to.line);
        var lastHL = lst(lines);
  
        // First adjust the line structure
        if (from.ch == 0 && to.ch == 0 && hlText(lastHL) == "") {
          // This is a whole-line replace. Treated specially to make
          // sure line objects move the way they are supposed to.
          var added = [], prevLine = null;
          for (var i = 0, e = lines.length - 1; i < e; ++i)
            added.push(new Line(hlText(lines[i]), hlSpans(lines[i])));
          lastLine.update(lastLine.text, hlSpans(lastHL));
          if (nlines) doc.remove(from.line, nlines, callbacks);
          if (added.length) doc.insert(from.line, added);
        } else if (firstLine == lastLine) {
          if (lines.length == 1) {
            firstLine.update(firstLine.text.slice(0, from.ch) + hlText(lines[0]) + firstLine.text.slice(to.ch), hlSpans(lines[0]));
          } else {
            for (var added = [], i = 1, e = lines.length - 1; i < e; ++i)
              added.push(new Line(hlText(lines[i]), hlSpans(lines[i])));
            added.push(new Line(hlText(lastHL) + firstLine.text.slice(to.ch), hlSpans(lastHL)));
            firstLine.update(firstLine.text.slice(0, from.ch) + hlText(lines[0]), hlSpans(lines[0]));
            doc.insert(from.line + 1, added);
          }
        } else if (lines.length == 1) {
          firstLine.update(firstLine.text.slice(0, from.ch) + hlText(lines[0]) + lastLine.text.slice(to.ch), hlSpans(lines[0]));
          doc.remove(from.line + 1, nlines, callbacks);
        } else {
          var added = [];
          firstLine.update(firstLine.text.slice(0, from.ch) + hlText(lines[0]), hlSpans(lines[0]));
          lastLine.update(hlText(lastHL) + lastLine.text.slice(to.ch), hlSpans(lastHL));
          for (var i = 1, e = lines.length - 1; i < e; ++i)
            added.push(new Line(hlText(lines[i]), hlSpans(lines[i])));
          if (nlines > 1) doc.remove(from.line + 1, nlines - 1, callbacks);
          doc.insert(from.line + 1, added);
        }
        if (options.lineWrapping) {
          var perLine = Math.max(5, scroller.clientWidth / charWidth() - 3);
          doc.iter(from.line, from.line + lines.length, function(line) {
            if (line.hidden) return;
            var guess = Math.ceil(line.text.length / perLine) || 1;
            if (guess != line.height) updateLineHeight(line, guess);
          });
        } else {
          doc.iter(from.line, from.line + lines.length, function(line) {
            var l = line.text;
            if (!line.hidden && l.length > maxLineLength) {
              maxLine = line; maxLineLength = l.length; maxLineChanged = true;
              recomputeMaxLength = false;
            }
          });
          if (recomputeMaxLength) updateMaxLine = true;
        }
  
        // Adjust frontier, schedule worker
        frontier = Math.min(frontier, from.line);
        startWorker(400);
  
        var lendiff = lines.length - nlines - 1;
        // Remember that these lines changed, for updating the display
        changes.push({from: from.line, to: to.line + 1, diff: lendiff});
        if (options.onChange) {
          // Normalize lines to contain only strings, since that's what
          // the change event handler expects
          for (var i = 0; i < lines.length; ++i)
            if (typeof lines[i] != "string") lines[i] = lines[i].text;
          var changeObj = {from: from, to: to, text: lines};
          if (textChanged) {
            for (var cur = textChanged; cur.next; cur = cur.next) {}
            cur.next = changeObj;
          } else textChanged = changeObj;
        }
  
        // Update the selection
        function updateLine(n) {return n <= Math.min(to.line, to.line + lendiff) ? n : n + lendiff;}
        setSelection(clipPos(selFrom), clipPos(selTo),
                     updateLine(sel.from.line), updateLine(sel.to.line));
      }
  
      function needsScrollbar() {
        var realHeight = doc.height * textHeight() + 2 * paddingTop();
        return realHeight * .99 > scroller.offsetHeight ? realHeight : false;
      }
  
      function updateVerticalScroll(scrollTop) {
        var scrollHeight = needsScrollbar();
        scrollbar.style.display = scrollHeight ? "block" : "none";
        if (scrollHeight) {
          scrollbarInner.style.height = sizer.style.minHeight = scrollHeight + "px";
          scrollbar.style.height = scroller.clientHeight + "px";
          if (scrollTop != null) {
            scrollbar.scrollTop = scroller.scrollTop = scrollTop;
            // 'Nudge' the scrollbar to work around a Webkit bug where,
            // in some situations, we'd end up with a scrollbar that
            // reported its scrollTop (and looked) as expected, but
            // *behaved* as if it was still in a previous state (i.e.
            // couldn't scroll up, even though it appeared to be at the
            // bottom).
            if (webkit) setTimeout(function() {
              if (scrollbar.scrollTop != scrollTop) return;
              scrollbar.scrollTop = scrollTop + (scrollTop ? -1 : 1);
              scrollbar.scrollTop = scrollTop;
            }, 0);
          }
        } else {
          sizer.style.minHeight = "";
        }
        // Position the mover div to align with the current virtual scroll position
        mover.style.top = displayOffset * textHeight() + "px";
      }
  
      function computeMaxLength() {
        maxLine = getLine(0); maxLineChanged = true;
        var maxLineLength = maxLine.text.length;
        doc.iter(1, doc.size, function(line) {
          var l = line.text;
          if (!line.hidden && l.length > maxLineLength) {
            maxLineLength = l.length; maxLine = line;
          }
        });
        updateMaxLine = false;
      }
  
      function replaceRange(code, from, to) {
        from = clipPos(from);
        if (!to) to = from; else to = clipPos(to);
        code = splitLines(code);
        function adjustPos(pos) {
          if (posLess(pos, from)) return pos;
          if (!posLess(to, pos)) return end;
          var line = pos.line + code.length - (to.line - from.line) - 1;
          var ch = pos.ch;
          if (pos.line == to.line)
            ch += lst(code).length - (to.ch - (to.line == from.line ? from.ch : 0));
          return {line: line, ch: ch};
        }
        var end;
        replaceRange1(code, from, to, function(end1) {
          end = end1;
          return {from: adjustPos(sel.from), to: adjustPos(sel.to)};
        });
        return end;
      }
      function replaceSelection(code, collapse) {
        replaceRange1(splitLines(code), sel.from, sel.to, function(end) {
          if (collapse == "end") return {from: end, to: end};
          else if (collapse == "start") return {from: sel.from, to: sel.from};
          else return {from: sel.from, to: end};
        });
      }
      function replaceRange1(code, from, to, computeSel) {
        var endch = code.length == 1 ? code[0].length + from.ch : lst(code).length;
        var newSel = computeSel({line: from.line + code.length - 1, ch: endch});
        updateLines(from, to, code, newSel.from, newSel.to);
      }
  
      function getRange(from, to, lineSep) {
        var l1 = from.line, l2 = to.line;
        if (l1 == l2) return getLine(l1).text.slice(from.ch, to.ch);
        var code = [getLine(l1).text.slice(from.ch)];
        doc.iter(l1 + 1, l2, function(line) { code.push(line.text); });
        code.push(getLine(l2).text.slice(0, to.ch));
        return code.join(lineSep || "\n");
      }
      function getSelection(lineSep) {
        return getRange(sel.from, sel.to, lineSep);
      }
  
      function slowPoll() {
        if (pollingFast) return;
        poll.set(options.pollInterval, function() {
          readInput();
          if (focused) slowPoll();
        });
      }
      function fastPoll() {
        var missed = false;
        pollingFast = true;
        function p() {
          var changed = readInput();
          if (!changed && !missed) {missed = true; poll.set(60, p);}
          else {pollingFast = false; slowPoll();}
        }
        poll.set(20, p);
      }
  
      // Previnput is a hack to work with IME. If we reset the textarea
      // on every change, that breaks IME. So we look for changes
      // compared to the previous content instead. (Modern browsers have
      // events that indicate IME taking place, but these are not widely
      // supported or compatible enough yet to rely on.)
      var prevInput = "";
      function readInput() {
        if (!focused || hasSelection(input) || options.readOnly) return false;
        var text = input.value;
        if (text == prevInput) return false;
        if (!nestedOperation) startOperation();
        shiftSelecting = null;
        var same = 0, l = Math.min(prevInput.length, text.length);
        while (same < l && prevInput[same] == text[same]) ++same;
        if (same < prevInput.length)
          sel.from = {line: sel.from.line, ch: sel.from.ch - (prevInput.length - same)};
        else if (overwrite && posEq(sel.from, sel.to) && !pasteIncoming)
          sel.to = {line: sel.to.line, ch: Math.min(getLine(sel.to.line).text.length, sel.to.ch + (text.length - same))};
        replaceSelection(text.slice(same), "end");
        if (text.length > 1000) { input.value = prevInput = ""; }
        else prevInput = text;
        if (!nestedOperation) endOperation();
        pasteIncoming = false;
        return true;
      }
      function resetInput(user) {
        if (!posEq(sel.from, sel.to)) {
          prevInput = "";
          input.value = getSelection();
          if (focused) selectInput(input);
        } else if (user) prevInput = input.value = "";
      }
  
      function focusInput() {
        if (options.readOnly != "nocursor" && (ie_lt9 || document.activeElement != input))
          input.focus();
      }
  
      function scrollCursorIntoView() {
        var coords = calculateCursorCoords();
        scrollIntoView(coords.x, coords.y, coords.x, coords.yBot);
        if (!focused) return;
        var box = sizer.getBoundingClientRect(), doScroll = null;
        if (coords.y + box.top < 0) doScroll = true;
        else if (coords.y + box.top + textHeight() > (window.innerHeight || document.documentElement.clientHeight)) doScroll = false;
        if (doScroll != null) {
          var hidden = cursor.style.display == "none";
          if (hidden) {
            cursor.style.display = "";
            cursor.style.left = coords.x + "px";
            cursor.style.top = (coords.y - displayOffset) + "px";
          }
          cursor.scrollIntoView(doScroll);
          if (hidden) cursor.style.display = "none";
        }
      }
      function calculateCursorCoords() {
        var cursor = localCoords(sel.inverted ? sel.from : sel.to);
        var x = options.lineWrapping ? Math.min(cursor.x, lineSpace.offsetWidth) : cursor.x;
        return {x: x, y: cursor.y, yBot: cursor.yBot};
      }
      function scrollIntoView(x1, y1, x2, y2) {
        var scrollPos = calculateScrollPos(x1, y1, x2, y2);
        if (scrollPos.scrollLeft != null) {scroller.scrollLeft = scrollPos.scrollLeft;}
        if (scrollPos.scrollTop != null) {scrollbar.scrollTop = scroller.scrollTop = scrollPos.scrollTop;}
      }
      function calculateScrollPos(x1, y1, x2, y2) {
        var pl = paddingLeft(), pt = paddingTop();
        y1 += pt; y2 += pt; x1 += pl; x2 += pl;
        var screen = scroller.clientHeight, screentop = scrollbar.scrollTop, result = {};
        var docBottom = needsScrollbar() || Infinity;
        var atTop = y1 < pt + 10, atBottom = y2 + pt > docBottom - 10;
        if (y1 < screentop) result.scrollTop = atTop ? 0 : Math.max(0, y1);
        else if (y2 > screentop + screen) result.scrollTop = (atBottom ? docBottom : y2) - screen;
  
        var screenw = scroller.clientWidth, screenleft = scroller.scrollLeft;
        var gutterw = options.fixedGutter ? gutter.clientWidth : 0;
        var atLeft = x1 < gutterw + pl + 10;
        if (x1 < screenleft + gutterw || atLeft) {
          if (atLeft) x1 = 0;
          result.scrollLeft = Math.max(0, x1 - 10 - gutterw);
        } else if (x2 > screenw + screenleft - 3) {
          result.scrollLeft = x2 + 10 - screenw;
        }
        return result;
      }
  
      function visibleLines(scrollTop) {
        var lh = textHeight(), top = (scrollTop != null ? scrollTop : scrollbar.scrollTop) - paddingTop();
        var fromHeight = Math.max(0, Math.floor(top / lh));
        var toHeight = Math.ceil((top + scroller.clientHeight) / lh);
        return {from: lineAtHeight(doc, fromHeight),
                to: lineAtHeight(doc, toHeight)};
      }
      // Uses a set of changes plus the current scroll position to
      // determine which DOM updates have to be made, and makes the
      // updates.
      function updateDisplay(changes, suppressCallback, scrollTop) {
        if (!scroller.clientWidth) {
          showingFrom = showingTo = displayOffset = 0;
          return;
        }
        // Compute the new visible window
        // If scrollTop is specified, use that to determine which lines
        // to render instead of the current scrollbar position.
        var visible = visibleLines(scrollTop);
        // Bail out if the visible area is already rendered and nothing changed.
        if (changes !== true && changes.length == 0 && visible.from > showingFrom && visible.to < showingTo) {
          updateVerticalScroll(scrollTop);
          return;
        }
        var from = Math.max(visible.from - 100, 0), to = Math.min(doc.size, visible.to + 100);
        if (showingFrom < from && from - showingFrom < 20) from = showingFrom;
        if (showingTo > to && showingTo - to < 20) to = Math.min(doc.size, showingTo);
  
        // Create a range of theoretically intact lines, and punch holes
        // in that using the change info.
        var intact = changes === true ? [] :
          computeIntact([{from: showingFrom, to: showingTo, domStart: 0}], changes);
        // Clip off the parts that won't be visible
        var intactLines = 0;
        for (var i = 0; i < intact.length; ++i) {
          var range = intact[i];
          if (range.from < from) {range.domStart += (from - range.from); range.from = from;}
          if (range.to > to) range.to = to;
          if (range.from >= range.to) intact.splice(i--, 1);
          else intactLines += range.to - range.from;
        }
        if (intactLines == to - from && from == showingFrom && to == showingTo) {
          updateVerticalScroll(scrollTop);
          return;
        }
        intact.sort(function(a, b) {return a.domStart - b.domStart;});
  
        var th = textHeight(), gutterDisplay = gutter.style.display;
        lineDiv.style.display = "none";
        patchDisplay(from, to, intact);
        lineDiv.style.display = gutter.style.display = "";
  
        var different = from != showingFrom || to != showingTo || lastSizeC != scroller.clientHeight + th;
        // This is just a bogus formula that detects when the editor is
        // resized or the font size changes.
        if (different) lastSizeC = scroller.clientHeight + th;
        if (from != showingFrom || to != showingTo && options.onViewportChange)
          setTimeout(function(){
            if (options.onViewportChange) options.onViewportChange(instance, from, to);
          });
        showingFrom = from; showingTo = to;
        displayOffset = heightAtLine(doc, from);
        startWorker(100);
  
        // Since this is all rather error prone, it is honoured with the
        // only assertion in the whole file.
        if (lineDiv.childNodes.length != showingTo - showingFrom)
          throw new Error("BAD PATCH! " + JSON.stringify(intact) + " size=" + (showingTo - showingFrom) +
                          " nodes=" + lineDiv.childNodes.length);
  
        function checkHeights() {
          var curNode = lineDiv.firstChild, heightChanged = false;
          doc.iter(showingFrom, showingTo, function(line) {
            // Work around bizarro IE7 bug where, sometimes, our curNode
            // is magically replaced with a new node in the DOM, leaving
            // us with a reference to an orphan (nextSibling-less) node.
            if (!curNode) return;
            if (!line.hidden) {
              var height = Math.round(curNode.offsetHeight / th) || 1;
              if (line.height != height) {
                updateLineHeight(line, height);
                gutterDirty = heightChanged = true;
              }
            }
            curNode = curNode.nextSibling;
          });
          return heightChanged;
        }
  
        if (options.lineWrapping) checkHeights();
  
        gutter.style.display = gutterDisplay;
        if (different || gutterDirty) {
          // If the gutter grew in size, re-check heights. If those changed, re-draw gutter.
          updateGutter() && options.lineWrapping && checkHeights() && updateGutter();
        }
        updateVerticalScroll(scrollTop);
        updateSelection();
        if (!suppressCallback && options.onUpdate) options.onUpdate(instance);
        return true;
      }
  
      function computeIntact(intact, changes) {
        for (var i = 0, l = changes.length || 0; i < l; ++i) {
          var change = changes[i], intact2 = [], diff = change.diff || 0;
          for (var j = 0, l2 = intact.length; j < l2; ++j) {
            var range = intact[j];
            if (change.to <= range.from && change.diff)
              intact2.push({from: range.from + diff, to: range.to + diff,
                            domStart: range.domStart});
            else if (change.to <= range.from || change.from >= range.to)
              intact2.push(range);
            else {
              if (change.from > range.from)
                intact2.push({from: range.from, to: change.from, domStart: range.domStart});
              if (change.to < range.to)
                intact2.push({from: change.to + diff, to: range.to + diff,
                              domStart: range.domStart + (change.to - range.from)});
            }
          }
          intact = intact2;
        }
        return intact;
      }
  
      function patchDisplay(from, to, intact) {
        function killNode(node) {
          var tmp = node.nextSibling;
          node.parentNode.removeChild(node);
          return tmp;
        }
        // The first pass removes the DOM nodes that aren't intact.
        if (!intact.length) removeChildren(lineDiv);
        else {
          var domPos = 0, curNode = lineDiv.firstChild, n;
          for (var i = 0; i < intact.length; ++i) {
            var cur = intact[i];
            while (cur.domStart > domPos) {curNode = killNode(curNode); domPos++;}
            for (var j = 0, e = cur.to - cur.from; j < e; ++j) {curNode = curNode.nextSibling; domPos++;}
          }
          while (curNode) curNode = killNode(curNode);
        }
        // This pass fills in the lines that actually changed.
        var nextIntact = intact.shift(), curNode = lineDiv.firstChild, j = from;
        doc.iter(from, to, function(line) {
          if (nextIntact && nextIntact.to == j) nextIntact = intact.shift();
          if (!nextIntact || nextIntact.from > j) {
            if (line.hidden) var lineElement = elt("pre");
            else {
              var lineElement = lineContent(line);
              if (line.className) lineElement.className = line.className;
              // Kludge to make sure the styled element lies behind the selection (by z-index)
              if (line.bgClassName) {
                var pre = elt("pre", "\u00a0", line.bgClassName, "position: absolute; left: 0; right: 0; top: 0; bottom: 0; z-index: -2");
                lineElement = elt("div", [pre, lineElement], null, "position: relative");
              }
            }
            lineDiv.insertBefore(lineElement, curNode);
          } else {
            curNode = curNode.nextSibling;
          }
          ++j;
        });
      }
  
      function updateGutter() {
        if (!options.gutter && !options.lineNumbers) return;
        var hText = mover.offsetHeight, hEditor = scroller.clientHeight;
        gutter.style.height = (hText - hEditor < 2 ? hEditor : hText) + "px";
        var fragment = document.createDocumentFragment(), i = showingFrom, normalNode;
        doc.iter(showingFrom, Math.max(showingTo, showingFrom + 1), function(line) {
          if (line.hidden) {
            fragment.appendChild(elt("pre"));
          } else {
            var marker = line.gutterMarker;
            var text = options.lineNumbers ? options.lineNumberFormatter(i + options.firstLineNumber) : null;
            if (marker && marker.text)
              text = marker.text.replace("%N%", text != null ? text : "");
            else if (text == null)
              text = "\u00a0";
            var markerElement = fragment.appendChild(elt("pre", null, marker && marker.style));
            markerElement.innerHTML = text;
            for (var j = 1; j < line.height; ++j) {
              markerElement.appendChild(elt("br"));
              markerElement.appendChild(document.createTextNode("\u00a0"));
            }
            if (!marker) normalNode = i;
          }
          ++i;
        });
        gutter.style.display = "none";
        removeChildrenAndAdd(gutterText, fragment);
        // Make sure scrolling doesn't cause number gutter size to pop
        if (normalNode != null && options.lineNumbers) {
          var node = gutterText.childNodes[normalNode - showingFrom];
          var minwidth = String(doc.size).length, val = eltText(node.firstChild), pad = "";
          while (val.length + pad.length < minwidth) pad += "\u00a0";
          if (pad) node.insertBefore(document.createTextNode(pad), node.firstChild);
        }
        gutter.style.display = "";
        var resized = Math.abs((parseInt(lineSpace.style.marginLeft) || 0) - gutter.offsetWidth) > 2;
        lineSpace.style.marginLeft = gutter.offsetWidth + "px";
        gutterDirty = false;
        return resized;
      }
      function updateSelection() {
        var collapsed = posEq(sel.from, sel.to);
        var fromPos = localCoords(sel.from, true);
        var toPos = collapsed ? fromPos : localCoords(sel.to, true);
        var headPos = sel.inverted ? fromPos : toPos, th = textHeight();
        var wrapOff = eltOffset(wrapper), lineOff = eltOffset(lineDiv);
        inputDiv.style.top = Math.max(0, Math.min(scroller.offsetHeight, headPos.y + lineOff.top - wrapOff.top)) + "px";
        inputDiv.style.left = Math.max(0, Math.min(scroller.offsetWidth, headPos.x + lineOff.left - wrapOff.left)) + "px";
        if (collapsed || options.showCursorWhenSelecting) {
          cursor.style.top = headPos.y + "px";
          cursor.style.left = (options.lineWrapping ? Math.min(headPos.x, lineSpace.offsetWidth) : headPos.x) + "px";
          cursor.style.display = "";
        } else {
          cursor.style.display = "none";
        }
        if (!collapsed) {
          var sameLine = fromPos.y == toPos.y, fragment = document.createDocumentFragment();
          var clientWidth = lineSpace.clientWidth || lineSpace.offsetWidth;
          var clientHeight = lineSpace.clientHeight || lineSpace.offsetHeight;
          var add = function(left, top, right, height) {
            var rstyle = quirksMode ? "width: " + (!right ? clientWidth : clientWidth - right - left) + "px"
                                    : "right: " + (right - 1) + "px";
            fragment.appendChild(elt("div", null, "CodeMirror-selected", "position: absolute; left: " + left +
                                     "px; top: " + top + "px; " + rstyle + "; height: " + height + "px"));
          };
          if (sel.from.ch && fromPos.y >= 0) {
            var right = sameLine ? clientWidth - toPos.x : 0;
            add(fromPos.x, fromPos.y, right, th);
          }
          var middleStart = Math.max(0, fromPos.y + (sel.from.ch ? th : 0));
          var middleHeight = Math.min(toPos.y, clientHeight) - middleStart;
          if (middleHeight > 0.2 * th)
            add(0, middleStart, 0, middleHeight);
          if ((!sameLine || !sel.from.ch) && toPos.y < clientHeight - .5 * th)
            add(0, toPos.y, clientWidth - toPos.x, th);
          removeChildrenAndAdd(selectionDiv, fragment);
          selectionDiv.style.display = "";
        } else {
          selectionDiv.style.display = "none";
        }
      }
  
      function setShift(val) {
        if (val) shiftSelecting = shiftSelecting || (sel.inverted ? sel.to : sel.from);
        else shiftSelecting = null;
      }
      function setSelectionUser(from, to) {
        var sh = shiftSelecting && clipPos(shiftSelecting);
        if (sh) {
          if (posLess(sh, from)) from = sh;
          else if (posLess(to, sh)) to = sh;
        }
        setSelection(from, to);
        userSelChange = true;
      }
      // Update the selection. Last two args are only used by
      // updateLines, since they have to be expressed in the line
      // numbers before the update.
      function setSelection(from, to, oldFrom, oldTo) {
        goalColumn = null;
        if (oldFrom == null) {oldFrom = sel.from.line; oldTo = sel.to.line;}
        if (posEq(sel.from, from) && posEq(sel.to, to)) return;
        if (posLess(to, from)) {var tmp = to; to = from; from = tmp;}
  
        // Skip over hidden lines.
        if (from.line != oldFrom) {
          var from1 = skipHidden(from, oldFrom, sel.from.ch);
          // If there is no non-hidden line left, force visibility on current line
          if (!from1) setLineHidden(from.line, false);
          else from = from1;
        }
        if (to.line != oldTo) to = skipHidden(to, oldTo, sel.to.ch);
  
        if (posEq(from, to)) sel.inverted = false;
        else if (posEq(from, sel.to)) sel.inverted = false;
        else if (posEq(to, sel.from)) sel.inverted = true;
  
        if (options.autoClearEmptyLines && posEq(sel.from, sel.to)) {
          var head = sel.inverted ? from : to;
          if (head.line != sel.from.line && sel.from.line < doc.size) {
            var oldLine = getLine(sel.from.line);
            if (/^\s+$/.test(oldLine.text))
              setTimeout(operation(function() {
                if (oldLine.parent && /^\s+$/.test(oldLine.text)) {
                  var no = lineNo(oldLine);
                  replaceRange("", {line: no, ch: 0}, {line: no, ch: oldLine.text.length});
                }
              }, 10));
          }
        }
  
        sel.from = from; sel.to = to;
        selectionChanged = true;
      }
      function skipHidden(pos, oldLine, oldCh) {
        function getNonHidden(dir) {
          var lNo = pos.line + dir, end = dir == 1 ? doc.size : -1;
          while (lNo != end) {
            var line = getLine(lNo);
            if (!line.hidden) {
              var ch = pos.ch;
              if (toEnd || ch > oldCh || ch > line.text.length) ch = line.text.length;
              return {line: lNo, ch: ch};
            }
            lNo += dir;
          }
        }
        var line = getLine(pos.line);
        var toEnd = pos.ch == line.text.length && pos.ch != oldCh;
        if (!line.hidden) return pos;
        if (pos.line >= oldLine) return getNonHidden(1) || getNonHidden(-1);
        else return getNonHidden(-1) || getNonHidden(1);
      }
      function setCursor(line, ch, user) {
        var pos = clipPos({line: line, ch: ch || 0});
        (user ? setSelectionUser : setSelection)(pos, pos);
      }
  
      function clipLine(n) {return Math.max(0, Math.min(n, doc.size-1));}
      function clipPos(pos) {
        if (pos.line < 0) return {line: 0, ch: 0};
        if (pos.line >= doc.size) return {line: doc.size-1, ch: getLine(doc.size-1).text.length};
        var ch = pos.ch, linelen = getLine(pos.line).text.length;
        if (ch == null || ch > linelen) return {line: pos.line, ch: linelen};
        else if (ch < 0) return {line: pos.line, ch: 0};
        else return pos;
      }
  
      function findPosH(dir, unit) {
        var end = sel.inverted ? sel.from : sel.to, line = end.line, ch = end.ch;
        var lineObj = getLine(line);
        function findNextLine() {
          for (var l = line + dir, e = dir < 0 ? -1 : doc.size; l != e; l += dir) {
            var lo = getLine(l);
            if (!lo.hidden) { line = l; lineObj = lo; return true; }
          }
        }
        function moveOnce(boundToLine) {
          if (ch == (dir < 0 ? 0 : lineObj.text.length)) {
            if (!boundToLine && findNextLine()) ch = dir < 0 ? lineObj.text.length : 0;
            else return false;
          } else ch += dir;
          return true;
        }
        if (unit == "char") moveOnce();
        else if (unit == "column") moveOnce(true);
        else if (unit == "word") {
          var sawWord = false;
          for (;;) {
            if (dir < 0) if (!moveOnce()) break;
            if (isWordChar(lineObj.text.charAt(ch))) sawWord = true;
            else if (sawWord) {if (dir < 0) {dir = 1; moveOnce();} break;}
            if (dir > 0) if (!moveOnce()) break;
          }
        }
        return {line: line, ch: ch};
      }
      function moveH(dir, unit) {
        var pos = dir < 0 ? sel.from : sel.to;
        if (shiftSelecting || posEq(sel.from, sel.to)) pos = findPosH(dir, unit);
        setCursor(pos.line, pos.ch, true);
      }
      function deleteH(dir, unit) {
        if (!posEq(sel.from, sel.to)) replaceRange("", sel.from, sel.to);
        else if (dir < 0) replaceRange("", findPosH(dir, unit), sel.to);
        else replaceRange("", sel.from, findPosH(dir, unit));
        userSelChange = true;
      }
      function moveV(dir, unit) {
        var dist = 0, pos = localCoords(sel.inverted ? sel.from : sel.to, true);
        if (goalColumn != null) pos.x = goalColumn;
        if (unit == "page") {
          var screen = Math.min(scroller.clientHeight, window.innerHeight || document.documentElement.clientHeight);
          var target = coordsChar(pos.x, pos.y + screen * dir);
        } else if (unit == "line") {
          var th = textHeight();
          var target = coordsChar(pos.x, pos.y + .5 * th + dir * th);
        }
        if (unit == "page") scrollbar.scrollTop += localCoords(target, true).y - pos.y;
        setCursor(target.line, target.ch, true);
        goalColumn = pos.x;
      }
  
      function findWordAt(pos) {
        var line = getLine(pos.line).text;
        var start = pos.ch, end = pos.ch;
        if (line) {
          if (pos.after === false || end == line.length) --start; else ++end;
          var startChar = line.charAt(start);
          var check = isWordChar(startChar) ? isWordChar :
                      /\s/.test(startChar) ? function(ch) {return /\s/.test(ch);} :
                      function(ch) {return !/\s/.test(ch) && isWordChar(ch);};
          while (start > 0 && check(line.charAt(start - 1))) --start;
          while (end < line.length && check(line.charAt(end))) ++end;
        }
        return {from: {line: pos.line, ch: start}, to: {line: pos.line, ch: end}};
      }
      function selectLine(line) {
        setSelectionUser({line: line, ch: 0}, clipPos({line: line + 1, ch: 0}));
      }
      function indentSelected(mode) {
        if (posEq(sel.from, sel.to)) return indentLine(sel.from.line, mode);
        var e = sel.to.line - (sel.to.ch ? 0 : 1);
        for (var i = sel.from.line; i <= e; ++i) indentLine(i, mode);
      }
  
      function indentLine(n, how) {
        if (!how) how = "add";
        if (how == "smart") {
          if (!mode.indent) how = "prev";
          else var state = getStateBefore(n);
        }
  
        var line = getLine(n), curSpace = line.indentation(options.tabSize),
            curSpaceString = line.text.match(/^\s*/)[0], indentation;
        if (how == "smart") {
          indentation = mode.indent(state, line.text.slice(curSpaceString.length), line.text);
          if (indentation == Pass) how = "prev";
        }
        if (how == "prev") {
          if (n) indentation = getLine(n-1).indentation(options.tabSize);
          else indentation = 0;
        }
        else if (how == "add") indentation = curSpace + options.indentUnit;
        else if (how == "subtract") indentation = curSpace - options.indentUnit;
        indentation = Math.max(0, indentation);
        var diff = indentation - curSpace;
  
        var indentString = "", pos = 0;
        if (options.indentWithTabs)
          for (var i = Math.floor(indentation / options.tabSize); i; --i) {pos += options.tabSize; indentString += "\t";}
        if (pos < indentation) indentString += spaceStr(indentation - pos);
  
        if (indentString != curSpaceString)
          replaceRange(indentString, {line: n, ch: 0}, {line: n, ch: curSpaceString.length});
        line.stateAfter = null;
      }
  
      function loadMode() {
        mode = CodeMirror.getMode(options, options.mode);
        doc.iter(0, doc.size, function(line) { line.stateAfter = null; });
        frontier = 0;
        startWorker(100);
      }
      function gutterChanged() {
        var visible = options.gutter || options.lineNumbers;
        gutter.style.display = visible ? "" : "none";
        if (visible) gutterDirty = true;
        else lineDiv.parentNode.style.marginLeft = 0;
      }
      function wrappingChanged(from, to) {
        if (options.lineWrapping) {
          wrapper.className += " CodeMirror-wrap";
          var perLine = scroller.clientWidth / charWidth() - 3;
          doc.iter(0, doc.size, function(line) {
            if (line.hidden) return;
            var guess = Math.ceil(line.text.length / perLine) || 1;
            if (guess != 1) updateLineHeight(line, guess);
          });
          lineSpace.style.minWidth = widthForcer.style.left = "";
        } else {
          wrapper.className = wrapper.className.replace(" CodeMirror-wrap", "");
          computeMaxLength();
          doc.iter(0, doc.size, function(line) {
            if (line.height != 1 && !line.hidden) updateLineHeight(line, 1);
          });
        }
        changes.push({from: 0, to: doc.size});
      }
      function themeChanged() {
        scroller.className = scroller.className.replace(/\s*cm-s-\S+/g, "") +
          options.theme.replace(/(^|\s)\s*/g, " cm-s-");
      }
      function keyMapChanged() {
        var style = keyMap[options.keyMap].style;
        wrapper.className = wrapper.className.replace(/\s*cm-keymap-\S+/g, "") +
          (style ? " cm-keymap-" + style : "");
      }
  
      function TextMarker(type, style) { this.lines = []; this.type = type; if (style) this.style = style; }
      TextMarker.prototype.clear = operation(function() {
        var min, max;
        for (var i = 0; i < this.lines.length; ++i) {
          var line = this.lines[i];
          var span = getMarkedSpanFor(line.markedSpans, this);
          if (span.from != null) min = lineNo(line);
          if (span.to != null) max = lineNo(line);
          line.markedSpans = removeMarkedSpan(line.markedSpans, span);
        }
        if (min != null) changes.push({from: min, to: max + 1});
        this.lines.length = 0;
        this.explicitlyCleared = true;
      });
      TextMarker.prototype.find = function() {
        var from, to;
        for (var i = 0; i < this.lines.length; ++i) {
          var line = this.lines[i];
          var span = getMarkedSpanFor(line.markedSpans, this);
          if (span.from != null || span.to != null) {
            var found = lineNo(line);
            if (span.from != null) from = {line: found, ch: span.from};
            if (span.to != null) to = {line: found, ch: span.to};
          }
        }
        if (this.type == "bookmark") return from;
        return from && {from: from, to: to};
      };
  
      function markText(from, to, className, options) {
        from = clipPos(from); to = clipPos(to);
        var marker = new TextMarker("range", className);
        if (options) for (var opt in options) if (options.hasOwnProperty(opt))
          marker[opt] = options[opt];
        var curLine = from.line;
        doc.iter(curLine, to.line + 1, function(line) {
          var span = {from: curLine == from.line ? from.ch : null,
                      to: curLine == to.line ? to.ch : null,
                      marker: marker};
          line.markedSpans = (line.markedSpans || []).concat([span]);
          marker.lines.push(line);
          ++curLine;
        });
        changes.push({from: from.line, to: to.line + 1});
        return marker;
      }
  
      function setBookmark(pos) {
        pos = clipPos(pos);
        var marker = new TextMarker("bookmark"), line = getLine(pos.line);
        history.addChange(pos.line, 1, [newHL(line.text, line.markedSpans)], true);
        var span = {from: pos.ch, to: pos.ch, marker: marker};
        line.markedSpans = (line.markedSpans || []).concat([span]);
        marker.lines.push(line);
        return marker;
      }
  
      function findMarksAt(pos) {
        pos = clipPos(pos);
        var markers = [], spans = getLine(pos.line).markedSpans;
        if (spans) for (var i = 0; i < spans.length; ++i) {
          var span = spans[i];
          if ((span.from == null || span.from <= pos.ch) &&
              (span.to == null || span.to >= pos.ch))
            markers.push(span.marker);
        }
        return markers;
      }
  
      function addGutterMarker(line, text, className) {
        if (typeof line == "number") line = getLine(clipLine(line));
        line.gutterMarker = {text: text, style: className};
        gutterDirty = true;
        return line;
      }
      function removeGutterMarker(line) {
        if (typeof line == "number") line = getLine(clipLine(line));
        line.gutterMarker = null;
        gutterDirty = true;
      }
  
      function changeLine(handle, op) {
        var no = handle, line = handle;
        if (typeof handle == "number") line = getLine(clipLine(handle));
        else no = lineNo(handle);
        if (no == null) return null;
        if (op(line, no)) changes.push({from: no, to: no + 1});
        else return null;
        return line;
      }
      function setLineClass(handle, className, bgClassName) {
        return changeLine(handle, function(line) {
          if (line.className != className || line.bgClassName != bgClassName) {
            line.className = className;
            line.bgClassName = bgClassName;
            return true;
          }
        });
      }
      function setLineHidden(handle, hidden) {
        return changeLine(handle, function(line, no) {
          if (line.hidden != hidden) {
            line.hidden = hidden;
            if (!options.lineWrapping) {
              if (hidden && line.text.length == maxLine.text.length) {
                updateMaxLine = true;
              } else if (!hidden && line.text.length > maxLine.text.length) {
                maxLine = line; updateMaxLine = false;
              }
            }
            updateLineHeight(line, hidden ? 0 : 1);
            var fline = sel.from.line, tline = sel.to.line;
            if (hidden && (fline == no || tline == no)) {
              var from = fline == no ? skipHidden({line: fline, ch: 0}, fline, 0) : sel.from;
              var to = tline == no ? skipHidden({line: tline, ch: 0}, tline, 0) : sel.to;
              // Can't hide the last visible line, we'd have no place to put the cursor
              if (!to) return;
              setSelection(from, to);
            }
            return (gutterDirty = true);
          }
        });
      }
  
      function lineInfo(line) {
        if (typeof line == "number") {
          if (!isLine(line)) return null;
          var n = line;
          line = getLine(line);
          if (!line) return null;
        } else {
          var n = lineNo(line);
          if (n == null) return null;
        }
        var marker = line.gutterMarker;
        return {line: n, handle: line, text: line.text, markerText: marker && marker.text,
                markerClass: marker && marker.style, lineClass: line.className, bgClass: line.bgClassName};
      }
  
      function measureLine(line, ch) {
        if (ch == 0) return {top: 0, left: 0};
        var pre = lineContent(line, ch);
        removeChildrenAndAdd(measure, pre);
        var anchor = pre.anchor;
        var top = anchor.offsetTop, left = anchor.offsetLeft;
        // Older IEs report zero offsets for spans directly after a wrap
        if (ie && top == 0 && left == 0) {
          var backup = elt("span", "x");
          anchor.parentNode.insertBefore(backup, anchor.nextSibling);
          top = backup.offsetTop;
        }
        return {top: top, left: left};
      }
      function localCoords(pos, inLineWrap) {
        var x, lh = textHeight(), y = lh * (heightAtLine(doc, pos.line) - (inLineWrap ? displayOffset : 0));
        if (pos.ch == 0) x = 0;
        else {
          var sp = measureLine(getLine(pos.line), pos.ch);
          x = sp.left;
          if (options.lineWrapping) y += Math.max(0, sp.top);
        }
        return {x: x, y: y, yBot: y + lh};
      }
      // Coords must be lineSpace-local
      function coordsChar(x, y) {
        var th = textHeight(), cw = charWidth(), heightPos = displayOffset + Math.floor(y / th);
        if (heightPos < 0) return {line: 0, ch: 0};
        var lineNo = lineAtHeight(doc, heightPos);
        if (lineNo >= doc.size) return {line: doc.size - 1, ch: getLine(doc.size - 1).text.length};
        var lineObj = getLine(lineNo), text = lineObj.text;
        var tw = options.lineWrapping, innerOff = tw ? heightPos - heightAtLine(doc, lineNo) : 0;
        if (x <= 0 && innerOff == 0) return {line: lineNo, ch: 0};
        var wrongLine = false;
        function getX(len) {
          var sp = measureLine(lineObj, len);
          if (tw) {
            var off = Math.round(sp.top / th);
            wrongLine = off != innerOff;
            return Math.max(0, sp.left + (off - innerOff) * scroller.clientWidth);
          }
          return sp.left;
        }
        var from = 0, fromX = 0, to = text.length, toX;
        // Guess a suitable upper bound for our search.
        var estimated = Math.min(to, Math.ceil((x + innerOff * scroller.clientWidth * .9) / cw));
        for (;;) {
          var estX = getX(estimated);
          if (estX <= x && estimated < to) estimated = Math.min(to, Math.ceil(estimated * 1.2));
          else {toX = estX; to = estimated; break;}
        }
        if (x > toX) return {line: lineNo, ch: to};
        // Try to guess a suitable lower bound as well.
        estimated = Math.floor(to * 0.8); estX = getX(estimated);
        if (estX < x) {from = estimated; fromX = estX;}
        // Do a binary search between these bounds.
        for (;;) {
          if (to - from <= 1) {
            var after = x - fromX < toX - x;
            return {line: lineNo, ch: after ? from : to, after: after};
          }
          var middle = Math.ceil((from + to) / 2), middleX = getX(middle);
          if (middleX > x) {to = middle; toX = middleX; if (wrongLine) toX += 1000; }
          else {from = middle; fromX = middleX;}
        }
      }
      function pageCoords(pos) {
        var local = localCoords(pos, true), off = eltOffset(lineSpace);
        return {x: off.left + local.x, y: off.top + local.y, yBot: off.top + local.yBot};
      }
  
      var cachedHeight, cachedHeightFor, measurePre;
      function textHeight() {
        if (measurePre == null) {
          measurePre = elt("pre");
          for (var i = 0; i < 49; ++i) {
            measurePre.appendChild(document.createTextNode("x"));
            measurePre.appendChild(elt("br"));
          }
          measurePre.appendChild(document.createTextNode("x"));
        }
        var offsetHeight = lineDiv.clientHeight;
        if (offsetHeight == cachedHeightFor) return cachedHeight;
        cachedHeightFor = offsetHeight;
        removeChildrenAndAdd(measure, measurePre.cloneNode(true));
        cachedHeight = measure.firstChild.offsetHeight / 50 || 1;
        removeChildren(measure);
        return cachedHeight;
      }
      var cachedWidth, cachedWidthFor = 0;
      function charWidth() {
        if (scroller.clientWidth == cachedWidthFor) return cachedWidth;
        cachedWidthFor = scroller.clientWidth;
        var anchor = elt("span", "x");
        var pre = elt("pre", [anchor]);
        removeChildrenAndAdd(measure, pre);
        return (cachedWidth = anchor.offsetWidth || 10);
      }
      function paddingTop() {return lineSpace.offsetTop;}
      function paddingLeft() {return lineSpace.offsetLeft;}
  
      function posFromMouse(e, liberal) {
        var offW = eltOffset(scroller, true), x, y;
        // Fails unpredictably on IE[67] when mouse is dragged around quickly.
        try { x = e.clientX; y = e.clientY; } catch (e) { return null; }
        // This is a mess of a heuristic to try and determine whether a
        // scroll-bar was clicked or not, and to return null if one was
        // (and !liberal).
        if (!liberal && (x - offW.left > scroller.clientWidth || y - offW.top > scroller.clientHeight))
          return null;
        var offL = eltOffset(lineSpace, true);
        return coordsChar(x - offL.left, y - offL.top);
      }
      var detectingSelectAll;
      function onContextMenu(e) {
        var pos = posFromMouse(e), scrollPos = scrollbar.scrollTop;
        if (!pos || opera) return; // Opera is difficult.
        if (posEq(sel.from, sel.to) || posLess(pos, sel.from) || !posLess(pos, sel.to))
          operation(setCursor)(pos.line, pos.ch);
  
        var oldCSS = input.style.cssText;
        inputDiv.style.position = "absolute";
        input.style.cssText = "position: fixed; width: 30px; height: 30px; top: " + (e.clientY - 5) +
          "px; left: " + (e.clientX - 5) + "px; z-index: 1000; background: white; " +
          "border-width: 0; outline: none; overflow: hidden; opacity: .05; filter: alpha(opacity=5);";
        focusInput();
        resetInput(true);
        // Adds "Select all" to context menu in FF
        if (posEq(sel.from, sel.to)) input.value = prevInput = " ";
  
        function rehide() {
          inputDiv.style.position = "relative";
          input.style.cssText = oldCSS;
          if (ie_lt9) scrollbar.scrollTop = scrollPos;
          slowPoll();
  
          // Try to detect the user choosing select-all
          if (input.selectionStart != null) {
            clearTimeout(detectingSelectAll);
            var extval = input.value = " " + (posEq(sel.from, sel.to) ? "" : input.value), i = 0;
            prevInput = " ";
            input.selectionStart = 1; input.selectionEnd = extval.length;
            detectingSelectAll = setTimeout(function poll(){
              if (prevInput == " " && input.selectionStart == 0)
                operation(commands.selectAll)(instance);
              else if (i++ < 10) detectingSelectAll = setTimeout(poll, 500);
              else resetInput();
            }, 200);
          }
        }
  
        if (gecko) {
          e_stop(e);
          var mouseup = connect(window, "mouseup", function() {
            mouseup();
            setTimeout(rehide, 20);
          }, true);
        } else {
          setTimeout(rehide, 50);
        }
      }
  
      // Cursor-blinking
      function restartBlink() {
        clearInterval(blinker);
        var on = true;
        cursor.style.visibility = "";
        blinker = setInterval(function() {
          cursor.style.visibility = (on = !on) ? "" : "hidden";
        }, options.cursorBlinkRate);
      }
  
      var matching = {"(": ")>", ")": "(<", "[": "]>", "]": "[<", "{": "}>", "}": "{<"};
      function matchBrackets(autoclear) {
        var head = sel.inverted ? sel.from : sel.to, line = getLine(head.line), pos = head.ch - 1;
        var match = (pos >= 0 && matching[line.text.charAt(pos)]) || matching[line.text.charAt(++pos)];
        if (!match) return;
        var ch = match.charAt(0), forward = match.charAt(1) == ">", d = forward ? 1 : -1, st = line.styles;
        for (var off = pos + 1, i = 0, e = st.length; i < e; i+=2)
          if ((off -= st[i].length) <= 0) {var style = st[i+1]; break;}
  
        var stack = [line.text.charAt(pos)], re = /[(){}[\]]/;
        function scan(line, from, to) {
          if (!line.text) return;
          var st = line.styles, pos = forward ? 0 : line.text.length - 1, cur;
          for (var i = forward ? 0 : st.length - 2, e = forward ? st.length : -2; i != e; i += 2*d) {
            var text = st[i];
            if (st[i+1] != style) {pos += d * text.length; continue;}
            for (var j = forward ? 0 : text.length - 1, te = forward ? text.length : -1; j != te; j += d, pos+=d) {
              if (pos >= from && pos < to && re.test(cur = text.charAt(j))) {
                var match = matching[cur];
                if (match.charAt(1) == ">" == forward) stack.push(cur);
                else if (stack.pop() != match.charAt(0)) return {pos: pos, match: false};
                else if (!stack.length) return {pos: pos, match: true};
              }
            }
          }
        }
        for (var i = head.line, e = forward ? Math.min(i + 100, doc.size) : Math.max(-1, i - 100); i != e; i+=d) {
          var line = getLine(i), first = i == head.line;
          var found = scan(line, first && forward ? pos + 1 : 0, first && !forward ? pos : line.text.length);
          if (found) break;
        }
        if (!found) found = {pos: null, match: false};
        var style = found.match ? "CodeMirror-matchingbracket" : "CodeMirror-nonmatchingbracket";
        var one = markText({line: head.line, ch: pos}, {line: head.line, ch: pos+1}, style),
            two = found.pos != null && markText({line: i, ch: found.pos}, {line: i, ch: found.pos + 1}, style);
        var clear = operation(function(){one.clear(); two && two.clear();});
        if (autoclear) setTimeout(clear, 800);
        else bracketHighlighted = clear;
      }
  
      // Finds the line to start with when starting a parse. Tries to
      // find a line with a stateAfter, so that it can start with a
      // valid state. If that fails, it returns the line with the
      // smallest indentation, which tends to need the least context to
      // parse correctly.
      function findStartLine(n) {
        var minindent, minline;
        for (var search = n, lim = n - 40; search > lim; --search) {
          if (search == 0) return 0;
          var line = getLine(search-1);
          if (line.stateAfter) return search;
          var indented = line.indentation(options.tabSize);
          if (minline == null || minindent > indented) {
            minline = search - 1;
            minindent = indented;
          }
        }
        return minline;
      }
      function getStateBefore(n) {
        var pos = findStartLine(n), state = pos && getLine(pos-1).stateAfter;
        if (!state) state = startState(mode);
        else state = copyState(mode, state);
        doc.iter(pos, n, function(line) {
          line.process(mode, state, options.tabSize);
          line.stateAfter = (pos == n - 1 || pos % 5 == 0) ? copyState(mode, state) : null;
        });
        return state;
      }
      function highlightWorker() {
        if (frontier >= showingTo) return;
        var end = +new Date + options.workTime, state = copyState(mode, getStateBefore(frontier));
        var startFrontier = frontier;
        doc.iter(frontier, showingTo, function(line) {
          if (frontier >= showingFrom) { // Visible
            line.highlight(mode, state, options.tabSize);
            line.stateAfter = copyState(mode, state);
          } else {
            line.process(mode, state, options.tabSize);
            line.stateAfter = frontier % 5 == 0 ? copyState(mode, state) : null;
          }
          ++frontier;
          if (+new Date > end) {
            startWorker(options.workDelay);
            return true;
          }
        });
        if (showingTo > startFrontier && frontier >= showingFrom)
          operation(function() {changes.push({from: startFrontier, to: frontier});})();
      }
      function startWorker(time) {
        if (frontier < showingTo)
          highlight.set(time, highlightWorker);
      }
  
      // Operations are used to wrap changes in such a way that each
      // change won't have to update the cursor and display (which would
      // be awkward, slow, and error-prone), but instead updates are
      // batched and then all combined and executed at once.
      function startOperation() {
        updateInput = userSelChange = textChanged = null;
        changes = []; selectionChanged = false; callbacks = [];
      }
      function endOperation() {
        if (updateMaxLine) computeMaxLength();
        if (maxLineChanged && !options.lineWrapping) {
          var cursorWidth = widthForcer.offsetWidth, left = measureLine(maxLine, maxLine.text.length).left;
          if (!ie_lt8) {
            widthForcer.style.left = left + "px";
            lineSpace.style.minWidth = (left + cursorWidth) + "px";
          }
          maxLineChanged = false;
        }
        var newScrollPos, updated;
        if (selectionChanged) {
          var coords = calculateCursorCoords();
          newScrollPos = calculateScrollPos(coords.x, coords.y, coords.x, coords.yBot);
        }
        if (changes.length || newScrollPos && newScrollPos.scrollTop != null)
          updated = updateDisplay(changes, true, newScrollPos && newScrollPos.scrollTop);
        if (!updated) {
          if (selectionChanged) updateSelection();
          if (gutterDirty) updateGutter();
        }
        if (newScrollPos) scrollCursorIntoView();
        if (selectionChanged) restartBlink();
  
        if (focused && (updateInput === true || (updateInput !== false && selectionChanged)))
          resetInput(userSelChange);
  
        if (selectionChanged && options.matchBrackets)
          setTimeout(operation(function() {
            if (bracketHighlighted) {bracketHighlighted(); bracketHighlighted = null;}
            if (posEq(sel.from, sel.to)) matchBrackets(false);
          }), 20);
        var sc = selectionChanged, cbs = callbacks; // these can be reset by callbacks
        if (textChanged && options.onChange && instance)
          options.onChange(instance, textChanged);
        if (sc && options.onCursorActivity)
          options.onCursorActivity(instance);
        for (var i = 0; i < cbs.length; ++i) cbs[i](instance);
        if (updated && options.onUpdate) options.onUpdate(instance);
      }
      var nestedOperation = 0;
      function operation(f) {
        return function() {
          if (!nestedOperation++) startOperation();
          try {var result = f.apply(this, arguments);}
          finally {if (!--nestedOperation) endOperation();}
          return result;
        };
      }
  
      function compoundChange(f) {
        history.startCompound();
        try { return f(); } finally { history.endCompound(); }
      }
  
      for (var ext in extensions)
        if (extensions.propertyIsEnumerable(ext) &&
            !instance.propertyIsEnumerable(ext))
          instance[ext] = extensions[ext];
      for (var i = 0; i < initHooks.length; ++i) initHooks[i](instance);
      return instance;
    } // (end of function CodeMirror)
  
    // The default configuration options.
    CodeMirror.defaults = {
      value: "",
      mode: null,
      theme: "default",
      indentUnit: 2,
      indentWithTabs: false,
      smartIndent: true,
      tabSize: 4,
      keyMap: "default",
      extraKeys: null,
      electricChars: true,
      autoClearEmptyLines: false,
      onKeyEvent: null,
      onDragEvent: null,
      lineWrapping: false,
      lineNumbers: false,
      gutter: false,
      fixedGutter: false,
      firstLineNumber: 1,
      showCursorWhenSelecting: false,
      readOnly: false,
      dragDrop: true,
      onChange: null,
      onCursorActivity: null,
      onViewportChange: null,
      onGutterClick: null,
      onUpdate: null,
      onFocus: null, onBlur: null, onScroll: null,
      matchBrackets: false,
      cursorBlinkRate: 530,
      workTime: 100,
      workDelay: 200,
      pollInterval: 100,
      undoDepth: 40,
      tabindex: null,
      autofocus: null,
      lineNumberFormatter: function(integer) { return integer; }
    };
  
    var ios = /AppleWebKit/.test(navigator.userAgent) && /Mobile\/\w+/.test(navigator.userAgent);
    var mac = ios || /Mac/.test(navigator.platform);
    var win = /Win/.test(navigator.platform);
  
    // Known modes, by name and by MIME
    var modes = CodeMirror.modes = {}, mimeModes = CodeMirror.mimeModes = {};
    CodeMirror.defineMode = function(name, mode) {
      if (!CodeMirror.defaults.mode && name != "null") CodeMirror.defaults.mode = name;
      if (arguments.length > 2) {
        mode.dependencies = [];
        for (var i = 2; i < arguments.length; ++i) mode.dependencies.push(arguments[i]);
      }
      modes[name] = mode;
    };
    CodeMirror.defineMIME = function(mime, spec) {
      mimeModes[mime] = spec;
    };
    CodeMirror.resolveMode = function(spec) {
      if (typeof spec == "string" && mimeModes.hasOwnProperty(spec))
        spec = mimeModes[spec];
      else if (typeof spec == "string" && /^[\w\-]+\/[\w\-]+\+xml$/.test(spec))
        return CodeMirror.resolveMode("application/xml");
      if (typeof spec == "string") return {name: spec};
      else return spec || {name: "null"};
    };
    CodeMirror.getMode = function(options, spec) {
      var spec = CodeMirror.resolveMode(spec);
      var mfactory = modes[spec.name];
      if (!mfactory) return CodeMirror.getMode(options, "text/plain");
      var modeObj = mfactory(options, spec);
      if (modeExtensions.hasOwnProperty(spec.name)) {
        var exts = modeExtensions[spec.name];
        for (var prop in exts) {
          if (!exts.hasOwnProperty(prop)) continue;
          if (modeObj.hasOwnProperty(prop)) modeObj["_" + prop] = modeObj[prop];
          modeObj[prop] = exts[prop];
        }
      }
      modeObj.name = spec.name;
      return modeObj;
    };
    CodeMirror.listModes = function() {
      var list = [];
      for (var m in modes)
        if (modes.propertyIsEnumerable(m)) list.push(m);
      return list;
    };
    CodeMirror.listMIMEs = function() {
      var list = [];
      for (var m in mimeModes)
        if (mimeModes.propertyIsEnumerable(m)) list.push({mime: m, mode: mimeModes[m]});
      return list;
    };
  
    var extensions = CodeMirror.extensions = {};
    CodeMirror.defineExtension = function(name, func) {
      extensions[name] = func;
    };
  
    var initHooks = [];
    CodeMirror.defineInitHook = function(f) {initHooks.push(f);};
  
    var modeExtensions = CodeMirror.modeExtensions = {};
    CodeMirror.extendMode = function(mode, properties) {
      var exts = modeExtensions.hasOwnProperty(mode) ? modeExtensions[mode] : (modeExtensions[mode] = {});
      for (var prop in properties) if (properties.hasOwnProperty(prop))
        exts[prop] = properties[prop];
    };
  
    var commands = CodeMirror.commands = {
      selectAll: function(cm) {cm.setSelection({line: 0, ch: 0}, {line: cm.lineCount() - 1});},
      killLine: function(cm) {
        var from = cm.getCursor(true), to = cm.getCursor(false), sel = !posEq(from, to);
        if (!sel && cm.getLine(from.line).length == from.ch) cm.replaceRange("", from, {line: from.line + 1, ch: 0});
        else cm.replaceRange("", from, sel ? to : {line: from.line});
      },
      deleteLine: function(cm) {var l = cm.getCursor().line; cm.replaceRange("", {line: l, ch: 0}, {line: l});},
      undo: function(cm) {cm.undo();},
      redo: function(cm) {cm.redo();},
      goDocStart: function(cm) {cm.setCursor(0, 0, true);},
      goDocEnd: function(cm) {cm.setSelection({line: cm.lineCount() - 1}, null, true);},
      goLineStart: function(cm) {cm.setCursor(cm.getCursor().line, 0, true);},
      goLineStartSmart: function(cm) {
        var cur = cm.getCursor();
        var text = cm.getLine(cur.line), firstNonWS = Math.max(0, text.search(/\S/));
        cm.setCursor(cur.line, cur.ch <= firstNonWS && cur.ch ? 0 : firstNonWS, true);
      },
      goLineEnd: function(cm) {cm.setSelection({line: cm.getCursor().line}, null, true);},
      goLineUp: function(cm) {cm.moveV(-1, "line");},
      goLineDown: function(cm) {cm.moveV(1, "line");},
      goPageUp: function(cm) {cm.moveV(-1, "page");},
      goPageDown: function(cm) {cm.moveV(1, "page");},
      goCharLeft: function(cm) {cm.moveH(-1, "char");},
      goCharRight: function(cm) {cm.moveH(1, "char");},
      goColumnLeft: function(cm) {cm.moveH(-1, "column");},
      goColumnRight: function(cm) {cm.moveH(1, "column");},
      goWordLeft: function(cm) {cm.moveH(-1, "word");},
      goWordRight: function(cm) {cm.moveH(1, "word");},
      delCharLeft: function(cm) {cm.deleteH(-1, "char");},
      delCharRight: function(cm) {cm.deleteH(1, "char");},
      delWordLeft: function(cm) {cm.deleteH(-1, "word");},
      delWordRight: function(cm) {cm.deleteH(1, "word");},
      indentAuto: function(cm) {cm.indentSelection("smart");},
      indentMore: function(cm) {cm.indentSelection("add");},
      indentLess: function(cm) {cm.indentSelection("subtract");},
      insertTab: function(cm) {cm.replaceSelection("\t", "end");},
      defaultTab: function(cm) {
        if (cm.somethingSelected()) cm.indentSelection("add");
        else cm.replaceSelection("\t", "end");
      },
      transposeChars: function(cm) {
        var cur = cm.getCursor(), line = cm.getLine(cur.line);
        if (cur.ch > 0 && cur.ch < line.length - 1)
          cm.replaceRange(line.charAt(cur.ch) + line.charAt(cur.ch - 1),
                          {line: cur.line, ch: cur.ch - 1}, {line: cur.line, ch: cur.ch + 1});
      },
      newlineAndIndent: function(cm) {
        cm.replaceSelection("\n", "end");
        cm.indentLine(cm.getCursor().line);
      },
      toggleOverwrite: function(cm) {cm.toggleOverwrite();}
    };
  
    var keyMap = CodeMirror.keyMap = {};
    keyMap.basic = {
      "Left": "goCharLeft", "Right": "goCharRight", "Up": "goLineUp", "Down": "goLineDown",
      "End": "goLineEnd", "Home": "goLineStartSmart", "PageUp": "goPageUp", "PageDown": "goPageDown",
      "Delete": "delCharRight", "Backspace": "delCharLeft", "Tab": "defaultTab", "Shift-Tab": "indentAuto",
      "Enter": "newlineAndIndent", "Insert": "toggleOverwrite"
    };
    // Note that the save and find-related commands aren't defined by
    // default. Unknown commands are simply ignored.
    keyMap.pcDefault = {
      "Ctrl-A": "selectAll", "Ctrl-D": "deleteLine", "Ctrl-Z": "undo", "Shift-Ctrl-Z": "redo", "Ctrl-Y": "redo",
      "Ctrl-Home": "goDocStart", "Alt-Up": "goDocStart", "Ctrl-End": "goDocEnd", "Ctrl-Down": "goDocEnd",
      "Ctrl-Left": "goWordLeft", "Ctrl-Right": "goWordRight", "Alt-Left": "goLineStart", "Alt-Right": "goLineEnd",
      "Ctrl-Backspace": "delWordLeft", "Ctrl-Delete": "delWordRight", "Ctrl-S": "save", "Ctrl-F": "find",
      "Ctrl-G": "findNext", "Shift-Ctrl-G": "findPrev", "Shift-Ctrl-F": "replace", "Shift-Ctrl-R": "replaceAll",
      "Ctrl-[": "indentLess", "Ctrl-]": "indentMore",
      fallthrough: "basic"
    };
    keyMap.macDefault = {
      "Cmd-A": "selectAll", "Cmd-D": "deleteLine", "Cmd-Z": "undo", "Shift-Cmd-Z": "redo", "Cmd-Y": "redo",
      "Cmd-Up": "goDocStart", "Cmd-End": "goDocEnd", "Cmd-Down": "goDocEnd", "Alt-Left": "goWordLeft",
      "Alt-Right": "goWordRight", "Cmd-Left": "goLineStart", "Cmd-Right": "goLineEnd", "Alt-Backspace": "delWordLeft",
      "Ctrl-Alt-Backspace": "delWordRight", "Alt-Delete": "delWordRight", "Cmd-S": "save", "Cmd-F": "find",
      "Cmd-G": "findNext", "Shift-Cmd-G": "findPrev", "Cmd-Alt-F": "replace", "Shift-Cmd-Alt-F": "replaceAll",
      "Cmd-[": "indentLess", "Cmd-]": "indentMore",
      fallthrough: ["basic", "emacsy"]
    };
    keyMap["default"] = mac ? keyMap.macDefault : keyMap.pcDefault;
    keyMap.emacsy = {
      "Ctrl-F": "goCharRight", "Ctrl-B": "goCharLeft", "Ctrl-P": "goLineUp", "Ctrl-N": "goLineDown",
      "Alt-F": "goWordRight", "Alt-B": "goWordLeft", "Ctrl-A": "goLineStart", "Ctrl-E": "goLineEnd",
      "Ctrl-V": "goPageDown", "Shift-Ctrl-V": "goPageUp", "Ctrl-D": "delCharRight", "Ctrl-H": "delCharLeft",
      "Alt-D": "delWordRight", "Alt-Backspace": "delWordLeft", "Ctrl-K": "killLine", "Ctrl-T": "transposeChars"
    };
  
    function getKeyMap(val) {
      if (typeof val == "string") return keyMap[val];
      else return val;
    }
    function lookupKey(name, extraMap, map, handle, stop) {
      function lookup(map) {
        map = getKeyMap(map);
        var found = map[name];
        if (found === false) {
          if (stop) stop();
          return true;
        }
        if (found != null && handle(found)) return true;
        if (map.nofallthrough) {
          if (stop) stop();
          return true;
        }
        var fallthrough = map.fallthrough;
        if (fallthrough == null) return false;
        if (Object.prototype.toString.call(fallthrough) != "[object Array]")
          return lookup(fallthrough);
        for (var i = 0, e = fallthrough.length; i < e; ++i) {
          if (lookup(fallthrough[i])) return true;
        }
        return false;
      }
      if (extraMap && lookup(extraMap)) return true;
      return lookup(map);
    }
    function isModifierKey(event) {
      var name = keyNames[e_prop(event, "keyCode")];
      return name == "Ctrl" || name == "Alt" || name == "Shift" || name == "Mod";
    }
    CodeMirror.isModifierKey = isModifierKey;
  
    CodeMirror.fromTextArea = function(textarea, options) {
      if (!options) options = {};
      options.value = textarea.value;
      if (!options.tabindex && textarea.tabindex)
        options.tabindex = textarea.tabindex;
      // Set autofocus to true if this textarea is focused, or if it has
      // autofocus and no other element is focused.
      if (options.autofocus == null) {
        var hasFocus = document.body;
        // doc.activeElement occasionally throws on IE
        try { hasFocus = document.activeElement; } catch(e) {}
        options.autofocus = hasFocus == textarea ||
          textarea.getAttribute("autofocus") != null && hasFocus == document.body;
      }
  
      function save() {textarea.value = instance.getValue();}
      if (textarea.form) {
        // Deplorable hack to make the submit method do the right thing.
        var rmSubmit = connect(textarea.form, "submit", save, true);
        var form = textarea.form, realSubmit = form.submit;
        textarea.form.submit = function wrappedSubmit() {
          save();
          form.submit = realSubmit;
          form.submit();
          form.submit = wrappedSubmit;
        };
      }
  
      textarea.style.display = "none";
      var instance = CodeMirror(function(node) {
        textarea.parentNode.insertBefore(node, textarea.nextSibling);
      }, options);
      instance.save = save;
      instance.getTextArea = function() { return textarea; };
      instance.toTextArea = function() {
        save();
        textarea.parentNode.removeChild(instance.getWrapperElement());
        textarea.style.display = "";
        if (textarea.form) {
          rmSubmit();
          if (typeof textarea.form.submit == "function")
            textarea.form.submit = realSubmit;
        }
      };
      return instance;
    };
  
    var gecko = /gecko\/\d/i.test(navigator.userAgent);
    var ie = /MSIE \d/.test(navigator.userAgent);
    var ie_lt8 = /MSIE [1-7]\b/.test(navigator.userAgent);
    var ie_lt9 = /MSIE [1-8]\b/.test(navigator.userAgent);
    var quirksMode = ie && document.documentMode == 5;
    var webkit = /WebKit\//.test(navigator.userAgent);
    var chrome = /Chrome\//.test(navigator.userAgent);
    var opera = /Opera\//.test(navigator.userAgent);
    var safari = /Apple Computer/.test(navigator.vendor);
    var khtml = /KHTML\//.test(navigator.userAgent);
    var mac_geLion = /Mac OS X 10\D([7-9]|\d\d)\D/.test(navigator.userAgent);
  
    // Utility functions for working with state. Exported because modes
    // sometimes need to do this.
    function copyState(mode, state) {
      if (state === true) return state;
      if (mode.copyState) return mode.copyState(state);
      var nstate = {};
      for (var n in state) {
        var val = state[n];
        if (val instanceof Array) val = val.concat([]);
        nstate[n] = val;
      }
      return nstate;
    }
    CodeMirror.copyState = copyState;
    function startState(mode, a1, a2) {
      return mode.startState ? mode.startState(a1, a2) : true;
    }
    CodeMirror.startState = startState;
    CodeMirror.innerMode = function(mode, state) {
      while (mode.innerMode) {
        var info = mode.innerMode(state);
        state = info.state;
        mode = info.mode;
      }
      return info || {mode: mode, state: state};
    };
  
    // The character stream used by a mode's parser.
    function StringStream(string, tabSize) {
      this.pos = this.start = 0;
      this.string = string;
      this.tabSize = tabSize || 8;
    }
    StringStream.prototype = {
      eol: function() {return this.pos >= this.string.length;},
      sol: function() {return this.pos == 0;},
      peek: function() {return this.string.charAt(this.pos) || undefined;},
      next: function() {
        if (this.pos < this.string.length)
          return this.string.charAt(this.pos++);
      },
      eat: function(match) {
        var ch = this.string.charAt(this.pos);
        if (typeof match == "string") var ok = ch == match;
        else var ok = ch && (match.test ? match.test(ch) : match(ch));
        if (ok) {++this.pos; return ch;}
      },
      eatWhile: function(match) {
        var start = this.pos;
        while (this.eat(match)){}
        return this.pos > start;
      },
      eatSpace: function() {
        var start = this.pos;
        while (/[\s\u00a0]/.test(this.string.charAt(this.pos))) ++this.pos;
        return this.pos > start;
      },
      skipToEnd: function() {this.pos = this.string.length;},
      skipTo: function(ch) {
        var found = this.string.indexOf(ch, this.pos);
        if (found > -1) {this.pos = found; return true;}
      },
      backUp: function(n) {this.pos -= n;},
      column: function() {return countColumn(this.string, this.start, this.tabSize);},
      indentation: function() {return countColumn(this.string, null, this.tabSize);},
      match: function(pattern, consume, caseInsensitive) {
        if (typeof pattern == "string") {
          var cased = function(str) {return caseInsensitive ? str.toLowerCase() : str;};
          if (cased(this.string).indexOf(cased(pattern), this.pos) == this.pos) {
            if (consume !== false) this.pos += pattern.length;
            return true;
          }
        } else {
          var match = this.string.slice(this.pos).match(pattern);
          if (match && match.index > 0) return null;
          if (match && consume !== false) this.pos += match[0].length;
          return match;
        }
      },
      current: function(){return this.string.slice(this.start, this.pos);}
    };
    CodeMirror.StringStream = StringStream;
  
    function MarkedSpan(from, to, marker) {
      this.from = from; this.to = to; this.marker = marker;
    }
  
    function getMarkedSpanFor(spans, marker) {
      if (spans) for (var i = 0; i < spans.length; ++i) {
        var span = spans[i];
        if (span.marker == marker) return span;
      }
    }
  
    function removeMarkedSpan(spans, span) {
      var r;
      for (var i = 0; i < spans.length; ++i)
        if (spans[i] != span) (r || (r = [])).push(spans[i]);
      return r;
    }
  
    function markedSpansBefore(old, startCh, endCh) {
      if (old) for (var i = 0, nw; i < old.length; ++i) {
        var span = old[i], marker = span.marker;
        var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= startCh : span.from < startCh);
        if (startsBefore || marker.type == "bookmark" && span.from == startCh && span.from != endCh) {
          var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= startCh : span.to > startCh);
          (nw || (nw = [])).push({from: span.from,
                                  to: endsAfter ? null : span.to,
                                  marker: marker});
        }
      }
      return nw;
    }
  
    function markedSpansAfter(old, endCh) {
      if (old) for (var i = 0, nw; i < old.length; ++i) {
        var span = old[i], marker = span.marker;
        var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= endCh : span.to > endCh);
        if (endsAfter || marker.type == "bookmark" && span.from == endCh) {
          var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= endCh : span.from < endCh);
          (nw || (nw = [])).push({from: startsBefore ? null : span.from - endCh,
                                  to: span.to == null ? null : span.to - endCh,
                                  marker: marker});
        }
      }
      return nw;
    }
  
    function updateMarkedSpans(oldFirst, oldLast, startCh, endCh, newText) {
      if (!oldFirst && !oldLast) return newText;
      // Get the spans that 'stick out' on both sides
      var first = markedSpansBefore(oldFirst, startCh);
      var last = markedSpansAfter(oldLast, endCh);
  
      // Next, merge those two ends
      var sameLine = newText.length == 1, offset = lst(newText).length + (sameLine ? startCh : 0);
      if (first) {
        // Fix up .to properties of first
        for (var i = 0; i < first.length; ++i) {
          var span = first[i];
          if (span.to == null) {
            var found = getMarkedSpanFor(last, span.marker);
            if (!found) span.to = startCh;
            else if (sameLine) span.to = found.to == null ? null : found.to + offset;
          }
        }
      }
      if (last) {
        // Fix up .from in last (or move them into first in case of sameLine)
        for (var i = 0; i < last.length; ++i) {
          var span = last[i];
          if (span.to != null) span.to += offset;
          if (span.from == null) {
            var found = getMarkedSpanFor(first, span.marker);
            if (!found) {
              span.from = offset;
              if (sameLine) (first || (first = [])).push(span);
            }
          } else {
            span.from += offset;
            if (sameLine) (first || (first = [])).push(span);
          }
        }
      }
  
      var newMarkers = [newHL(newText[0], first)];
      if (!sameLine) {
        // Fill gap with whole-line-spans
        var gap = newText.length - 2, gapMarkers;
        if (gap > 0 && first)
          for (var i = 0; i < first.length; ++i)
            if (first[i].to == null)
              (gapMarkers || (gapMarkers = [])).push({from: null, to: null, marker: first[i].marker});
        for (var i = 0; i < gap; ++i)
          newMarkers.push(newHL(newText[i+1], gapMarkers));
        newMarkers.push(newHL(lst(newText), last));
      }
      return newMarkers;
    }
  
    // hl stands for history-line, a data structure that can be either a
    // string (line without markers) or a {text, markedSpans} object.
    function hlText(val) { return typeof val == "string" ? val : val.text; }
    function hlSpans(val) {
      if (typeof val == "string") return null;
      var spans = val.markedSpans, out = null;
      for (var i = 0; i < spans.length; ++i) {
        if (spans[i].marker.explicitlyCleared) { if (!out) out = spans.slice(0, i); }
        else if (out) out.push(spans[i]);
      }
      return !out ? spans : out.length ? out : null;
    }
    function newHL(text, spans) { return spans ? {text: text, markedSpans: spans} : text; }
  
    function detachMarkedSpans(line) {
      var spans = line.markedSpans;
      if (!spans) return;
      for (var i = 0; i < spans.length; ++i) {
        var lines = spans[i].marker.lines;
        var ix = indexOf(lines, line);
        lines.splice(ix, 1);
      }
      line.markedSpans = null;
    }
  
    function attachMarkedSpans(line, spans) {
      if (!spans) return;
      for (var i = 0; i < spans.length; ++i)
        var marker = spans[i].marker.lines.push(line);
      line.markedSpans = spans;
    }
  
    // When measuring the position of the end of a line, different
    // browsers require different approaches. If an empty span is added,
    // many browsers report bogus offsets. Of those, some (Webkit,
    // recent IE) will accept a space without moving the whole span to
    // the next line when wrapping it, others work with a zero-width
    // space.
    var eolSpanContent = " ";
    if (gecko || (ie && !ie_lt8)) eolSpanContent = "\u200b";
    else if (opera) eolSpanContent = "";
  
    // Line objects. These hold state related to a line, including
    // highlighting info (the styles array).
    function Line(text, markedSpans) {
      this.text = text;
      this.height = 1;
      attachMarkedSpans(this, markedSpans);
    }
    Line.prototype = {
      update: function(text, markedSpans) {
        this.text = text;
        this.stateAfter = this.styles = null;
        detachMarkedSpans(this);
        attachMarkedSpans(this, markedSpans);
      },
      // Run the given mode's parser over a line, update the styles
      // array, which contains alternating fragments of text and CSS
      // classes.
      highlight: function(mode, state, tabSize) {
        var stream = new StringStream(this.text, tabSize), st = this.styles || (this.styles = []);
        var pos = st.length = 0;
        if (this.text == "" && mode.blankLine) mode.blankLine(state);
        while (!stream.eol()) {
          var style = mode.token(stream, state), substr = stream.current();
          stream.start = stream.pos;
          if (pos && st[pos-1] == style) {
            st[pos-2] += substr;
          } else if (substr) {
            st[pos++] = substr; st[pos++] = style;
          }
          // Give up when line is ridiculously long
          if (stream.pos > 5000) {
            st[pos++] = this.text.slice(stream.pos); st[pos++] = null;
            break;
          }
        }
      },
      process: function(mode, state, tabSize) {
        var stream = new StringStream(this.text, tabSize);
        if (this.text == "" && mode.blankLine) mode.blankLine(state);
        while (!stream.eol() && stream.pos <= 5000) {
          mode.token(stream, state);
          stream.start = stream.pos;
        }
      },
      // Fetch the parser token for a given character. Useful for hacks
      // that want to inspect the mode state (say, for completion).
      getTokenAt: function(mode, state, tabSize, ch) {
        var txt = this.text, stream = new StringStream(txt, tabSize);
        while (stream.pos < ch && !stream.eol()) {
          stream.start = stream.pos;
          var style = mode.token(stream, state);
        }
        return {start: stream.start,
                end: stream.pos,
                string: stream.current(),
                className: style || null,
                state: state};
      },
      indentation: function(tabSize) {return countColumn(this.text, null, tabSize);},
      // Produces an HTML fragment for the line, taking selection,
      // marking, and highlighting into account.
      getContent: function(tabSize, wrapAt, compensateForWrapping) {
        var first = true, col = 0, specials = /[\t\u0000-\u0019\u200b\u2028\u2029\uFEFF]/g;
        var pre = elt("pre");
        function span_(html, text, style) {
          if (!text) return;
          // Work around a bug where, in some compat modes, IE ignores leading spaces
          if (first && ie && text.charAt(0) == " ") text = "\u00a0" + text.slice(1);
          first = false;
          if (!specials.test(text)) {
            col += text.length;
            var content = document.createTextNode(text);
          } else {
            var content = document.createDocumentFragment(), pos = 0;
            while (true) {
              specials.lastIndex = pos;
              var m = specials.exec(text);
              var skipped = m ? m.index - pos : text.length - pos;
              if (skipped) {
                content.appendChild(document.createTextNode(text.slice(pos, pos + skipped)));
                col += skipped;
              }
              if (!m) break;
              pos += skipped + 1;
              if (m[0] == "\t") {
                var tabWidth = tabSize - col % tabSize;
                content.appendChild(elt("span", spaceStr(tabWidth), "cm-tab"));
                col += tabWidth;
              } else {
                var token = elt("span", "\u2022", "cm-invalidchar");
                token.title = "\\u" + m[0].charCodeAt(0).toString(16);
                content.appendChild(token);
                col += 1;
              }
            }
          }
          if (style) html.appendChild(elt("span", [content], style));
          else html.appendChild(content);
        }
        var span = span_;
        if (wrapAt != null) {
          var outPos = 0, anchor = pre.anchor = elt("span");
          span = function(html, text, style) {
            var l = text.length;
            if (wrapAt >= outPos && wrapAt < outPos + l) {
              var cut = wrapAt - outPos;
              if (cut) {
                span_(html, text.slice(0, cut), style);
                // See comment at the definition of spanAffectsWrapping
                if (compensateForWrapping) {
                  var view = text.slice(cut - 1, cut + 1);
                  if (spanAffectsWrapping.test(view)) html.appendChild(elt("wbr"));
                  else if (!ie_lt8 && /\w\w/.test(view)) html.appendChild(document.createTextNode("\u200d"));
                }
              }
              html.appendChild(anchor);
              span_(anchor, opera ? text.slice(cut, cut + 1) : text.slice(cut), style);
              if (opera) span_(html, text.slice(cut + 1), style);
              wrapAt--;
              outPos += l;
            } else {
              outPos += l;
              span_(html, text, style);
              if (outPos == wrapAt && outPos == len) {
                setTextContent(anchor, eolSpanContent);
                html.appendChild(anchor);
              }
              // Stop outputting HTML when gone sufficiently far beyond measure
              else if (outPos > wrapAt + 10 && /\s/.test(text)) span = function(){};
            }
          };
        }
  
        var st = this.styles, allText = this.text, marked = this.markedSpans;
        var len = allText.length;
        function styleToClass(style) {
          if (!style) return null;
          return "cm-" + style.replace(/ +/g, " cm-");
        }
        if (!allText && wrapAt == null) {
          span(pre, " ");
        } else if (!marked || !marked.length) {
          for (var i = 0, ch = 0; ch < len; i+=2) {
            var str = st[i], style = st[i+1], l = str.length;
            if (ch + l > len) str = str.slice(0, len - ch);
            ch += l;
            span(pre, str, styleToClass(style));
          }
        } else {
          marked.sort(function(a, b) { return a.from - b.from; });
          var pos = 0, i = 0, text = "", style, sg = 0;
          var nextChange = marked[0].from || 0, marks = [], markpos = 0;
          var advanceMarks = function() {
            var m;
            while (markpos < marked.length &&
                   ((m = marked[markpos]).from == pos || m.from == null)) {
              if (m.marker.type == "range") marks.push(m);
              ++markpos;
            }
            nextChange = markpos < marked.length ? marked[markpos].from : Infinity;
            for (var i = 0; i < marks.length; ++i) {
              var to = marks[i].to;
              if (to == null) to = Infinity;
              if (to == pos) marks.splice(i--, 1);
              else nextChange = Math.min(to, nextChange);
            }
          };
          var m = 0;
          while (pos < len) {
            if (nextChange == pos) advanceMarks();
            var upto = Math.min(len, nextChange);
            while (true) {
              if (text) {
                var end = pos + text.length;
                var appliedStyle = style;
                for (var j = 0; j < marks.length; ++j) {
                  var mark = marks[j];
                  appliedStyle = (appliedStyle ? appliedStyle + " " : "") + mark.marker.style;
                  if (mark.marker.endStyle && mark.to === Math.min(end, upto)) appliedStyle += " " + mark.marker.endStyle;
                  if (mark.marker.startStyle && mark.from === pos) appliedStyle += " " + mark.marker.startStyle;
                }
                span(pre, end > upto ? text.slice(0, upto - pos) : text, appliedStyle);
                if (end >= upto) {text = text.slice(upto - pos); pos = upto; break;}
                pos = end;
              }
              text = st[i++]; style = styleToClass(st[i++]);
            }
          }
        }
        return pre;
      },
      cleanUp: function() {
        this.parent = null;
        detachMarkedSpans(this);
      }
    };
  
    // Data structure that holds the sequence of lines.
    function LeafChunk(lines) {
      this.lines = lines;
      this.parent = null;
      for (var i = 0, e = lines.length, height = 0; i < e; ++i) {
        lines[i].parent = this;
        height += lines[i].height;
      }
      this.height = height;
    }
    LeafChunk.prototype = {
      chunkSize: function() { return this.lines.length; },
      remove: function(at, n, callbacks) {
        for (var i = at, e = at + n; i < e; ++i) {
          var line = this.lines[i];
          this.height -= line.height;
          line.cleanUp();
          if (line.handlers)
            for (var j = 0; j < line.handlers.length; ++j) callbacks.push(line.handlers[j]);
        }
        this.lines.splice(at, n);
      },
      collapse: function(lines) {
        lines.splice.apply(lines, [lines.length, 0].concat(this.lines));
      },
      insertHeight: function(at, lines, height) {
        this.height += height;
        this.lines = this.lines.slice(0, at).concat(lines).concat(this.lines.slice(at));
        for (var i = 0, e = lines.length; i < e; ++i) lines[i].parent = this;
      },
      iterN: function(at, n, op) {
        for (var e = at + n; at < e; ++at)
          if (op(this.lines[at])) return true;
      }
    };
    function BranchChunk(children) {
      this.children = children;
      var size = 0, height = 0;
      for (var i = 0, e = children.length; i < e; ++i) {
        var ch = children[i];
        size += ch.chunkSize(); height += ch.height;
        ch.parent = this;
      }
      this.size = size;
      this.height = height;
      this.parent = null;
    }
    BranchChunk.prototype = {
      chunkSize: function() { return this.size; },
      remove: function(at, n, callbacks) {
        this.size -= n;
        for (var i = 0; i < this.children.length; ++i) {
          var child = this.children[i], sz = child.chunkSize();
          if (at < sz) {
            var rm = Math.min(n, sz - at), oldHeight = child.height;
            child.remove(at, rm, callbacks);
            this.height -= oldHeight - child.height;
            if (sz == rm) { this.children.splice(i--, 1); child.parent = null; }
            if ((n -= rm) == 0) break;
            at = 0;
          } else at -= sz;
        }
        if (this.size - n < 25) {
          var lines = [];
          this.collapse(lines);
          this.children = [new LeafChunk(lines)];
          this.children[0].parent = this;
        }
      },
      collapse: function(lines) {
        for (var i = 0, e = this.children.length; i < e; ++i) this.children[i].collapse(lines);
      },
      insert: function(at, lines) {
        var height = 0;
        for (var i = 0, e = lines.length; i < e; ++i) height += lines[i].height;
        this.insertHeight(at, lines, height);
      },
      insertHeight: function(at, lines, height) {
        this.size += lines.length;
        this.height += height;
        for (var i = 0, e = this.children.length; i < e; ++i) {
          var child = this.children[i], sz = child.chunkSize();
          if (at <= sz) {
            child.insertHeight(at, lines, height);
            if (child.lines && child.lines.length > 50) {
              while (child.lines.length > 50) {
                var spilled = child.lines.splice(child.lines.length - 25, 25);
                var newleaf = new LeafChunk(spilled);
                child.height -= newleaf.height;
                this.children.splice(i + 1, 0, newleaf);
                newleaf.parent = this;
              }
              this.maybeSpill();
            }
            break;
          }
          at -= sz;
        }
      },
      maybeSpill: function() {
        if (this.children.length <= 10) return;
        var me = this;
        do {
          var spilled = me.children.splice(me.children.length - 5, 5);
          var sibling = new BranchChunk(spilled);
          if (!me.parent) { // Become the parent node
            var copy = new BranchChunk(me.children);
            copy.parent = me;
            me.children = [copy, sibling];
            me = copy;
          } else {
            me.size -= sibling.size;
            me.height -= sibling.height;
            var myIndex = indexOf(me.parent.children, me);
            me.parent.children.splice(myIndex + 1, 0, sibling);
          }
          sibling.parent = me.parent;
        } while (me.children.length > 10);
        me.parent.maybeSpill();
      },
      iter: function(from, to, op) { this.iterN(from, to - from, op); },
      iterN: function(at, n, op) {
        for (var i = 0, e = this.children.length; i < e; ++i) {
          var child = this.children[i], sz = child.chunkSize();
          if (at < sz) {
            var used = Math.min(n, sz - at);
            if (child.iterN(at, used, op)) return true;
            if ((n -= used) == 0) break;
            at = 0;
          } else at -= sz;
        }
      }
    };
  
    function getLineAt(chunk, n) {
      while (!chunk.lines) {
        for (var i = 0;; ++i) {
          var child = chunk.children[i], sz = child.chunkSize();
          if (n < sz) { chunk = child; break; }
          n -= sz;
        }
      }
      return chunk.lines[n];
    }
    function lineNo(line) {
      if (line.parent == null) return null;
      var cur = line.parent, no = indexOf(cur.lines, line);
      for (var chunk = cur.parent; chunk; cur = chunk, chunk = chunk.parent) {
        for (var i = 0; ; ++i) {
          if (chunk.children[i] == cur) break;
          no += chunk.children[i].chunkSize();
        }
      }
      return no;
    }
    function lineAtHeight(chunk, h) {
      var n = 0;
      outer: do {
        for (var i = 0, e = chunk.children.length; i < e; ++i) {
          var child = chunk.children[i], ch = child.height;
          if (h < ch) { chunk = child; continue outer; }
          h -= ch;
          n += child.chunkSize();
        }
        return n;
      } while (!chunk.lines);
      for (var i = 0, e = chunk.lines.length; i < e; ++i) {
        var line = chunk.lines[i], lh = line.height;
        if (h < lh) break;
        h -= lh;
      }
      return n + i;
    }
    function heightAtLine(chunk, n) {
      var h = 0;
      outer: do {
        for (var i = 0, e = chunk.children.length; i < e; ++i) {
          var child = chunk.children[i], sz = child.chunkSize();
          if (n < sz) { chunk = child; continue outer; }
          n -= sz;
          h += child.height;
        }
        return h;
      } while (!chunk.lines);
      for (var i = 0; i < n; ++i) h += chunk.lines[i].height;
      return h;
    }
  
    // The history object 'chunks' changes that are made close together
    // and at almost the same time into bigger undoable units.
    function History() {
      this.time = 0;
      this.done = []; this.undone = [];
      this.compound = 0;
      this.closed = false;
    }
    History.prototype = {
      addChange: function(start, added, old) {
        this.undone.length = 0;
        var time = +new Date, cur = lst(this.done), last = cur && lst(cur);
        var dtime = time - this.time;
  
        if (cur && !this.closed && this.compound) {
          cur.push({start: start, added: added, old: old});
        } else if (dtime > 400 || !last || this.closed ||
                   last.start > start + old.length || last.start + last.added < start) {
          this.done.push([{start: start, added: added, old: old}]);
          this.closed = false;
        } else {
          var startBefore = Math.max(0, last.start - start),
              endAfter = Math.max(0, (start + old.length) - (last.start + last.added));
          for (var i = startBefore; i > 0; --i) last.old.unshift(old[i - 1]);
          for (var i = endAfter; i > 0; --i) last.old.push(old[old.length - i]);
          if (startBefore) last.start = start;
          last.added += added - (old.length - startBefore - endAfter);
        }
        this.time = time;
      },
      startCompound: function() {
        if (!this.compound++) this.closed = true;
      },
      endCompound: function() {
        if (!--this.compound) this.closed = true;
      }
    };
  
    function stopMethod() {e_stop(this);}
    // Ensure an event has a stop method.
    function addStop(event) {
      if (!event.stop) event.stop = stopMethod;
      return event;
    }
  
    function e_preventDefault(e) {
      if (e.preventDefault) e.preventDefault();
      else e.returnValue = false;
    }
    function e_stopPropagation(e) {
      if (e.stopPropagation) e.stopPropagation();
      else e.cancelBubble = true;
    }
    function e_stop(e) {e_preventDefault(e); e_stopPropagation(e);}
    CodeMirror.e_stop = e_stop;
    CodeMirror.e_preventDefault = e_preventDefault;
    CodeMirror.e_stopPropagation = e_stopPropagation;
  
    function e_target(e) {return e.target || e.srcElement;}
    function e_button(e) {
      var b = e.which;
      if (b == null) {
        if (e.button & 1) b = 1;
        else if (e.button & 2) b = 3;
        else if (e.button & 4) b = 2;
      }
      if (mac && e.ctrlKey && b == 1) b = 3;
      return b;
    }
  
    // Allow 3rd-party code to override event properties by adding an override
    // object to an event object.
    function e_prop(e, prop) {
      var overridden = e.override && e.override.hasOwnProperty(prop);
      return overridden ? e.override[prop] : e[prop];
    }
  
    // Event handler registration. If disconnect is true, it'll return a
    // function that unregisters the handler.
    function connect(node, type, handler, disconnect) {
      if (typeof node.addEventListener == "function") {
        node.addEventListener(type, handler, false);
        if (disconnect) return function() {node.removeEventListener(type, handler, false);};
      } else {
        var wrapHandler = function(event) {handler(event || window.event);};
        node.attachEvent("on" + type, wrapHandler);
        if (disconnect) return function() {node.detachEvent("on" + type, wrapHandler);};
      }
    }
    CodeMirror.connect = connect;
  
    function Delayed() {this.id = null;}
    Delayed.prototype = {set: function(ms, f) {clearTimeout(this.id); this.id = setTimeout(f, ms);}};
  
    var Pass = CodeMirror.Pass = {toString: function(){return "CodeMirror.Pass";}};
  
    // Detect drag-and-drop
    var dragAndDrop = function() {
      // There is *some* kind of drag-and-drop support in IE6-8, but I
      // couldn't get it to work yet.
      if (ie_lt9) return false;
      var div = elt('div');
      return "draggable" in div || "dragDrop" in div;
    }();
  
    // Feature-detect whether newlines in textareas are converted to \r\n
    var lineSep = function () {
      var te = elt("textarea");
      te.value = "foo\nbar";
      if (te.value.indexOf("\r") > -1) return "\r\n";
      return "\n";
    }();
  
    // For a reason I have yet to figure out, some browsers disallow
    // word wrapping between certain characters *only* if a new inline
    // element is started between them. This makes it hard to reliably
    // measure the position of things, since that requires inserting an
    // extra span. This terribly fragile set of regexps matches the
    // character combinations that suffer from this phenomenon on the
    // various browsers.
    var spanAffectsWrapping = /^$/; // Won't match any two-character string
    if (gecko) spanAffectsWrapping = /$'/;
    else if (safari) spanAffectsWrapping = /\-[^ \-?]|\?[^ !'\"\),.\-\/:;\?\]\}]/;
    else if (chrome) spanAffectsWrapping = /\-[^ \-\.?]|\?[^ \-\.?\]\}:;!'\"\),\/]|[\.!\"#&%\)*+,:;=>\]|\}~][\(\{\[<]|\$'/;
  
    // Counts the column offset in a string, taking tabs into account.
    // Used mostly to find indentation.
    function countColumn(string, end, tabSize) {
      if (end == null) {
        end = string.search(/[^\s\u00a0]/);
        if (end == -1) end = string.length;
      }
      for (var i = 0, n = 0; i < end; ++i) {
        if (string.charAt(i) == "\t") n += tabSize - (n % tabSize);
        else ++n;
      }
      return n;
    }
  
    function eltOffset(node, screen) {
      // Take the parts of bounding client rect that we are interested in so we are able to edit if need be,
      // since the returned value cannot be changed externally (they are kept in sync as the element moves within the page)
      try { var box = node.getBoundingClientRect(); box = { top: box.top, left: box.left }; }
      catch(e) { box = {top: 0, left: 0}; }
      if (!screen) {
        // Get the toplevel scroll, working around browser differences.
        if (window.pageYOffset == null) {
          var t = document.documentElement || document.body.parentNode;
          if (t.scrollTop == null) t = document.body;
          box.top += t.scrollTop; box.left += t.scrollLeft;
        } else {
          box.top += window.pageYOffset; box.left += window.pageXOffset;
        }
      }
      return box;
    }
  
    function eltText(node) {
      return node.textContent || node.innerText || node.nodeValue || "";
    }
  
    var spaceStrs = [""];
    function spaceStr(n) {
      while (spaceStrs.length <= n)
        spaceStrs.push(lst(spaceStrs) + " ");
      return spaceStrs[n];
    }
  
    function lst(arr) { return arr[arr.length-1]; }
  
    function selectInput(node) {
      if (ios) { // Mobile Safari apparently has a bug where select() is broken.
        node.selectionStart = 0;
        node.selectionEnd = node.value.length;
      } else node.select();
    }
  
    // Operations on {line, ch} objects.
    function posEq(a, b) {return a.line == b.line && a.ch == b.ch;}
    function posLess(a, b) {return a.line < b.line || (a.line == b.line && a.ch < b.ch);}
    function copyPos(x) {return {line: x.line, ch: x.ch};}
  
    function elt(tag, content, className, style) {
      var e = document.createElement(tag);
      if (className) e.className = className;
      if (style) e.style.cssText = style;
      if (typeof content == "string") setTextContent(e, content);
      else if (content) for (var i = 0; i < content.length; ++i) e.appendChild(content[i]);
      return e;
    }
    function removeChildren(e) {
      e.innerHTML = "";
      return e;
    }
    function removeChildrenAndAdd(parent, e) {
      removeChildren(parent).appendChild(e);
    }
    function setTextContent(e, str) {
      if (ie_lt9) {
        e.innerHTML = "";
        e.appendChild(document.createTextNode(str));
      } else e.textContent = str;
    }
  
    // Used to position the cursor after an undo/redo by finding the
    // last edited character.
    function editEnd(from, to) {
      if (!to) return 0;
      if (!from) return to.length;
      for (var i = from.length, j = to.length; i >= 0 && j >= 0; --i, --j)
        if (from.charAt(i) != to.charAt(j)) break;
      return j + 1;
    }
  
    function indexOf(collection, elt) {
      if (collection.indexOf) return collection.indexOf(elt);
      for (var i = 0, e = collection.length; i < e; ++i)
        if (collection[i] == elt) return i;
      return -1;
    }
    var nonASCIISingleCaseWordChar = /[\u3040-\u309f\u30a0-\u30ff\u3400-\u4db5\u4e00-\u9fcc]/;
    function isWordChar(ch) {
      return /\w/.test(ch) || ch > "\x80" &&
        (ch.toUpperCase() != ch.toLowerCase() || nonASCIISingleCaseWordChar.test(ch));
    }
  
    // See if "".split is the broken IE version, if so, provide an
    // alternative way to split lines.
    var splitLines = "\n\nb".split(/\n/).length != 3 ? function(string) {
      var pos = 0, result = [], l = string.length;
      while (pos <= l) {
        var nl = string.indexOf("\n", pos);
        if (nl == -1) nl = string.length;
        var line = string.slice(pos, string.charAt(nl - 1) == "\r" ? nl - 1 : nl);
        var rt = line.indexOf("\r");
        if (rt != -1) {
          result.push(line.slice(0, rt));
          pos += rt + 1;
        } else {
          result.push(line);
          pos = nl + 1;
        }
      }
      return result;
    } : function(string){return string.split(/\r\n?|\n/);};
    CodeMirror.splitLines = splitLines;
  
    var hasSelection = window.getSelection ? function(te) {
      try { return te.selectionStart != te.selectionEnd; }
      catch(e) { return false; }
    } : function(te) {
      try {var range = te.ownerDocument.selection.createRange();}
      catch(e) {}
      if (!range || range.parentElement() != te) return false;
      return range.compareEndPoints("StartToEnd", range) != 0;
    };
  
    CodeMirror.defineMode("null", function() {
      return {token: function(stream) {stream.skipToEnd();}};
    });
    CodeMirror.defineMIME("text/plain", "null");
  
    var keyNames = {3: "Enter", 8: "Backspace", 9: "Tab", 13: "Enter", 16: "Shift", 17: "Ctrl", 18: "Alt",
                    19: "Pause", 20: "CapsLock", 27: "Esc", 32: "Space", 33: "PageUp", 34: "PageDown", 35: "End",
                    36: "Home", 37: "Left", 38: "Up", 39: "Right", 40: "Down", 44: "PrintScrn", 45: "Insert",
                    46: "Delete", 59: ";", 91: "Mod", 92: "Mod", 93: "Mod", 109: "-", 107: "=", 127: "Delete",
                    186: ";", 187: "=", 188: ",", 189: "-", 190: ".", 191: "/", 192: "`", 219: "[", 220: "\\",
                    221: "]", 222: "'", 63276: "PageUp", 63277: "PageDown", 63275: "End", 63273: "Home",
                    63234: "Left", 63232: "Up", 63235: "Right", 63233: "Down", 63302: "Insert", 63272: "Delete"};
    CodeMirror.keyNames = keyNames;
    (function() {
      // Number keys
      for (var i = 0; i < 10; i++) keyNames[i + 48] = String(i);
      // Alphabetic keys
      for (var i = 65; i <= 90; i++) keyNames[i] = String.fromCharCode(i);
      // Function keys
      for (var i = 1; i <= 12; i++) keyNames[i + 111] = keyNames[i + 63235] = "F" + i;
    })();
  
    CodeMirror.version = "2.36 +";
  
    return CodeMirror;
  })();

  // End vendor/codemirror.js

  // Begin vendor/codemirror-javascript-mode.js

  // TODO actually recognize syntax of TypeScript constructs
  
  CodeMirror.defineMode("javascript", function(config, parserConfig) {
    var indentUnit = config.indentUnit;
    var jsonMode = parserConfig.json;
    var isTS = parserConfig.typescript;
  
    // Tokenizer
  
    var keywords = function(){
      function kw(type) {return {type: type, style: "keyword"};}
      var A = kw("keyword a"), B = kw("keyword b"), C = kw("keyword c");
      var operator = kw("operator"), atom = {type: "atom", style: "atom"};
  
      var jsKeywords = {
        "if": A, "while": A, "with": A, "else": B, "do": B, "try": B, "finally": B,
        "return": C, "break": C, "continue": C, "new": C, "delete": C, "throw": C,
        "var": kw("var"), "const": kw("var"), "let": kw("var"),
        "function": kw("function"), "catch": kw("catch"),
        "for": kw("for"), "switch": kw("switch"), "case": kw("case"), "default": kw("default"),
        "in": operator, "typeof": operator, "instanceof": operator,
        "true": atom, "false": atom, "null": atom, "undefined": atom, "NaN": atom, "Infinity": atom
      };
  
      // Extend the 'normal' keywords with the TypeScript language extensions
      if (isTS) {
        var type = {type: "variable", style: "variable-3"};
        var tsKeywords = {
          // object-like things
          "interface": kw("interface"),
          "class": kw("class"),
          "extends": kw("extends"),
          "constructor": kw("constructor"),
  
          // scope modifiers
          "public": kw("public"),
          "private": kw("private"),
          "protected": kw("protected"),
          "static": kw("static"),
  
          "super": kw("super"),
  
          // types
          "string": type, "number": type, "bool": type, "any": type
        };
  
        for (var attr in tsKeywords) {
          jsKeywords[attr] = tsKeywords[attr];
        }
      }
  
      return jsKeywords;
    }();
  
    var isOperatorChar = /[+\-*&%=<>!?|]/;
  
    function chain(stream, state, f) {
      state.tokenize = f;
      return f(stream, state);
    }
  
    function nextUntilUnescaped(stream, end) {
      var escaped = false, next;
      while ((next = stream.next()) != null) {
        if (next == end && !escaped)
          return false;
        escaped = !escaped && next == "\\";
      }
      return escaped;
    }
  
    // Used as scratch variables to communicate multiple values without
    // consing up tons of objects.
    var type, content;
    function ret(tp, style, cont) {
      type = tp; content = cont;
      return style;
    }
  
    function jsTokenBase(stream, state) {
      var ch = stream.next();
      if (ch == '"' || ch == "'")
        return chain(stream, state, jsTokenString(ch));
      else if (/[\[\]{}\(\),;\:\.]/.test(ch))
        return ret(ch);
      else if (ch == "0" && stream.eat(/x/i)) {
        stream.eatWhile(/[\da-f]/i);
        return ret("number", "number");
      }
      else if (/\d/.test(ch) || ch == "-" && stream.eat(/\d/)) {
        stream.match(/^\d*(?:\.\d*)?(?:[eE][+\-]?\d+)?/);
        return ret("number", "number");
      }
      else if (ch == "/") {
        if (stream.eat("*")) {
          return chain(stream, state, jsTokenComment);
        }
        else if (stream.eat("/")) {
          stream.skipToEnd();
          return ret("comment", "comment");
        }
        else if (state.lastType == "operator" || state.lastType == "keyword c" ||
                 /^[\[{}\(,;:]$/.test(state.lastType)) {
          nextUntilUnescaped(stream, "/");
          stream.eatWhile(/[gimy]/); // 'y' is "sticky" option in Mozilla
          return ret("regexp", "string-2");
        }
        else {
          stream.eatWhile(isOperatorChar);
          return ret("operator", null, stream.current());
        }
      }
      else if (ch == "#") {
          stream.skipToEnd();
          return ret("error", "error");
      }
      else if (isOperatorChar.test(ch)) {
        stream.eatWhile(isOperatorChar);
        return ret("operator", null, stream.current());
      }
      else {
        stream.eatWhile(/[\w\$_]/);
        var word = stream.current(), known = keywords.propertyIsEnumerable(word) && keywords[word];
        return (known && state.lastType != ".") ? ret(known.type, known.style, word) :
                       ret("variable", "variable", word);
      }
    }
  
    function jsTokenString(quote) {
      return function(stream, state) {
        if (!nextUntilUnescaped(stream, quote))
          state.tokenize = jsTokenBase;
        return ret("string", "string");
      };
    }
  
    function jsTokenComment(stream, state) {
      var maybeEnd = false, ch;
      while (ch = stream.next()) {
        if (ch == "/" && maybeEnd) {
          state.tokenize = jsTokenBase;
          break;
        }
        maybeEnd = (ch == "*");
      }
      return ret("comment", "comment");
    }
  
    // Parser
  
    var atomicTypes = {"atom": true, "number": true, "variable": true, "string": true, "regexp": true};
  
    function JSLexical(indented, column, type, align, prev, info) {
      this.indented = indented;
      this.column = column;
      this.type = type;
      this.prev = prev;
      this.info = info;
      if (align != null) this.align = align;
    }
  
    function inScope(state, varname) {
      for (var v = state.localVars; v; v = v.next)
        if (v.name == varname) return true;
    }
  
    function parseJS(state, style, type, content, stream) {
      var cc = state.cc;
      // Communicate our context to the combinators.
      // (Less wasteful than consing up a hundred closures on every call.)
      cx.state = state; cx.stream = stream; cx.marked = null, cx.cc = cc;
  
      if (!state.lexical.hasOwnProperty("align"))
        state.lexical.align = true;
  
      while(true) {
        var combinator = cc.length ? cc.pop() : jsonMode ? expression : statement;
        if (combinator(type, content)) {
          while(cc.length && cc[cc.length - 1].lex)
            cc.pop()();
          if (cx.marked) return cx.marked;
          if (type == "variable" && inScope(state, content)) return "variable-2";
          return style;
        }
      }
    }
  
    // Combinator utils
  
    var cx = {state: null, column: null, marked: null, cc: null};
    function pass() {
      for (var i = arguments.length - 1; i >= 0; i--) cx.cc.push(arguments[i]);
    }
    function cont() {
      pass.apply(null, arguments);
      return true;
    }
    function register(varname) {
      var state = cx.state;
      if (state.context) {
        cx.marked = "def";
        for (var v = state.localVars; v; v = v.next)
          if (v.name == varname) return;
        state.localVars = {name: varname, next: state.localVars};
      }
    }
  
    // Combinators
  
    var defaultVars = {name: "this", next: {name: "arguments"}};
    function pushcontext() {
      cx.state.context = {prev: cx.state.context, vars: cx.state.localVars};
      cx.state.localVars = defaultVars;
    }
    function popcontext() {
      cx.state.localVars = cx.state.context.vars;
      cx.state.context = cx.state.context.prev;
    }
    function pushlex(type, info) {
      var result = function() {
        var state = cx.state;
        state.lexical = new JSLexical(state.indented, cx.stream.column(), type, null, state.lexical, info);
      };
      result.lex = true;
      return result;
    }
    function poplex() {
      var state = cx.state;
      if (state.lexical.prev) {
        if (state.lexical.type == ")")
          state.indented = state.lexical.indented;
        state.lexical = state.lexical.prev;
      }
    }
    poplex.lex = true;
  
    function expect(wanted) {
      return function expecting(type) {
        if (type == wanted) return cont();
        else if (wanted == ";") return pass();
        else return cont(arguments.callee);
      };
    }
  
    function statement(type) {
      if (type == "var") return cont(pushlex("vardef"), vardef1, expect(";"), poplex);
      if (type == "keyword a") return cont(pushlex("form"), expression, statement, poplex);
      if (type == "keyword b") return cont(pushlex("form"), statement, poplex);
      if (type == "{") return cont(pushlex("}"), block, poplex);
      if (type == ";") return cont();
      if (type == "function") return cont(functiondef);
      if (type == "for") return cont(pushlex("form"), expect("("), pushlex(")"), forspec1, expect(")"),
                                        poplex, statement, poplex);
      if (type == "variable") return cont(pushlex("stat"), maybelabel);
      if (type == "switch") return cont(pushlex("form"), expression, pushlex("}", "switch"), expect("{"),
                                           block, poplex, poplex);
      if (type == "case") return cont(expression, expect(":"));
      if (type == "default") return cont(expect(":"));
      if (type == "catch") return cont(pushlex("form"), pushcontext, expect("("), funarg, expect(")"),
                                          statement, poplex, popcontext);
      return pass(pushlex("stat"), expression, expect(";"), poplex);
    }
    function expression(type) {
      if (atomicTypes.hasOwnProperty(type)) return cont(maybeoperator);
      if (type == "function") return cont(functiondef);
      if (type == "keyword c") return cont(maybeexpression);
      if (type == "(") return cont(pushlex(")"), maybeexpression, expect(")"), poplex, maybeoperator);
      if (type == "operator") return cont(expression);
      if (type == "[") return cont(pushlex("]"), commasep(expression, "]"), poplex, maybeoperator);
      if (type == "{") return cont(pushlex("}"), commasep(objprop, "}"), poplex, maybeoperator);
      return cont();
    }
    function maybeexpression(type) {
      if (type.match(/[;\}\)\],]/)) return pass();
      return pass(expression);
    }
  
    function maybeoperator(type, value) {
      if (type == "operator" && /\+\+|--/.test(value)) return cont(maybeoperator);
      if (type == "operator" && value == "?") return cont(expression, expect(":"), expression);
      if (type == ";") return;
      if (type == "(") return cont(pushlex(")"), commasep(expression, ")"), poplex, maybeoperator);
      if (type == ".") return cont(property, maybeoperator);
      if (type == "[") return cont(pushlex("]"), expression, expect("]"), poplex, maybeoperator);
    }
    function maybelabel(type) {
      if (type == ":") return cont(poplex, statement);
      return pass(maybeoperator, expect(";"), poplex);
    }
    function property(type) {
      if (type == "variable") {cx.marked = "property"; return cont();}
    }
    function objprop(type) {
      if (type == "variable") cx.marked = "property";
      if (atomicTypes.hasOwnProperty(type)) return cont(expect(":"), expression);
    }
    function commasep(what, end) {
      function proceed(type) {
        if (type == ",") return cont(what, proceed);
        if (type == end) return cont();
        return cont(expect(end));
      }
      return function commaSeparated(type) {
        if (type == end) return cont();
        else return pass(what, proceed);
      };
    }
    function block(type) {
      if (type == "}") return cont();
      return pass(statement, block);
    }
    function maybetype(type) {
      if (type == ":") return cont(typedef);
      return pass();
    }
    function typedef(type) {
      if (type == "variable"){cx.marked = "variable-3"; return cont();}
      return pass();
    }
    function vardef1(type, value) {
      if (type == "variable") {
        register(value);
        return isTS ? cont(maybetype, vardef2) : cont(vardef2);
      }
      return pass();
    }
    function vardef2(type, value) {
      if (value == "=") return cont(expression, vardef2);
      if (type == ",") return cont(vardef1);
    }
    function forspec1(type) {
      if (type == "var") return cont(vardef1, expect(";"), forspec2);
      if (type == ";") return cont(forspec2);
      if (type == "variable") return cont(formaybein);
      return cont(forspec2);
    }
    function formaybein(type, value) {
      if (value == "in") return cont(expression);
      return cont(maybeoperator, forspec2);
    }
    function forspec2(type, value) {
      if (type == ";") return cont(forspec3);
      if (value == "in") return cont(expression);
      return cont(expression, expect(";"), forspec3);
    }
    function forspec3(type) {
      if (type != ")") cont(expression);
    }
    function functiondef(type, value) {
      if (type == "variable") {register(value); return cont(functiondef);}
      if (type == "(") return cont(pushlex(")"), pushcontext, commasep(funarg, ")"), poplex, statement, popcontext);
    }
    function funarg(type, value) {
      if (type == "variable") {register(value); return isTS ? cont(maybetype) : cont();}
    }
  
    // Interface
  
    return {
      startState: function(basecolumn) {
        return {
          tokenize: jsTokenBase,
          lastType: null,
          cc: [],
          lexical: new JSLexical((basecolumn || 0) - indentUnit, 0, "block", false),
          localVars: parserConfig.localVars,
          context: parserConfig.localVars && {vars: parserConfig.localVars},
          indented: 0
        };
      },
  
      token: function(stream, state) {
        if (stream.sol()) {
          if (!state.lexical.hasOwnProperty("align"))
            state.lexical.align = false;
          state.indented = stream.indentation();
        }
        if (stream.eatSpace()) return null;
        var style = state.tokenize(stream, state);
        if (type == "comment") return style;
        state.lastType = type;
        return parseJS(state, style, type, content, stream);
      },
  
      indent: function(state, textAfter) {
        if (state.tokenize == jsTokenComment) return CodeMirror.Pass;
        if (state.tokenize != jsTokenBase) return 0;
        var firstChar = textAfter && textAfter.charAt(0), lexical = state.lexical;
        if (lexical.type == "stat" && firstChar == "}") lexical = lexical.prev;
        var type = lexical.type, closing = firstChar == type;
        if (type == "vardef") return lexical.indented + (state.lastType == "operator" || state.lastType == "," ? 4 : 0);
        else if (type == "form" && firstChar == "{") return lexical.indented;
        else if (type == "form") return lexical.indented + indentUnit;
        else if (type == "stat")
          return lexical.indented + (state.lastType == "operator" || state.lastType == "," ? indentUnit : 0);
        else if (lexical.info == "switch" && !closing)
          return lexical.indented + (/^(?:case|default)\b/.test(textAfter) ? indentUnit : 2 * indentUnit);
        else if (lexical.align) return lexical.column + (closing ? 0 : 1);
        else return lexical.indented + (closing ? 0 : indentUnit);
      },
  
      electricChars: ":{}",
  
      jsonMode: jsonMode
    };
  });
  
  CodeMirror.defineMIME("text/javascript", "javascript");
  CodeMirror.defineMIME("application/json", {name: "javascript", json: true});
  CodeMirror.defineMIME("text/typescript", { name: "javascript", typescript: true });
  CodeMirror.defineMIME("application/typescript", { name: "javascript", typescript: true });

  // End vendor/codemirror-javascript-mode.js

  // Begin vendor/codemirror-xml-mode.js

  CodeMirror.defineMode("xml", function(config, parserConfig) {
    var indentUnit = config.indentUnit;
    var Kludges = parserConfig.htmlMode ? {
      autoSelfClosers: {'area': true, 'base': true, 'br': true, 'col': true, 'command': true,
                        'embed': true, 'frame': true, 'hr': true, 'img': true, 'input': true,
                        'keygen': true, 'link': true, 'meta': true, 'param': true, 'source': true,
                        'track': true, 'wbr': true},
      implicitlyClosed: {'dd': true, 'li': true, 'optgroup': true, 'option': true, 'p': true,
                         'rp': true, 'rt': true, 'tbody': true, 'td': true, 'tfoot': true,
                         'th': true, 'tr': true},
      contextGrabbers: {
        'dd': {'dd': true, 'dt': true},
        'dt': {'dd': true, 'dt': true},
        'li': {'li': true},
        'option': {'option': true, 'optgroup': true},
        'optgroup': {'optgroup': true},
        'p': {'address': true, 'article': true, 'aside': true, 'blockquote': true, 'dir': true,
              'div': true, 'dl': true, 'fieldset': true, 'footer': true, 'form': true,
              'h1': true, 'h2': true, 'h3': true, 'h4': true, 'h5': true, 'h6': true,
              'header': true, 'hgroup': true, 'hr': true, 'menu': true, 'nav': true, 'ol': true,
              'p': true, 'pre': true, 'section': true, 'table': true, 'ul': true},
        'rp': {'rp': true, 'rt': true},
        'rt': {'rp': true, 'rt': true},
        'tbody': {'tbody': true, 'tfoot': true},
        'td': {'td': true, 'th': true},
        'tfoot': {'tbody': true},
        'th': {'td': true, 'th': true},
        'thead': {'tbody': true, 'tfoot': true},
        'tr': {'tr': true}
      },
      doNotIndent: {"pre": true},
      allowUnquoted: true,
      allowMissing: true
    } : {
      autoSelfClosers: {},
      implicitlyClosed: {},
      contextGrabbers: {},
      doNotIndent: {},
      allowUnquoted: false,
      allowMissing: false
    };
    var alignCDATA = parserConfig.alignCDATA;
  
    // Return variables for tokenizers
    var tagName, type;
  
    function inText(stream, state) {
      function chain(parser) {
        state.tokenize = parser;
        return parser(stream, state);
      }
  
      var ch = stream.next();
      if (ch == "<") {
        if (stream.eat("!")) {
          if (stream.eat("[")) {
            if (stream.match("CDATA[")) return chain(inBlock("atom", "]]>"));
            else return null;
          }
          else if (stream.match("--")) return chain(inBlock("comment", "-->"));
          else if (stream.match("DOCTYPE", true, true)) {
            stream.eatWhile(/[\w\._\-]/);
            return chain(doctype(1));
          }
          else return null;
        }
        else if (stream.eat("?")) {
          stream.eatWhile(/[\w\._\-]/);
          state.tokenize = inBlock("meta", "?>");
          return "meta";
        }
        else {
          var isClose = stream.eat("/");
          tagName = "";
          var c;
          while ((c = stream.eat(/[^\s\u00a0=<>\"\'\/?]/))) tagName += c;
          if (!tagName) return "error";
          type = isClose ? "closeTag" : "openTag";
          state.tokenize = inTag;
          return "tag";
        }
      }
      else if (ch == "&") {
        var ok;
        if (stream.eat("#")) {
          if (stream.eat("x")) {
            ok = stream.eatWhile(/[a-fA-F\d]/) && stream.eat(";");
          } else {
            ok = stream.eatWhile(/[\d]/) && stream.eat(";");
          }
        } else {
          ok = stream.eatWhile(/[\w\.\-:]/) && stream.eat(";");
        }
        return ok ? "atom" : "error";
      }
      else {
        stream.eatWhile(/[^&<]/);
        return null;
      }
    }
  
    function inTag(stream, state) {
      var ch = stream.next();
      if (ch == ">" || (ch == "/" && stream.eat(">"))) {
        state.tokenize = inText;
        type = ch == ">" ? "endTag" : "selfcloseTag";
        return "tag";
      }
      else if (ch == "=") {
        type = "equals";
        return null;
      }
      else if (/[\'\"]/.test(ch)) {
        state.tokenize = inAttribute(ch);
        return state.tokenize(stream, state);
      }
      else {
        stream.eatWhile(/[^\s\u00a0=<>\"\']/);
        return "word";
      }
    }
  
    function inAttribute(quote) {
      return function(stream, state) {
        while (!stream.eol()) {
          if (stream.next() == quote) {
            state.tokenize = inTag;
            break;
          }
        }
        return "string";
      };
    }
  
    function inBlock(style, terminator) {
      return function(stream, state) {
        while (!stream.eol()) {
          if (stream.match(terminator)) {
            state.tokenize = inText;
            break;
          }
          stream.next();
        }
        return style;
      };
    }
    function doctype(depth) {
      return function(stream, state) {
        var ch;
        while ((ch = stream.next()) != null) {
          if (ch == "<") {
            state.tokenize = doctype(depth + 1);
            return state.tokenize(stream, state);
          } else if (ch == ">") {
            if (depth == 1) {
              state.tokenize = inText;
              break;
            } else {
              state.tokenize = doctype(depth - 1);
              return state.tokenize(stream, state);
            }
          }
        }
        return "meta";
      };
    }
  
    var curState, setStyle;
    function pass() {
      for (var i = arguments.length - 1; i >= 0; i--) curState.cc.push(arguments[i]);
    }
    function cont() {
      pass.apply(null, arguments);
      return true;
    }
  
    function pushContext(tagName, startOfLine) {
      var noIndent = Kludges.doNotIndent.hasOwnProperty(tagName) || (curState.context && curState.context.noIndent);
      curState.context = {
        prev: curState.context,
        tagName: tagName,
        indent: curState.indented,
        startOfLine: startOfLine,
        noIndent: noIndent
      };
    }
    function popContext() {
      if (curState.context) curState.context = curState.context.prev;
    }
  
    function element(type) {
      if (type == "openTag") {
        curState.tagName = tagName;
        return cont(attributes, endtag(curState.startOfLine));
      } else if (type == "closeTag") {
        var err = false;
        if (curState.context) {
          if (curState.context.tagName != tagName) {
            if (Kludges.implicitlyClosed.hasOwnProperty(curState.context.tagName.toLowerCase())) {
              popContext();
            }
            err = !curState.context || curState.context.tagName != tagName;
          }
        } else {
          err = true;
        }
        if (err) setStyle = "error";
        return cont(endclosetag(err));
      }
      return cont();
    }
    function endtag(startOfLine) {
      return function(type) {
        if (type == "selfcloseTag" ||
            (type == "endTag" && Kludges.autoSelfClosers.hasOwnProperty(curState.tagName.toLowerCase()))) {
          maybePopContext(curState.tagName.toLowerCase());
          return cont();
        }
        if (type == "endTag") {
          maybePopContext(curState.tagName.toLowerCase());
          pushContext(curState.tagName, startOfLine);
          return cont();
        }
        return cont();
      };
    }
    function endclosetag(err) {
      return function(type) {
        if (err) setStyle = "error";
        if (type == "endTag") { popContext(); return cont(); }
        setStyle = "error";
        return cont(arguments.callee);
      };
    }
    function maybePopContext(nextTagName) {
      var parentTagName;
      while (true) {
        if (!curState.context) {
          return;
        }
        parentTagName = curState.context.tagName.toLowerCase();
        if (!Kludges.contextGrabbers.hasOwnProperty(parentTagName) ||
            !Kludges.contextGrabbers[parentTagName].hasOwnProperty(nextTagName)) {
          return;
        }
        popContext();
      }
    }
  
    function attributes(type) {
      if (type == "word") {setStyle = "attribute"; return cont(attribute, attributes);}
      if (type == "endTag" || type == "selfcloseTag") return pass();
      setStyle = "error";
      return cont(attributes);
    }
    function attribute(type) {
      if (type == "equals") return cont(attvalue, attributes);
      if (!Kludges.allowMissing) setStyle = "error";
      else if (type == "word") setStyle = "attribute";
      return (type == "endTag" || type == "selfcloseTag") ? pass() : cont();
    }
    function attvalue(type) {
      if (type == "string") return cont(attvaluemaybe);
      if (type == "word" && Kludges.allowUnquoted) {setStyle = "string"; return cont();}
      setStyle = "error";
      return (type == "endTag" || type == "selfCloseTag") ? pass() : cont();
    }
    function attvaluemaybe(type) {
      if (type == "string") return cont(attvaluemaybe);
      else return pass();
    }
  
    return {
      startState: function() {
        return {tokenize: inText, cc: [], indented: 0, startOfLine: true, tagName: null, context: null};
      },
  
      token: function(stream, state) {
        if (stream.sol()) {
          state.startOfLine = true;
          state.indented = stream.indentation();
        }
        if (stream.eatSpace()) return null;
  
        setStyle = type = tagName = null;
        var style = state.tokenize(stream, state);
        state.type = type;
        if ((style || type) && style != "comment") {
          curState = state;
          while (true) {
            var comb = state.cc.pop() || element;
            if (comb(type || style)) break;
          }
        }
        state.startOfLine = false;
        return setStyle || style;
      },
  
      indent: function(state, textAfter, fullLine) {
        var context = state.context;
        if ((state.tokenize != inTag && state.tokenize != inText) ||
            context && context.noIndent)
          return fullLine ? fullLine.match(/^(\s*)/)[0].length : 0;
        if (alignCDATA && /<!\[CDATA\[/.test(textAfter)) return 0;
        if (context && /^<\//.test(textAfter))
          context = context.prev;
        while (context && !context.startOfLine)
          context = context.prev;
        if (context) return context.indent + indentUnit;
        else return 0;
      },
  
      electricChars: "/",
  
      configuration: parserConfig.htmlMode ? "html" : "xml"
    };
  });
  
  CodeMirror.defineMIME("text/xml", "xml");
  CodeMirror.defineMIME("application/xml", "xml");
  if (!CodeMirror.mimeModes.hasOwnProperty("text/html"))
    CodeMirror.defineMIME("text/html", {name: "xml", htmlMode: true});

  // End vendor/codemirror-xml-mode.js

  // Begin vendor/codemirror-css-mode.js

  CodeMirror.defineMode("css", function(config) {
    var indentUnit = config.indentUnit, type;
  
    var atMediaTypes = keySet([
      "all", "aural", "braille", "handheld", "print", "projection", "screen",
      "tty", "tv", "embossed"
    ]);
  
    var atMediaFeatures = keySet([
      "width", "min-width", "max-width", "height", "min-height", "max-height",
      "device-width", "min-device-width", "max-device-width", "device-height",
      "min-device-height", "max-device-height", "aspect-ratio",
      "min-aspect-ratio", "max-aspect-ratio", "device-aspect-ratio",
      "min-device-aspect-ratio", "max-device-aspect-ratio", "color", "min-color",
      "max-color", "color-index", "min-color-index", "max-color-index",
      "monochrome", "min-monochrome", "max-monochrome", "resolution",
      "min-resolution", "max-resolution", "scan", "grid"
    ]);
  
    var propertyKeywords = keySet([
      "align-content", "align-items", "align-self", "alignment-adjust",
      "alignment-baseline", "anchor-point", "animation", "animation-delay",
      "animation-direction", "animation-duration", "animation-iteration-count",
      "animation-name", "animation-play-state", "animation-timing-function",
      "appearance", "azimuth", "backface-visibility", "background",
      "background-attachment", "background-clip", "background-color",
      "background-image", "background-origin", "background-position",
      "background-repeat", "background-size", "baseline-shift", "binding",
      "bleed", "bookmark-label", "bookmark-level", "bookmark-state",
      "bookmark-target", "border", "border-bottom", "border-bottom-color",
      "border-bottom-left-radius", "border-bottom-right-radius",
      "border-bottom-style", "border-bottom-width", "border-collapse",
      "border-color", "border-image", "border-image-outset",
      "border-image-repeat", "border-image-slice", "border-image-source",
      "border-image-width", "border-left", "border-left-color",
      "border-left-style", "border-left-width", "border-radius", "border-right",
      "border-right-color", "border-right-style", "border-right-width",
      "border-spacing", "border-style", "border-top", "border-top-color",
      "border-top-left-radius", "border-top-right-radius", "border-top-style",
      "border-top-width", "border-width", "bottom", "box-decoration-break",
      "box-shadow", "box-sizing", "break-after", "break-before", "break-inside",
      "caption-side", "clear", "clip", "color", "color-profile", "column-count",
      "column-fill", "column-gap", "column-rule", "column-rule-color",
      "column-rule-style", "column-rule-width", "column-span", "column-width",
      "columns", "content", "counter-increment", "counter-reset", "crop", "cue",
      "cue-after", "cue-before", "cursor", "direction", "display",
      "dominant-baseline", "drop-initial-after-adjust",
      "drop-initial-after-align", "drop-initial-before-adjust",
      "drop-initial-before-align", "drop-initial-size", "drop-initial-value",
      "elevation", "empty-cells", "fit", "fit-position", "flex", "flex-basis",
      "flex-direction", "flex-flow", "flex-grow", "flex-shrink", "flex-wrap",
      "float", "float-offset", "font", "font-feature-settings", "font-family",
      "font-kerning", "font-language-override", "font-size", "font-size-adjust",
      "font-stretch", "font-style", "font-synthesis", "font-variant",
      "font-variant-alternates", "font-variant-caps", "font-variant-east-asian",
      "font-variant-ligatures", "font-variant-numeric", "font-variant-position",
      "font-weight", "grid-cell", "grid-column", "grid-column-align",
      "grid-column-sizing", "grid-column-span", "grid-columns", "grid-flow",
      "grid-row", "grid-row-align", "grid-row-sizing", "grid-row-span",
      "grid-rows", "grid-template", "hanging-punctuation", "height", "hyphens",
      "icon", "image-orientation", "image-rendering", "image-resolution",
      "inline-box-align", "justify-content", "left", "letter-spacing",
      "line-break", "line-height", "line-stacking", "line-stacking-ruby",
      "line-stacking-shift", "line-stacking-strategy", "list-style",
      "list-style-image", "list-style-position", "list-style-type", "margin",
      "margin-bottom", "margin-left", "margin-right", "margin-top",
      "marker-offset", "marks", "marquee-direction", "marquee-loop",
      "marquee-play-count", "marquee-speed", "marquee-style", "max-height",
      "max-width", "min-height", "min-width", "move-to", "nav-down", "nav-index",
      "nav-left", "nav-right", "nav-up", "opacity", "order", "orphans", "outline",
      "outline-color", "outline-offset", "outline-style", "outline-width",
      "overflow", "overflow-style", "overflow-wrap", "overflow-x", "overflow-y",
      "padding", "padding-bottom", "padding-left", "padding-right", "padding-top",
      "page", "page-break-after", "page-break-before", "page-break-inside",
      "page-policy", "pause", "pause-after", "pause-before", "perspective",
      "perspective-origin", "pitch", "pitch-range", "play-during", "position",
      "presentation-level", "punctuation-trim", "quotes", "rendering-intent",
      "resize", "rest", "rest-after", "rest-before", "richness", "right",
      "rotation", "rotation-point", "ruby-align", "ruby-overhang",
      "ruby-position", "ruby-span", "size", "speak", "speak-as", "speak-header",
      "speak-numeral", "speak-punctuation", "speech-rate", "stress", "string-set",
      "tab-size", "table-layout", "target", "target-name", "target-new",
      "target-position", "text-align", "text-align-last", "text-decoration",
      "text-decoration-color", "text-decoration-line", "text-decoration-skip",
      "text-decoration-style", "text-emphasis", "text-emphasis-color",
      "text-emphasis-position", "text-emphasis-style", "text-height",
      "text-indent", "text-justify", "text-outline", "text-shadow",
      "text-space-collapse", "text-transform", "text-underline-position",
      "text-wrap", "top", "transform", "transform-origin", "transform-style",
      "transition", "transition-delay", "transition-duration",
      "transition-property", "transition-timing-function", "unicode-bidi",
      "vertical-align", "visibility", "voice-balance", "voice-duration",
      "voice-family", "voice-pitch", "voice-range", "voice-rate", "voice-stress",
      "voice-volume", "volume", "white-space", "widows", "width", "word-break",
      "word-spacing", "word-wrap", "z-index"
    ]);
  
    var colorKeywords = keySet([
      "black", "silver", "gray", "white", "maroon", "red", "purple", "fuchsia",
      "green", "lime", "olive", "yellow", "navy", "blue", "teal", "aqua"
    ]);
  
    var valueKeywords = keySet([
      "above", "absolute", "activeborder", "activecaption", "afar",
      "after-white-space", "ahead", "alias", "all", "all-scroll", "alternate",
      "always", "amharic", "amharic-abegede", "antialiased", "appworkspace",
      "arabic-indic", "armenian", "asterisks", "auto", "avoid", "background",
      "backwards", "baseline", "below", "bidi-override", "binary", "bengali",
      "blink", "block", "block-axis", "bold", "bolder", "border", "border-box",
      "both", "bottom", "break-all", "break-word", "button", "button-bevel",
      "buttonface", "buttonhighlight", "buttonshadow", "buttontext", "cambodian",
      "capitalize", "caps-lock-indicator", "caption", "captiontext", "caret",
      "cell", "center", "checkbox", "circle", "cjk-earthly-branch",
      "cjk-heavenly-stem", "cjk-ideographic", "clear", "clip", "close-quote",
      "col-resize", "collapse", "compact", "condensed", "contain", "content",
      "content-box", "context-menu", "continuous", "copy", "cover", "crop",
      "cross", "crosshair", "currentcolor", "cursive", "dashed", "decimal",
      "decimal-leading-zero", "default", "default-button", "destination-atop",
      "destination-in", "destination-out", "destination-over", "devanagari",
      "disc", "discard", "document", "dot-dash", "dot-dot-dash", "dotted",
      "double", "down", "e-resize", "ease", "ease-in", "ease-in-out", "ease-out",
      "element", "ellipsis", "embed", "end", "ethiopic", "ethiopic-abegede",
      "ethiopic-abegede-am-et", "ethiopic-abegede-gez", "ethiopic-abegede-ti-er",
      "ethiopic-abegede-ti-et", "ethiopic-halehame-aa-er",
      "ethiopic-halehame-aa-et", "ethiopic-halehame-am-et",
      "ethiopic-halehame-gez", "ethiopic-halehame-om-et",
      "ethiopic-halehame-sid-et", "ethiopic-halehame-so-et",
      "ethiopic-halehame-ti-er", "ethiopic-halehame-ti-et",
      "ethiopic-halehame-tig", "ew-resize", "expanded", "extra-condensed",
      "extra-expanded", "fantasy", "fast", "fill", "fixed", "flat", "footnotes",
      "forwards", "from", "geometricPrecision", "georgian", "graytext", "groove",
      "gujarati", "gurmukhi", "hand", "hangul", "hangul-consonant", "hebrew",
      "help", "hidden", "hide", "higher", "highlight", "highlighttext",
      "hiragana", "hiragana-iroha", "horizontal", "hsl", "hsla", "icon", "ignore",
      "inactiveborder", "inactivecaption", "inactivecaptiontext", "infinite",
      "infobackground", "infotext", "inherit", "initial", "inline", "inline-axis",
      "inline-block", "inline-table", "inset", "inside", "intrinsic", "invert",
      "italic", "justify", "kannada", "katakana", "katakana-iroha", "khmer",
      "landscape", "lao", "large", "larger", "left", "level", "lighter",
      "line-through", "linear", "lines", "list-item", "listbox", "listitem",
      "local", "logical", "loud", "lower", "lower-alpha", "lower-armenian",
      "lower-greek", "lower-hexadecimal", "lower-latin", "lower-norwegian",
      "lower-roman", "lowercase", "ltr", "malayalam", "match",
      "media-controls-background", "media-current-time-display",
      "media-fullscreen-button", "media-mute-button", "media-play-button",
      "media-return-to-realtime-button", "media-rewind-button",
      "media-seek-back-button", "media-seek-forward-button", "media-slider",
      "media-sliderthumb", "media-time-remaining-display", "media-volume-slider",
      "media-volume-slider-container", "media-volume-sliderthumb", "medium",
      "menu", "menulist", "menulist-button", "menulist-text",
      "menulist-textfield", "menutext", "message-box", "middle", "min-intrinsic",
      "mix", "mongolian", "monospace", "move", "multiple", "myanmar", "n-resize",
      "narrower", "navy", "ne-resize", "nesw-resize", "no-close-quote", "no-drop",
      "no-open-quote", "no-repeat", "none", "normal", "not-allowed", "nowrap",
      "ns-resize", "nw-resize", "nwse-resize", "oblique", "octal", "open-quote",
      "optimizeLegibility", "optimizeSpeed", "oriya", "oromo", "outset",
      "outside", "overlay", "overline", "padding", "padding-box", "painted",
      "paused", "persian", "plus-darker", "plus-lighter", "pointer", "portrait",
      "pre", "pre-line", "pre-wrap", "preserve-3d", "progress", "push-button",
      "radio", "read-only", "read-write", "read-write-plaintext-only", "relative",
      "repeat", "repeat-x", "repeat-y", "reset", "reverse", "rgb", "rgba",
      "ridge", "right", "round", "row-resize", "rtl", "run-in", "running",
      "s-resize", "sans-serif", "scroll", "scrollbar", "se-resize", "searchfield",
      "searchfield-cancel-button", "searchfield-decoration",
      "searchfield-results-button", "searchfield-results-decoration",
      "semi-condensed", "semi-expanded", "separate", "serif", "show", "sidama",
      "single", "skip-white-space", "slide", "slider-horizontal",
      "slider-vertical", "sliderthumb-horizontal", "sliderthumb-vertical", "slow",
      "small", "small-caps", "small-caption", "smaller", "solid", "somali",
      "source-atop", "source-in", "source-out", "source-over", "space", "square",
      "square-button", "start", "static", "status-bar", "stretch", "stroke",
      "sub", "subpixel-antialiased", "super", "sw-resize", "table",
      "table-caption", "table-cell", "table-column", "table-column-group",
      "table-footer-group", "table-header-group", "table-row", "table-row-group",
      "telugu", "text", "text-bottom", "text-top", "textarea", "textfield", "thai",
      "thick", "thin", "threeddarkshadow", "threedface", "threedhighlight",
      "threedlightshadow", "threedshadow", "tibetan", "tigre", "tigrinya-er",
      "tigrinya-er-abegede", "tigrinya-et", "tigrinya-et-abegede", "to", "top",
      "transparent", "ultra-condensed", "ultra-expanded", "underline", "up",
      "upper-alpha", "upper-armenian", "upper-greek", "upper-hexadecimal",
      "upper-latin", "upper-norwegian", "upper-roman", "uppercase", "urdu", "url",
      "vertical", "vertical-text", "visible", "visibleFill", "visiblePainted",
      "visibleStroke", "visual", "w-resize", "wait", "wave", "white", "wider",
      "window", "windowframe", "windowtext", "x-large", "x-small", "xor",
      "xx-large", "xx-small", "yellow"
    ]);
  
    function keySet(array) { var keys = {}; for (var i = 0; i < array.length; ++i) keys[array[i]] = true; return keys; }
    function ret(style, tp) {type = tp; return style;}
  
    function tokenBase(stream, state) {
      var ch = stream.next();
      if (ch == "@") {stream.eatWhile(/[\w\\\-]/); return ret("def", stream.current());}
      else if (ch == "/" && stream.eat("*")) {
        state.tokenize = tokenCComment;
        return tokenCComment(stream, state);
      }
      else if (ch == "<" && stream.eat("!")) {
        state.tokenize = tokenSGMLComment;
        return tokenSGMLComment(stream, state);
      }
      else if (ch == "=") ret(null, "compare");
      else if ((ch == "~" || ch == "|") && stream.eat("=")) return ret(null, "compare");
      else if (ch == "\"" || ch == "'") {
        state.tokenize = tokenString(ch);
        return state.tokenize(stream, state);
      }
      else if (ch == "#") {
        stream.eatWhile(/[\w\\\-]/);
        return ret("atom", "hash");
      }
      else if (ch == "!") {
        stream.match(/^\s*\w*/);
        return ret("keyword", "important");
      }
      else if (/\d/.test(ch)) {
        stream.eatWhile(/[\w.%]/);
        return ret("number", "unit");
      }
      else if (ch === "-") {
        if (/\d/.test(stream.peek())) {
          stream.eatWhile(/[\w.%]/);
          return ret("number", "unit");
        } else if (stream.match(/^[^-]+-/)) {
          return ret("meta", type);
        }
      }
      else if (/[,+>*\/]/.test(ch)) {
        return ret(null, "select-op");
      }
      else if (ch == "." && stream.match(/^-?[_a-z][_a-z0-9-]*/i)) {
        return ret("qualifier", type);
      }
      else if (ch == ":") {
        return ret("operator", ch);
      }
      else if (/[;{}\[\]\(\)]/.test(ch)) {
        return ret(null, ch);
      }
      else if (ch == "u" && stream.match("rl(")) {
        stream.backUp(1);
        state.tokenize = tokenParenthesized;
        return ret("property", "variable");
      }
      else {
        stream.eatWhile(/[\w\\\-]/);
        return ret("property", "variable");
      }
    }
  
    function tokenCComment(stream, state) {
      var maybeEnd = false, ch;
      while ((ch = stream.next()) != null) {
        if (maybeEnd && ch == "/") {
          state.tokenize = tokenBase;
          break;
        }
        maybeEnd = (ch == "*");
      }
      return ret("comment", "comment");
    }
  
    function tokenSGMLComment(stream, state) {
      var dashes = 0, ch;
      while ((ch = stream.next()) != null) {
        if (dashes >= 2 && ch == ">") {
          state.tokenize = tokenBase;
          break;
        }
        dashes = (ch == "-") ? dashes + 1 : 0;
      }
      return ret("comment", "comment");
    }
  
    function tokenString(quote, nonInclusive) {
      return function(stream, state) {
        var escaped = false, ch;
        while ((ch = stream.next()) != null) {
          if (ch == quote && !escaped)
            break;
          escaped = !escaped && ch == "\\";
        }
        if (!escaped) {
          if (nonInclusive) stream.backUp(1);
          state.tokenize = tokenBase;
        }
        return ret("string", "string");
      };
    }
  
    function tokenParenthesized(stream, state) {
      stream.next(); // Must be '('
      if (!stream.match(/\s*[\"\']/, false))
        state.tokenize = tokenString(")", true);
      else
        state.tokenize = tokenBase;
      return ret(null, "(");
    }
  
    return {
      startState: function(base) {
        return {tokenize: tokenBase,
                baseIndent: base || 0,
                stack: []};
      },
  
      token: function(stream, state) {
  
        // Use these terms when applicable (see http://www.xanthir.com/blog/b4E50)
        //
        // rule** or **ruleset:
        // A selector + braces combo, or an at-rule.
        //
        // declaration block:
        // A sequence of declarations.
        //
        // declaration:
        // A property + colon + value combo.
        //
        // property value:
        // The entire value of a property.
        //
        // component value:
        // A single piece of a property value. Like the 5px in
        // text-shadow: 0 0 5px blue;. Can also refer to things that are
        // multiple terms, like the 1-4 terms that make up the background-size
        // portion of the background shorthand.
        //
        // term:
        // The basic unit of author-facing CSS, like a single number (5),
        // dimension (5px), string ("foo"), or function. Officially defined
        //  by the CSS 2.1 grammar (look for the 'term' production)
        //
        //
        // simple selector:
        // A single atomic selector, like a type selector, an attr selector, a
        // class selector, etc.
        //
        // compound selector:
        // One or more simple selectors without a combinator. div.example is
        // compound, div > .example is not.
        //
        // complex selector:
        // One or more compound selectors chained with combinators.
        //
        // combinator:
        // The parts of selectors that express relationships. There are four
        // currently - the space (descendant combinator), the greater-than
        // bracket (child combinator), the plus sign (next sibling combinator),
        // and the tilda (following sibling combinator).
        //
        // sequence of selectors:
        // One or more of the named type of selector chained with commas.
  
        if (state.tokenize == tokenBase && stream.eatSpace()) return null;
        var style = state.tokenize(stream, state);
  
        // Changing style returned based on context
        var context = state.stack[state.stack.length-1];
        if (style == "property") {
          if (context == "propertyValue"){
            if (valueKeywords[stream.current()]) {
              style = "string-2";
            } else if (colorKeywords[stream.current()]) {
              style = "keyword";
            } else {
              style = "variable-2";
            }
          } else if (context == "rule") {
            if (!propertyKeywords[stream.current()]) {
              style += " error";
            }
          } else if (!context || context == "@media{") {
            style = "tag";
          } else if (context == "@media") {
            if (atMediaTypes[stream.current()]) {
              style = "attribute"; // Known attribute
            } else if (/^(only|not)$/i.test(stream.current())) {
              style = "keyword";
            } else if (stream.current().toLowerCase() == "and") {
              style = "error"; // "and" is only allowed in @mediaType
            } else if (atMediaFeatures[stream.current()]) {
              style = "error"; // Known property, should be in @mediaType(
            } else {
              // Unknown, expecting keyword or attribute, assuming attribute
              style = "attribute error";
            }
          } else if (context == "@mediaType") {
            if (atMediaTypes[stream.current()]) {
              style = "attribute";
            } else if (stream.current().toLowerCase() == "and") {
              style = "operator";
            } else if (/^(only|not)$/i.test(stream.current())) {
              style = "error"; // Only allowed in @media
            } else if (atMediaFeatures[stream.current()]) {
              style = "error"; // Known property, should be in parentheses
            } else {
              // Unknown attribute or property, but expecting property (preceded
              // by "and"). Should be in parentheses
              style = "error";
            }
          } else if (context == "@mediaType(") {
            if (propertyKeywords[stream.current()]) {
              // do nothing, remains "property"
            } else if (atMediaTypes[stream.current()]) {
              style = "error"; // Known property, should be in parentheses
            } else if (stream.current().toLowerCase() == "and") {
              style = "operator";
            } else if (/^(only|not)$/i.test(stream.current())) {
              style = "error"; // Only allowed in @media
            } else {
              style += " error";
            }
          } else {
            style = "error";
          }
        } else if (style == "atom") {
          if(!context || context == "@media{") {
            style = "builtin";
          } else if (context == "propertyValue") {
            if (!/^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/.test(stream.current())) {
              style += " error";
            }
          } else {
            style = "error";
          }
        } else if (context == "@media" && type == "{") {
          style = "error";
        }
  
        // Push/pop context stack
        if (type == "{") {
          if (context == "@media" || context == "@mediaType") {
            state.stack.pop();
            state.stack[state.stack.length-1] = "@media{";
          }
          else state.stack.push("rule");
        }
        else if (type == "}") {
          state.stack.pop();
          if (context == "propertyValue") state.stack.pop();
        }
        else if (type == "@media") state.stack.push("@media");
        else if (context == "@media" && /\b(keyword|attribute)\b/.test(style))
          state.stack.push("@mediaType");
        else if (context == "@mediaType" && stream.current() == ",") state.stack.pop();
        else if (context == "@mediaType" && type == "(") state.stack.push("@mediaType(");
        else if (context == "@mediaType(" && type == ")") state.stack.pop();
        else if (context == "rule" && type == ":") state.stack.push("propertyValue");
        else if (context == "propertyValue" && type == ";") state.stack.pop();
        return style;
      },
  
      indent: function(state, textAfter) {
        var n = state.stack.length;
        if (/^\}/.test(textAfter))
          n -= state.stack[state.stack.length-1] == "propertyValue" ? 2 : 1;
        return state.baseIndent + n * indentUnit;
      },
  
      electricChars: "}"
    };
  });
  
  CodeMirror.defineMIME("text/css", "css");

  // End vendor/codemirror-css-mode.js

  // Begin vendor/codemirror-htmlmixed-mode.js

  CodeMirror.defineMode("htmlmixed", function(config) {
    var htmlMode = CodeMirror.getMode(config, {name: "xml", htmlMode: true});
    var jsMode = CodeMirror.getMode(config, "javascript");
    var cssMode = CodeMirror.getMode(config, "css");
  
    function html(stream, state) {
      var style = htmlMode.token(stream, state.htmlState);
      if (/(?:^|\s)tag(?:\s|$)/.test(style) && stream.current() == ">" && state.htmlState.context) {
        if (/^script$/i.test(state.htmlState.context.tagName)) {
          state.token = javascript;
          state.localState = jsMode.startState(htmlMode.indent(state.htmlState, ""));
        }
        else if (/^style$/i.test(state.htmlState.context.tagName)) {
          state.token = css;
          state.localState = cssMode.startState(htmlMode.indent(state.htmlState, ""));
        }
      }
      return style;
    }
    function maybeBackup(stream, pat, style) {
      var cur = stream.current();
      var close = cur.search(pat), m;
      if (close > -1) stream.backUp(cur.length - close);
      else if (m = cur.match(/<\/?$/)) {
        stream.backUp(cur.length);
        if (!stream.match(pat, false)) stream.match(cur[0]);
      }
      return style;
    }
    function javascript(stream, state) {
      if (stream.match(/^<\/\s*script\s*>/i, false)) {
        state.token = html;
        state.localState = null;
        return html(stream, state);
      }
      return maybeBackup(stream, /<\/\s*script\s*>/,
                         jsMode.token(stream, state.localState));
    }
    function css(stream, state) {
      if (stream.match(/^<\/\s*style\s*>/i, false)) {
        state.token = html;
        state.localState = null;
        return html(stream, state);
      }
      return maybeBackup(stream, /<\/\s*style\s*>/,
                         cssMode.token(stream, state.localState));
    }
  
    return {
      startState: function() {
        var state = htmlMode.startState();
        return {token: html, localState: null, mode: "html", htmlState: state};
      },
  
      copyState: function(state) {
        if (state.localState)
          var local = CodeMirror.copyState(state.token == css ? cssMode : jsMode, state.localState);
        return {token: state.token, localState: local, mode: state.mode,
                htmlState: CodeMirror.copyState(htmlMode, state.htmlState)};
      },
  
      token: function(stream, state) {
        return state.token(stream, state);
      },
  
      indent: function(state, textAfter) {
        if (state.token == html || /^\s*<\//.test(textAfter))
          return htmlMode.indent(state.htmlState, textAfter);
        else if (state.token == javascript)
          return jsMode.indent(state.localState, textAfter);
        else
          return cssMode.indent(state.localState, textAfter);
      },
  
      electricChars: "/{}:",
  
      innerMode: function(state) {
        var mode = state.token == html ? htmlMode : state.token == javascript ? jsMode : cssMode;
        return {state: state.localState || state.htmlState, mode: mode};
      }
    };
  }, "xml", "javascript", "css");
  
  CodeMirror.defineMIME("text/html", "htmlmixed");

  // End vendor/codemirror-htmlmixed-mode.js

  // Begin brocco.js

  "use strict";
  
  // This is a simple port of [Docco][] to the browser, which potentially
  // relieves developers of needing a build/deploy step for their
  // documentation. This makes it a bit like Docco combined with
  // [Code Illuminated][].
  //
  // The [source for Brocco][source] is available on GitHub, and released under
  // the MIT license.
  //
  // ## Dependencies
  //
  // The only required dependencies are `brocco.js`, `docco.css`, and
  // `showdown.js`.
  //
  // Optional syntax highlighting requires [CodeMirror][]. Simply
  // include `codemirror.js` and the modes for any
  // languages you're documenting, and Brocco will take care of
  // the rest.
  //
  // ## Add-ons
  //
  // <code>[jump-to.js](?jump-to.js)</code> can be used to provide
  // a Docco-style *Jump To&hellip;* menu at the top of a page,
  // making it easy to navigate between multiple source files.
  //
  // <code>[html-and-css.js](?html-and-css.js)</code> adds support for
  // documenting HTML and CSS files.
  //
  // ## Usage
  //
  // After including the requisite scripts and CSS file in a webpage,
  // you can render basic documentation like this:
  //
  //     Brocco.document("myfile.js");
  //
  // This will insert the generated documentation into the page's
  // `<body>` element. Alternatively, if you want to be passed the
  // generated HTML, you can do this:
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
  //     });
  //
  // For a working example of Brocco used to document multiple
  // source files, see [index.html](?index.html).
  //
  // For more information on the use and behavior of specific API calls,
  // consult the [test suite](test/).
  //
  //   [source]: https://github.com/toolness/brocco
  //   [Docco]: http://jashkenas.github.com/docco/
  //   [Code Illuminated]: http://www.toolness.com/wp/?p=441
  //   [CodeMirror]: http://codemirror.net/
  
  var Brocco = (function() {
    var version = "0.1.0";
  
    // ## Main Documentation Generation Functions
  
    // Generate the documentation for a source file by (optionally) reading it
    // in, splitting it up into comment/code sections, highlighting them for
    // the appropriate language, running the comment sections through Markdown
    // using [Showdown][], and merging them into an HTML template.
    //
    //   [Showdown]: http://attacklab.net/showdown/
    function generateDocumentation(source, config, callback) {
      var code;
  
      var language = getLanguage(source);
      var renderSections = function(sections) {
        var showdown = config.showdown || new Showdown.converter();
        sections.forEach(function(section) {
          if (section.docsText && !section.docsHtml)
            section.docsHtml = showdown.makeHtml(section.docsText);
          section.docsHtml = section.docsHtml || "";
        });
        callback(generateHtml(source, sections, config));
      };
      var parseAndHighlight = function() {
        var sections = parse(source, code);
        return highlight(source, sections, config, function() {
          renderSections(sections);
        });
      };
  
      if (typeof(config) != "object") {
        callback = config;
        config = {};
      }
  
      code = config.code;
      if (!config.template)
        config.template = defaultTemplate;
  
      if (!callback)
        callback = insertHtmlIntoBody;
  
      // Some languages actually provide their own
      // custom parsing and highlighting functionality, due to the
      // fact that they don't support single-line comments. See
      // <code>[html-and-css.js](?html-and-css.js)</code> for an
      // example.
      if (language.makeSections)
        parseAndHighlight = function() {
          language.makeSections(source, code, config, renderSections);
        };
  
      if (typeof(code) == "undefined") {
        getSourceFile(source, function(contents) {
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
  
    // Highlights parsed sections of code. If no syntax highlighter is present,
    // output the code in plain text.
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
      var highlighter = config.highlighter || codeMirrorHighlighter;
      highlighter(language, text, function(fragments) {
        var fragments, i, section, _i, _len;
        for (i = _i = 0, _len = sections.length; _i < _len; i = ++_i) {
          section = sections[i];
          section.codeHtml = fragments[i];
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
  
    // Mappings between CodeMirror styles and the Pygments styles
    // defined in `docco.css`.
    var codeMirrorStyleMap = {
      "keyword": "k",
      "atom": "kc",
      "number": "m",
      "comment": "c",
      "string": "s2",
      "string-2": "s2",
      "tag": "nt",
      "attribute": "na"
    };
  
    // Each item maps the file extension to the name of the CodeMirror mode
    // and the symbol that indicates a comment.
    //
    // In Docco, this was in a separate JSON file, but we're including
    // it inline for simplicity.
    var languages = {
      ".coffee" :
        {"name" : "coffeescript", "symbol" : "#"},
      ".rb":
        {"name" : "ruby", "symbol" : "#"},
      ".py":
        {"name": "python", "symbol" : "#"},
      ".yaml":
        {"name" : "yaml", "symbol" : "#"},
      ".js":
        {"name" : "javascript", "symbol" : "//"},
      ".c":
        {"name" : "clike", "symbol" : "//"},
      ".h":
        {"name" : "clike", "symbol" : "//"},
      ".cpp":
        {"name" : "clike", "symbol" : "//"},
      ".php":
        {"name" : "php", "symbol" : "//"},
      ".hs":
        {"name" : "haskell", "symbol" : "--"},
      ".erl":
        {"name" : "erlang", "symbol" : "%"},
      ".hrl":
        {"name" : "erlang", "symbol" : "%"}
    };
  
    // This is a stand-in for node's <code>[path][]</code> module.
    //
    //   [path]: http://nodejs.org/api/path.html
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
  
    // This is a modified version of CodeMirror's [runmode][],
    // used to leverage CodeMirror's code editing modes for
    // syntax highlighting.
    //
    // If CodeMirror isn't detected or support for the current
    // language isn't available, this function falls back to
    // no highlighting.
    //
    //   [runmode]: http://codemirror.net/demo/runmode.html
    function codeMirrorHighlighter(language, fragments, cb) {
      if (typeof(CodeMirror) == "undefined")
        return nullHighlighter(language, fragments, cb);
  
      var mode = CodeMirror.getMode(CodeMirror.defaults, {
        name: language.name
      });
      if (mode.name == "null")
        return nullHighlighter(language, fragments, cb);
  
      var esc = htmlEscape;
      var string = fragments.join("\n" + language.symbol + "DIVIDER\n");
      var tabSize = CodeMirror.defaults.tabSize;
      var accum = [], col = 0;
      var onText = function(text, style) {
        if (text == "\n") {
          accum.push("\n");
          col = 0;
          return;
        }
        var escaped = "";
        // HTML-escape and replace tabs.
        for (var pos = 0;;) {
          var idx = text.indexOf("\t", pos);
          if (idx == -1) {
            escaped += esc(text.slice(pos));
            col += text.length - pos;
            break;
          } else {
            col += idx - pos;
            escaped += esc(text.slice(pos, idx));
            var size = tabSize - col % tabSize;
            col += size;
            for (var i = 0; i < size; ++i) escaped += " ";
            pos = idx + 1;
          }
        }
  
        if (style) {
          if (codeMirrorStyleMap[style])
            style = codeMirrorStyleMap[style] + " cm-" + style;
          else
            style = "cm-" + style;
          accum.push("<span class=\"" + esc(style) +
                     "\">" + escaped + "</span>");
        } else
          accum.push(escaped);
      };
  
      var lines = CodeMirror.splitLines(string),
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
  
      fragments = accum.join("")
        .split('\n<span class="c cm-comment">' +
               language.symbol + 'DIVIDER</span>\n');
      cb(fragments.map(function(code) { return '<pre>' + code + '</pre>'; }));
    }
  
    // This null syntax highlighter doesn't do any syntax highlighting at
    // all; it just plops the plain-text source code in a `<pre>` element.
    function nullHighlighter(language, fragments, cb) {
      cb(fragments.map(function(code) {
        return '<pre>' + htmlEscape(code) + '</pre>';
      }));
    }
  
    // This default template produces an identical DOM to the
    // <code>[docco.jst][]</code> template used by Docco for single-source
    // files. It's just easier to inline it than grab it via XHR because it
    // complicates the use and deployment of this browser-side script.
    //
    //   [docco.jst]: https://github.com/jashkenas/docco/blob/master/resources/docco.jst
    function defaultTemplate(context) {
      function el(name, attrs, children) {
        var element = document.createElement(name);
        Object.keys(attrs).forEach(function(attr) {
          element.setAttribute(attr, attrs[attr]);
        });
        (children || []).forEach(function(child) {
          if (typeof(child) == "undefined")
            child = "undefined";
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
  
    // This helper inserts the given HTML into the `<body>` element
    // of the page.
    function insertHtmlIntoBody(html) {
      document.body.innerHTML = html;
      scrollLocationHashIntoView();
    }
  
    // This helper does a bit of hackery to ensure that
    // named anchors are automatically navigated to when a
    // page is first loaded.
    function scrollLocationHashIntoView() {
      // Some browsers, like Firefox and Opera, will automatically
      // move the page to its old location when the user refreshes
      // it. We'll give the browser time to do this, and only
      // scroll the page ourselves if it doesn't.
      setTimeout(function() {
        if (location.hash.length > 1 && window.scrollY == 0) {
          var el = document.getElementById(location.hash.slice(1));
          if (el)
            el.scrollIntoView();
        }
      }, 0);
    }
  
    // Leverage the DOM to do HTML escaping for us.
    function htmlEscape(text) {
      var div = document.createElement('div');
      div.appendChild(document.createTextNode(text));
      return div.innerHTML;
    }
  
    // Retrieve the given source file over XHR. If an error occurs
    // and we're on a `file:` URL, there's a good chance it's
    // due to browser security restrictions, so provide content
    // that provides advice.
    function getSourceFile(filename, cb) {
      var req = new XMLHttpRequest();
      req.open("GET", filename);
      req.onerror = function() {
        var language = languages[path.extname(filename)];
        var lines = ["Couldn't get the source file at `" + filename + "`."];
        if (location.protocol == "file:")
          lines = lines.concat([
            "", "This may be due to browser security restrictions. You may ",
            "want to consider opening this file with another browser, or " +
            "using a simple Web server such as `python -m SimpleHTTPServer`."
          ]);
        cb(language.symbol + lines.join('\n' + language.symbol));
      };
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
      }
    }
  
    // This helper makes it easy to add new languages.
    function addLanguages(l) {
      processLanguages(l);
      for (var ext in l)
        languages[ext] = l[ext];
    }
  
    processLanguages(languages);
  
    // ## Exports
    //
    // Information about Brocco, and functions for programmatic usage.
    return {
      version: version,
      document: generateDocumentation,
      nullHighlighter: nullHighlighter,
      codeMirrorHighlighter: codeMirrorHighlighter,
      path: path,
      addLanguages: addLanguages,
      htmlEscape: htmlEscape,
      codeMirrorStyleMap: codeMirrorStyleMap,
      scrollLocationHashIntoView: scrollLocationHashIntoView,
      languages: languages
    };
  })();

  // End brocco.js

  // Begin html-and-css.js

  // This is a zero-configuration add-on to [Brocco][] which adds support for
  // documenting HTML and CSS files.
  //
  // The process for doing this is non-trivial, since both file
  // types can only contain multi-line comments, which Brocco
  // doesn't support by default. Furthermore, HTML files can
  // contain inline CSS and JavaScript, each of which have their
  // own commenting styles.
  //
  // We leverage [CodeMirror][] to do most of the heavy lifting
  // for us.
  //
  //   [Brocco]: ?brocco.js
  //   [CodeMirror]: http://codemirror.net/
  
  (function() {
    var START_COMMENT_REGEXP = /^(\<\!--|\/\*|\/\/)(\s?)(.*)/;
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
      },
      '.css': {
        name : "css",
        symbol : "",
        makeSections: makeMixedHtmlSections
      }
    });
  
    // This is the primary function that takes source code and
    // calls the given callback with a list of section objects
    // containing raw documentation (in the `docsText` key) and
    // highlighted code (in the `codeHtml` key).
    //
    // The code is ultimately based on CodeMirror's [runmode][].
    //
    //   [runmode]: http://codemirror.net/demo/runmode.html
    function makeMixedHtmlSections(source, code, config, cb) {
      var mode = CodeMirror.getMode(CodeMirror.defaults, {
        name: this.name
      });
  
      // `commentMode` keeps track of whether we're currently
      // in a comment. `null` means we're not, while a string
      // indicates the particular type of comment we're in.
      var commentMode = null;
  
      // `commentIndent` is the number of spaces that we want to
      // un-indent multi-line comments so that our documentation
      // doesn't have a bunch of leading whitespace.
      var commentIndent = 0;
      var sections = [];
      var section = {};
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
        if (commentMode == 'csingleline' && accum.length &&
            style == "comment") {
          match = text.match(START_COMMENT_REGEXP);
          if (match[1] == '//')
            text = match[3];
          else {
            // This code is only reached when we've reached a
            // multi-line comment in JavaScript code that immediately
            // follows a single-line comment.
            commentMode = null;
            section.docsText = accum.join("");
            accum = [];
          }
        }
        if (!commentMode && style == "comment") {
          match = text.match(START_COMMENT_REGEXP);
          if (match) {
            // When we reach our first non-contiguous comment line,
            // we finish the section we're on and start a new one.
            // The comment line we're on forms the first line of a
            // new section's documentation.
            commentMode = START_COMMENT_MODES[match[1]];
            commentIndent = col + match[1].length;
            if (match[2]) commentIndent += match[2].length;
            finishSection();
            text = match[3];
          }
        }
        if (commentMode == 'csingleline' && style != 'comment') {
          // This code is reached when we've been following a series
          // of single-line JavaScript comments and hit our first
          // non-comment. When this happens, we know we're done with
          // the documentation for the current section.
          commentMode = null;
          section.docsText = accum.join("");
          accum = [];
        }
        if (commentMode) {
          if (commentMode == "html" && style === null && col == 0)
            // CodeMirror's HTML mode doesn't actually highlight the leading
            // whitespace of a HTML-style comment line as part of a comment,
            // so we need to deal with it specially.
            text = text.slice(commentIndent);
          if (style == "comment") {
            if (commentMode == 'cmultiline' && col == 0 &&
                accum.length && text.trim() != '*/' &&
                text.slice(0, commentIndent).match(/^[\s*]+$/))
              // We want to strip out leading whitespace in multi-line
              // CSS/JS comments. We'll also treat asterisks as white-space
              // here, since we want to get rid of them when converting
              // comments like this into documentation:
              //
              //     /* This is a multi-line comment
              //      * with asterisks at the beginning of each line
              //      * so it looks pretty in a text editor.
              //      */
              text = text.slice(commentIndent);
            if (commentMode in END_COMMENT_REGEXPS) {
              // When we've reached the end of a multi-line comment,
              // we're done with the documentation for this section.
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

  // End html-and-css.js

  // Begin jump-to.js

  "use strict";
  
  // This is a simple add-on to [Brocco][] which provides a Docco-style
  // *Jump To&hellip;* menu at the top of a page, allowing for
  // navigation between different source files.
  //
  // Using this file requires populating the `<body>` of an HTML
  // page with content similar to the following:
  //
  //     <div id="container">
  //       <div id="background"></div>
  //       <div id="jump_to">
  //         Jump To &hellip;
  //         <div id="jump_wrapper">
  //         <div id="jump_page">
  //           <a class="source">path/to/foo.js</a>
  //           <a class="source">path/to/bar.cpp</a>
  //           <!-- ... And so on ... -->
  //         </div>
  //       </div>
  //     </div>
  //
  // Simply including the `jump-to.js` script, preceded by
  // `brocco.js` and its dependencies, will automatically parse
  // all the links inside `#jump_page`, provide a table of
  // contents, and display the appropriate source file.
  // There is no need to write any JavaScript yourself
  // when using this add-on.
  //
  // Viewing specific source files happens through the URL
  // querystring. In the example above, a querystring of `?foo.js`
  // will show the source at `path/to/source/foo.js`, while `?bar.cpp`
  // will show the other file. If nothing is specified in the
  // querystring, then the first source listed (in this case,
  // `foo.js`) will be shown.
  //
  //   [Brocco]: ?brocco.js
  
  Brocco.jumpTo = (function() {
    var sourceMap = {};
    var defaultSource;
    var source = location.search.slice(1);
    var anchors = document.querySelectorAll("#jump_page > a.source");
  
    [].slice.call(anchors).forEach(function(a) {
      var path = a.textContent.trim();
      var basename = Brocco.path.basename(path);
  
      if (!defaultSource)
        defaultSource = basename;
  
      sourceMap[basename] = path;
      a.setAttribute("href", "?" + basename);
      a.textContent = basename;
    });
  
    if (!(source in sourceMap))
      source = defaultSource;
  
    document.title = source;
    Brocco.document(sourceMap[source], function(html) {
      var temp = document.createElement("div");
      temp.innerHTML = html;
      var table = temp.querySelector("table");
      document.getElementById("container").appendChild(table);
      Brocco.scrollLocationHashIntoView();
    });
  })();

  // End jump-to.js

  // Export our only symbol.
  window.Brocco = Brocco;
})();

