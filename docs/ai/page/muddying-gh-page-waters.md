# Muddying the gh-pages waters

Yet another way to make your life miserable by rolling your own

I've done my fair share of googling and was surprised to see there are so many complex ways to use Github pages.

As a person supposed to solve problems, I can't say I like that there are so many ways to serve static pages and at the same time I've found the help pages to be confusing, so I'll just try to explain two key points in the hope to help few of you stop banging their head against the wall.

## Two key points for individual Github accounts

- There are *account* sites (one per individual account). These can be hosted at https://$ACCOUNT.github.io (with or without a `/blog` or `/docs` at the end - this is entirely up to you). My account name is scaleoutsean, for example.
- There are *project* (repo) pages (e.g. `solid-rancher`). These can only be hosted at https://$ACCOUNT.github.io/$PROJECT (yet further followed - or not - by custom paths such as `/rtfm`, for example)

It took me hours of reading TFM (Github Pages, Jekyll). Googling and SO-ing to stumble across this information.

If you've followed until here, you can stop and go back to your troubleshooting - if this hasn't helped you, what follows won't either.

If you were to maintain static Web content this way, you'd keep your Jekyll site in `/docs` and Github would convert them to static pages for you. This does *not* mean you'd end up with site URLs such as (in the case of $ACCOUNT named `blah-blah`) https://blah-blah.github.com/docs. The `/docs` directory in your repo is just a "pick up location" for Github Pages to process your Jekyll content. You decide - in your static Web site generator settings - whether you use a subfolder or not.

If you have locally generated static or non-Jekyll content to begin with, you'd just copy it to this folder /docs and Github would take it from there (and in fact you'd want that content to be left alone because it's ready for publishing.)

## To git or not to git

Another annoying thing is that the choice of branch and directory seems important. Actually it doesn't matter *unless* you plan to have Github help you generate content (static Web pages.) 

The directory is simply a place which Github Pages watches. You may keep your Jekyll site source in `/junk`, have it generate static content in `/junk/_site` and then copy that subdirectory contents to `/data`. That will work. 

Or you could tell Jekyll to output static content directly to `/data`. 

Or you could just keep Jekyll site in `/data` and let Github Pages process it for you server-side after every push.

Which way is better? It depends.

In my case, I decided against the last, Github-integrated approach because I don't have collaborators for these repos and I can't think of any other reason why I should use the automated workflow. Surely it can be a very convenient and even necessary for some repos, but this process also has its limitations so everyone must decide for themselves (and that's why we have half a dozen different ways of going from A to B.)

For example, the workflow approach doesn't support arbitrary Jekyll versions and plugins - you can use only those plugins which Github supports. If you want to add an unsupported plugin - oops, you won't be able to. You also need to implement that auth token thing (yet more security procedures), you need to watch Github to see if your builds completed or not, and there's more.

## Yet another way to deploy

I'm sure you're like me and have read about half a dozen ways to publish static content to Github Pages, but here's what works for me (I already don't like some things about it, but I don't like it less than all the other ways):

- The repo used for my account (github.com/scaleoutsean/scaleoutsean), is set to publish Github pages from `/docs` on the `master` branch. The blog content itself doesn't use any `baseurl` (as you can see from the URL of this post)
- My project github.com/scaleoutsean/solid-rancher is also set to publish Github pages from '/docs' on `master`. This project uses `baseurl=/solid-rancher` so that `/about` from this "sub-site" eventually becomes https://scaleoutsesan.github.io/solid-rancher/about)
- For each of these sites, I use a separate (but similar) procedure to generate static content and make a copy to `/docs` (on the master branch) and place a file `.nojekyll` under `/docs` to tell Github Pages that the content is already static and doesn't need to be processed
- Finally for each of the repos I run `git add docs/`, commit and push to Github

As you can see there's no `gh-pages` branch, git subtree split or other wizard-level commands. I don't use Git every day and I'd rather not use complicated git commands even if it's just in a script.

One of the downsides of my approach is I can't have a project called `categories` and publish its \docs (not without using a different `baseurl` path because scaleoutsean.github.io/categories is now taken by the blog itself; or I could change the blog's top level link to "category" to free up that URL path). I also must maintain my own process (the good and bad thing about it: only I can break and fix it.)

I wouldn't recommend this approach, but I find it less worse for my purpose than other approaches I've seen.

## I used be a README.md kind of guy

One Github project I inherited used to have a static Web site. At the time I immediately nuked that static site directory to spare myself from the inevitable waste of time resulting from the need to lear yet another of the many good-to-know-but-not-essential skils. In hindsight it was the right decision.

As I've just completed publishing docs from a new repo (`solid-rancher`) for which I could afford to give this a try, for now I think static Web site docs are nicer to look at compared to README.md. Instead of having everything in one gigantic README.md, I have sections. It is also easier to search: CTRL+F works fine on long READ.me, but requires a lot of scrolling up and down if the page.)

But there's a price to pay for all these nice things: it's more time consuming to make updates, I have created and now have to maintain a build process, and my docs now have YAML headings (which would require some scripting in order to migrate back to pure markedownif I were to change my mind), so I'm still undecided on whether I really need Github Pages for my repositories.

This isn't to say nobody needs them - my use case is very simple: these aren't code repositories with complex software documentation maintained by half a dozen people. But I'll wait and see rather than move everything to static Web sites. As of now, I still like my README files in the markdown format.
