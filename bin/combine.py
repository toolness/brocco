#! /usr/bin/env python

import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = lambda *x: os.path.join(ROOT, *x)

SCRIPT_RE = re.compile(r'<script src="([A-Za-z0-9./\-]+)"><\/script>')

INTRO = """\
(function() {
  // This file contains Brocco with all optional dependencies for
  // documenting HTML, CSS, and JS.\
"""

OUTRO = """\

  // Export our only symbol.
  window.Brocco = Brocco;
})();
"""

lines = INTRO.split('\n')

with open(path('index.html'), 'r') as indexfile:
    for line in indexfile:
        match = SCRIPT_RE.match(line)
        if match:
            filename = match.group(1)
            lines.append('')
            lines.append('  // Begin %s' % filename)
            lines.append('')
            with open(path(*filename.split('/'))) as jsfile:
                for jsline in jsfile:
                    jsline = '  %s' % jsline.rstrip()

                    # CodeMirror attaches itself to window, but
                    # we don't want to pollute the global namespace.
                    jsline = jsline.replace('window.CodeMirror =',
                                            'var CodeMirror =')

                    lines.append(jsline)
            lines.append('')
            lines.append('  // End %s' % filename)

lines.extend(OUTRO.split('\n'))

print '\n'.join(lines)
