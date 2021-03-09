docsearch({
  apiKey: '4a93c637dab1729719467f0c70a0d4a1',
  indexName: 'trident',
  inputSelector: '#search-input',
  transformData: function(hits) {
    // modify hits
    hits.map(hit => {
      if (hit.anchor) {
        hit.url = hit.url.replace('/html', '')
        hit.anchor = null;
       }
    })
    return hits;
},
handleSelected: function(input, event, suggestion, datasetNumber, context) {
  if (context.selectionMethod === 'click') {
    input.setVal('');
    const windowReference = window.open(suggestion.url, '_blank');
    windowReference.focus();
  }
},
  algoliaOptions: {
    'queryLanguages': 'en',
    'ignorePlurals': true,
    'removeStopWords': true,
    'hitsPerPage': 10
  },
  debug: false,
});
