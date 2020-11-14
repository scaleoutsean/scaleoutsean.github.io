#!/bin/zsh
bundle exec jekyll b
touch _site/.nojekyll
rm _site/jekyll-yamt.gemspec
rsync -rav _site/ docs/
