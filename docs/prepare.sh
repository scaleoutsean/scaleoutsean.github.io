#!/bin/zsh
bundle exec jekyll b --incremental
rm _site/jekyll-yamt.gemspec
touch _site/.nojekyll
cp LICENSE.txt _site/
sed -i 's/localhost:4000/scaleoutsean.github.io/g' _site/sitemap.xml
# Ready go commit and push
rsync -rav --delete _site/ docs/
