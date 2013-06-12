all: build

run:
	node app.js

test: build run

build: 
	r.js -o static/js/build.js
	rm -f static/css/all.css && cat static/css/*.css > static/css/all.css

push:
	git push

pushlive:
	git push heroku master
