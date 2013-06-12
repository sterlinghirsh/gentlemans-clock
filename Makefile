all: build

run:
	node app.js

test: build run

build: 
	r.js -o static/js/build.js
	cat static/css/elements.less static/css/custom.less | lessc - > static/css/less_files.css
	rm -f static/css/all.css && cat static/css/*.css > static/css/all.css

push:
	git push

pushlive:
	git push heroku master
