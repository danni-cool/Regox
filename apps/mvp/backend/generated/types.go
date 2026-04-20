package generated

type Product struct {
	ID      string
	Title   string
	Price   string
	InStock bool
	Vendor  struct {
		Name string
	}
}

type ProductPageData struct {
	Product Product
}

type ShopPageData struct {
	Products []Product
}
