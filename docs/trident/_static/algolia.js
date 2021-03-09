docsearch({
apiKey: '4a93c637dab1729719467f0c70a0d4a1',
indexName: 'trident',
// search.html has no ID ("search-input") like side menu
inputSelector: '#search-input',
transformData: function(hits) {
      hits.map(hit => {
      	if (hit.anchor) {
        	hit.url = hit.url.replace('/html', '')
        	hit.anchor = null;
         }
      })
      return hits;
    },
if (context.selectionMethod === 'click') {
   input.setVal('');
   const windowReference = window.open(suggestion.url, '_blank');
     windowReference.focus();
   },
algoliaOptions: { 
  'queryLanguages': 'en',
  'ignorePlurals': true,
  'removeStopWords': true,
  'hitsPerPage': 10
  },
// Set debug to true if you want to inspect the dropdown
debug: false,
});
