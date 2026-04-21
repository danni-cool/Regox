package resolvers

import (
	"sort"

	"regox.dev/mvp/generated"
	"regox.dev/mvp/store"
	server "regox.dev/server"
)

func NewNewsList(s *store.Store) func(*server.RequestCtx) (any, error) {
	return func(ctx *server.RequestCtx) (any, error) {
		allNews := s.ListNews()
		sort.Slice(allNews, func(i, j int) bool {
			return allNews[i].PublishedAt.After(allNews[j].PublishedAt)
		})
		return generated.NewsPageData{
			News: toGenNews(allNews),
		}, nil
	}
}

func NewNewsDetail(s *store.Store) func(*server.RequestCtx) (any, error) {
	return func(ctx *server.RequestCtx) (any, error) {
		id := ctx.PathValue("id")
		n, ok := s.GetNews(id)
		if !ok {
			return nil, nil
		}
		return generated.NewsDetailPageData{
			NewsItem: generated.NewsItem{
				Id:          n.ID,
				Title:       n.Title,
				Summary:     n.Summary,
				Body:        n.Body,
				PublishedAt: n.PublishedAt,
			},
		}, nil
	}
}
