package store

import (
	"fmt"
	"time"
)

var categories = []string{"Electronics", "Clothing", "Books", "Home", "Sports"}

func Seed(s *Store) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := 1; i <= 10; i++ {
		id := fmt.Sprintf("prod-%02d", i)
		cat := categories[(i-1)%len(categories)]
		s.products[id] = Product{
			ID:          id,
			Name:        fmt.Sprintf("%s Item %d", cat, i),
			Price:       float64(i) * 9.99,
			Description: fmt.Sprintf("A quality %s product. Perfect for everyday use.", cat),
			ImageURL:    fmt.Sprintf("https://picsum.photos/seed/%d/400/300", i),
			Category:    cat,
			Stock:       (i % 5) + 1,
		}
		for j := 1; j <= 2; j++ {
			rid := fmt.Sprintf("rev-%02d-%d", i, j)
			s.reviews[id] = append(s.reviews[id], Review{
				ID:        rid,
				ProductID: id,
				Author:    fmt.Sprintf("User%d", (i+j)%7+1),
				Rating:    (i+j)%5 + 1,
				Body:      fmt.Sprintf("Review %d for product %d. Great quality!", j, i),
				CreatedAt: time.Now().Add(-time.Duration(i*j) * 24 * time.Hour),
			})
		}
	}

	for i := 1; i <= 5; i++ {
		id := fmt.Sprintf("news-%02d", i)
		s.news[id] = NewsItem{
			ID:          id,
			Title:       fmt.Sprintf("News Article %d", i),
			Summary:     fmt.Sprintf("Summary of news article %d.", i),
			Body:        fmt.Sprintf("Full body of news article %d. This is a longer article with more details.", i),
			PublishedAt: time.Now().Add(-time.Duration(i) * 24 * time.Hour),
		}
	}
}
