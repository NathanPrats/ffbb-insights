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

// Cache est un cache mémoire thread-safe avec TTL.
type Cache struct {
	mu      sync.RWMutex
	entries map[string]Entry
	ttl     time.Duration
}

// New crée un cache avec la durée de vie donnée par entrée.
func New(ttl time.Duration) *Cache {
	return &Cache{
		entries: make(map[string]Entry),
		ttl:     ttl,
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

// Invalidate supprime une entrée du cache, forçant un re-scrape au prochain accès.
func (c *Cache) Invalidate(id string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.entries, id)
}
