h = React.createElement;

var url = '';
var chosen_category = '';

class StartScreen extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            url: '',
        }
        this.submit = this.submit.bind(this);
    }
    submit(evt) {
        evt.preventDefault();
        url = this.state.url;
        ReactDOM.render(h(CategoryScreen, {url: url}), document.querySelector('div'))
    }
    render() {
        return h('div', {style: {}},
            h('form', {onSubmit: this.submit}, [
                h('label', {style: {}}, 'Enter example wiki page: '),
                h('input', {
                    value: this.state.url,
                    autoFocus: true,
                    placeholder: 'https://en.wikipedia.org/wiki/The_Matrix',
                    size: 60,
                    onChange: (evt) => {this.setState({url: evt.target.value})},
                }),
                h('button', null, 'go'),
                h('p', {style: {marginTop: 10}}, 'Note: any mediawiki site will work e.g. https://simpsonswiki.com/wiki/Treehouse_of_Horror')
        ]))
    }
}

// get categories from page
function categoryUrl() {
    // see documentation: https://en.wikipedia.org/w/api.php?action=help&modules=query%2Bcategories
    var split_slashes = url.split('/') // https://en.wikipedia.org/wiki/The_Matrix
    var title = split_slashes[split_slashes.length-1]
    var host = split_slashes.slice(0,3).join('/')
    return `${host}/w/api.php?action=query&prop=categories&format=json&origin=*&cllimit=500&titles=${title}`
}

class CategoryScreen extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            loading: true,
            error: null,
            categories: [],
        }
    }
    componentDidMount() {
        var success = json => {
            var categories = [];
            try {
                Object.entries(json.query.pages).forEach(entry => {
                    entry[1].categories.forEach(category => {
                        categories.push(category.title.replace('Category:', ''))
                    })
                })
                this.setState({categories: categories, loading: false, error: ''})
            } catch(e) {
                this.setState({loading: false, error: "error parsing results"})
            }
        }
        var error = request => {
            this.setState({error: "couldn't access site", loading: false})
        }

        $.getJSON(categoryUrl()).done(success).fail(request => {
            error()
            // try accessing different url to see if api lives there
            $.getJSON(categoryUrl().replace('/w/api', '/api')).done(success).fail(error)
        })
    }
    render() {
        return h('div', null, [
            h('label', null, 'Which of these categories looks right?'),
            h('p', {style:{display:'block', marginTop: 10}}, `Searching within ${this.props.url}`),
            h('form', {}, [
                h('ul', null, this.state.loading ? 'loading...' : this.state.error ? `error: ${this.state.error}` : (this.state.categories.length == 0 ? 'no categories found' : this.state.categories.map((category,i) => {
                    var id = `check-${i}`;
                    return h('li', {key: category}, [
                        h('input', {
                            type: 'radio',
                            name: 'category',
                            value: i,
                            id: id,
                            onChange: (evt) => {
                                chosen_category = category;
                                ReactDOM.render(h(FilterScreen), document.querySelector('div'))
                            }
                        }),
                        h('label', {htmlFor: id, style:{marginLeft: 10}}, category)
                    ])
                })) )
            ])
        ])
    }
}

function getNextPageUrl(continue_token) {
    var split_slashes = url.split('/') // https://en.wikipedia.org/wiki/The_Matrix
    var host = split_slashes.slice(0,3).join('/')
    var category = chosen_category.replace(/\s/g, '_')
    if (continue_token) {
        return `${host}/w/api.php?action=query&list=categorymembers&format=json&origin=*&cmlimit=500&cmtitle=Category:${category}&cmcontinue=${continue_token}`
    }
    return `${host}/w/api.php?action=query&list=categorymembers&format=json&origin=*&cmlimit=500&cmtitle=Category:${category}`
}

class FilterScreen extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            page_titles: [],
            case_sensitive: false,
            regex: '',
            regex_error: false,
            loading: true,
            compiled_regex: new RegExp('', 'gi'),

        }
        this.regex_change = this.regex_change.bind(this);
        this.get_more_results = this.get_more_results.bind(this);
    }
    componentDidMount() {
        // start loading all pages in category
        this.get_more_results()
    }
    get_more_results(continue_token) {
        $.getJSON(getNextPageUrl(continue_token)).done(json => {
            var new_pages = [];
            json.query.categorymembers.forEach(page => {
                if (page.ns === 0) {
                    new_pages.push(page.title)
                }
            })
            this.setState({page_titles: this.state.page_titles.concat(new_pages), loading: false})
            if ('continue' in json) {
                this.get_more_results(json.continue.cmcontinue);
            }
        }).fail(request => {
            // TODO
            alert('error requesting pages')
        })
    }
    regex_change(evt) {
        var re = evt.target.value;
        try {
            if (this.state.case_sensitive) {
                var compiled_regex = new RegExp(re, 'g');
            } else {
                var compiled_regex = new RegExp(re, 'ig');
            }
            this.setState({regex: re, compiled_regex: compiled_regex, regex_error: false})
        } catch(e) {
            this.setState({regex: re, regex_error: true})
        }
    }
    render() {
        var results = this.state.page_titles.filter(title => title.search(this.state.compiled_regex) !== -1)


        var split_slashes = url.split('/') // https://en.wikipedia.org/wiki/The_Matrix
        var host = split_slashes.slice(0,3).join('/')
        return h('div', null, [
            h('p', {key: 'searching-for', style: {marginBottom: 5}}, chosen_category),
            h('label', {key: 'label'}, 'Filter by regex: '),
            h(DebounceInput, {key: 'search', debounceTimeout: 300, autoFocus: true, value: this.state.regex, onChange: this.regex_change, style: {backgroundColor: this.state.regex_error ? 'red' : 'inherit'}}),
            h('input', {key: 'case', id: 'case', type: 'checkbox', checked: this.state.case_sensitive, onChange: evt => {this.setState({case_sensitive: !this.state.case_sensitive})}}),
            h('label', {key: 'case-label', htmlFor: 'case'}, 'case sensitive?'),
            h('p', {style:{marginTop: 5}}, `showing matches 1-${Math.min(results.length, 300)} of ${results.length} ${this.state.regex.length > 0 && !this.state.regex_error ? '(total dataset: '+ this.state.page_titles.length +')' : ''}`),
            h('ol', {key: 'list'}, this.state.loading ? 'loading...' : results.slice(0,300).map(title => {
                return h('li', {key: title}, h('a', {href: `${host}/wiki/${title.replace(/\s/g, '_')}`, target:'_blank'}, title))
            }))
        ])
    }
}


ReactDOM.render(h(StartScreen), document.querySelector('div'))
