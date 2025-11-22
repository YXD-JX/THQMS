Place your development certificates here, or set paths via env:
- VITE_DEV_CERT=cert/dev-cert.pem
- VITE_DEV_KEY=cert/dev-key.pem
- Or VITE_DEV_PFX=cert/dev-cert.p12 and optional VITE_DEV_PFX_PASSPHRASE

Generate with mkcert (recommended):
mkcert -install
mkcert -key-file cert/dev-key.pem -cert-file cert/dev-cert.pem localhost 127.0.0.1 ::1
