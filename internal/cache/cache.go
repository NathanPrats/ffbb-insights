// Package cache fournit un cache mémoire TTL pour les données FFBB scrapées.
// Le cache est perdu au redémarrage du process — comportement intentionnel
// (voir ADR-004 : zéro stockage persistant).
package cache

import (
	"sync"
	"time"

	"ffbb-insights/internal/standings"
)

// Entry contient les données d'une compétition et leur horodatage.
type Entry struct {
	Classement *standings.Classement
	Calendrier *standings.Calendrier
	FetchedAt  time.Time
}

// ProjEntry contient les résultats de projection mis en cache.
type ProjEntry struct {
	Results   []standings.ProjectionResult
	FetchedAt time.Time
}

// Cache est un cache mémoire thread-safe avec TTL.
type Cache struct {
	mu          sync.RWMutex
	entries     map[string]Entry
	projEntries map[string]ProjEntry
	ttl         time.Duration
}

// New crée un cache avec la durée de vie donnée par entrée.
func New(ttl time.Duration) *Cache {
	return &Cache{
		entries:     make(map[string]Entry),
		projEntries: make(map[string]ProjEntry),
		ttl:         ttl,
	}
}

// Get retourne l'entrée si elle existe et n'a pas expiré.
func (c *Cache) Get(id string) (Entry, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.entries[id]
	if !ok || time.Since(e.FetchedAt) > c.ttl {
		return Entry{}, false
	}
	return e, true
}

// Set stocke une entrée dans le cache.
func (c *Cache) Set(id string, cl *standings.Classement, cal *standings.Calendrier) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[id] = Entry{
		Classement: cl,
		Calendrier: cal,
		FetchedAt:  time.Now(),
	}
}

// GetProjections retourne les projections mises en cache pour une clé donnée.
func (c *Cache) GetProjections(key string) ([]standings.ProjectionResult, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.projEntries[key]
	if !ok || time.Since(e.FetchedAt) > c.ttl {
		return nil, false
	}
	return e.Results, true
}

// SetProjections stocke les résultats de projection dans le cache.
func (c *Cache) SetProjections(key string, results []standings.ProjectionResult) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.projEntries[key] = ProjEntry{Results: results, FetchedAt: time.Now()}
}

// Invalidate supprime une entrée du cache, forçant un re-scrape au prochain accès.
func (c *Cache) Invalidate(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.entries, id)
	// Invalider aussi toutes les projections de cette compétition
	for k := range c.projEntries {
		if len(k) >= len(id) && k[:len(id)] == id {
			delete(c.projEntries, k)
		}
	}
}
