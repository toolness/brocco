combine:
	bin/combine.py > combined/brocco-combined.js
	uglifyjs combined/brocco-combined.js > combined/brocco-combined.min.js
