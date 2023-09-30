package main

import (
	"log/slog"
	"net/http"
	"os"

	MQTT "github.com/eclipse/paho.mqtt.golang"
	"github.com/go-chi/chi"
	"github.com/gorilla/websocket"
)

type MqqWsHandler struct {
}

func NewMQTTHandler() *MqqWsHandler {

	return &MqqWsHandler{}
}

func (h *MqqWsHandler) HandleRoutes(r chi.Router) {
	upgrader := &websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	}
	r.Get("/*", h.Upgrade(upgrader))
}

func (h *MqqWsHandler) Upgrade(upgrader *websocket.Upgrader) http.HandlerFunc {
	addr := os.Getenv("MQTT_URL")
	if addr == "" {
		slog.Error("invalid MQTT URL", "url", addr)
	}

	opts := MQTT.NewClientOptions()
	opts.AddBroker(addr)

	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			slog.Warn("unable to upgrade", "error", err)
			return
		}
		defer conn.Close()

		mqttClient := MQTT.NewClient(opts)
		if token := mqttClient.Connect(); token.Wait() && token.Error() != nil {
			slog.Error("connecting to MQTT broker", "error", token.Error())
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		defer mqttClient.Disconnect(0)

		for {
			_, body, err := conn.ReadMessage()
			if err != nil {
				w.WriteHeader(http.StatusOK)
				return
			}

			topic := string(body)

			receivedMessages := make(chan MQTT.Message)
			defer close(receivedMessages)

			mqttClient.Subscribe(topic, 0, func(client MQTT.Client, message MQTT.Message) {
				select {
				case receivedMessages <- message:
				default:
				}
			})

			slog.Info("subscribed client", "topic", topic)

			go func() {
				for msg := range receivedMessages {
					if err := conn.WriteMessage(1, msg.Payload()); err != nil {
						slog.Warn("unable to write to conn", "error", err)
					}
				}
			}()
		}
	}
}
