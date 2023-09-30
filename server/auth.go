package main

import (
	_ "embed"
	"encoding/base64"
	"log/slog"
	"net/http"
	"slices"
	"strings"

	"github.com/samber/lo"
	"gopkg.in/yaml.v2"
)

//go:embed binary-data/auth.yml
var authYaml []byte

var Auth Astr

type Astr struct {
	Users  []*User  `yaml:"users"`
	Tokens []string `yaml:"tokens"`
}

type User struct {
	Name     string `yaml:"name"`
	Password string `yaml:"password"`
}

func init() {
	_ = yaml.Unmarshal(authYaml, &Auth)
	slog.Info("loaded credentials", "users", len(Auth.Users), "tokens", len(Auth.Tokens))
}

type AuthMiddleware struct {
	protected http.Handler
}

func NewHttpAuthMiddleware(protected http.Handler) http.Handler {
	return &AuthMiddleware{
		protected: protected,
	}
}

func (m *AuthMiddleware) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	username, password := m.credentials(r)
	if username != "" {
		user, found := lo.Find(Auth.Users, func(u *User) bool {
			return u.Name == username
		})

		if found && user.Password == password {
			m.protected.ServeHTTP(w, r)
			return
		}
	}

	token := r.Header.Get("X-Token")
	if token == "" {
		token = r.FormValue("token")
	}
	if slices.Contains(Auth.Tokens, token) {
		m.protected.ServeHTTP(w, r)
		return
	}

	w.Header().Set("WWW-Authenticate", `Basic realm="restricted", charset="UTF-8"`)
	http.Error(w, "Unauthorized XY", http.StatusUnauthorized)
}

func (m *AuthMiddleware) credentials(r *http.Request) (username, password string) {
	username, password, ok := r.BasicAuth()
	if ok {
		return
	}

	authHeader := r.Header.Get("Authorization")
	if authHeader == "" || !strings.HasPrefix(authHeader, "Basic ") {
		return
	}

	encodedCreds := strings.TrimPrefix(authHeader, "Basic ")
	creds, err := base64.StdEncoding.DecodeString(encodedCreds)
	if err != nil {
		return
	}

	credentials := strings.Split(string(creds), ":")
	if len(credentials) != 2 {
		username = credentials[0]
		password = credentials[1]
	}

	return
}
