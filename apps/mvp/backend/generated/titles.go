package generated

// Title implements server.Titler so the router can inject a dynamic <title>.
func (d ProductDetailPageData) Title() string { return d.Product.Name }

// Title implements server.Titler for news detail pages.
func (d NewsDetailPageData) Title() string { return d.NewsItem.Title }
