package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"alice-backend/internal/api"
	"alice-backend/internal/config"
	"alice-backend/internal/models"
	"alice-backend/internal/server"
)

func main() {
	// Load configuration
	cfg := config.LoadConfig()

	// Initialize model manager
	modelManager := models.NewManager(cfg)

	// Create API handler
	apiHandler := api.NewHandler(cfg, modelManager)

	// Create server
	srv := server.NewServer(cfg, apiHandler)

	// Start the HTTP server FIRST so the desktop app can connect within its
	// startup timeout. Model services (whisper/piper/minilm) download large
	// assets on first run and can take minutes on slow connections; they are
	// initialized in the background and report readiness via /api/health.
	go func() {
		slog.Info("Starting HTTP server", "host", "127.0.0.1", "port", cfg.Server.Port)
		if err := srv.Start(cfg.Server.Port); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("Server error", "error", err)
			os.Exit(1)
		}
	}()

	// Initialize services (downloads models on first run).
	ctx := context.Background()
	go func() {
		if err := modelManager.Initialize(ctx); err != nil {
			slog.Error("Failed to initialize model manager", "error", err)
		} else {
			slog.Info("Model manager initialized; STT/TTS/embeddings ready")
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down server...")

	// Create a context with timeout for graceful shutdown
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Shutdown server
	if err := srv.Stop(shutdownCtx); err != nil {
		slog.Error("Server shutdown error", "error", err)
	}

	// Shutdown model manager
	if err := modelManager.Shutdown(shutdownCtx); err != nil {
		slog.Error("Model manager shutdown error", "error", err)
	}

	slog.Info("Server stopped")
}
