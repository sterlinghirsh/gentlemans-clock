all: build

run:
	node app.js

test: build run

build: 
	r.js -o static/js/build.js

push:
	git push

pushlive:
	git push heroku master
