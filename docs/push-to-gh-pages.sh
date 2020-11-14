#!/bin/bash

git diff-tree -r --name-only --no-commit-id master | grep '^_site/' &> /dev/null
if [ $? == 0 ]; then
  git push origin `git subtree split --prefix site master 2> /dev/null`:gh-pages --force
fi
