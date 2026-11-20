# Migration GestiPers (Judicier) — Vercel → Proxmox Bangui

## Source Vercel (état actuel)

| Élément | Valeur |
|---------|--------|
| Projet Vercel | `judicier` (`prj_ZgOdcjNCi6a48RnGKVUY6FDsEmxQ`) |
| Team | Emma's projects (`emma-projects-5465b78c`) |
| Domaines | `www.gestipers.org`, `gestipers.org`, `judicier.vercel.app` |
| Framework | Vite + serverless `api/**` |
| Env prod | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (+ optionnel `GESTIPERS_API_SECRET`, Aria) |
| Dépôt git | `morningstar-manu/judicier` |

## Cible Bangui

| Élément | Valeur |
|---------|--------|
| App | `gestipers` |
| VM | `192.168.10.186` (vm_id 186, pve-web) |
| Port | hôte `8080` → conteneur `3000` |
| Image | `ghcr.io/infra-bangui/gestipers` |
| Domaine Bangui | `gestipers.datapr.org` |
| Dépôt deploy | `Infra-Bangui/gestipers` (miroir de judicier) |
| Secrets VM | `/opt/app/.env.secrets` |

## Checklist (alignée Plane)

1. Terraform VM gestipers  
2. Ansible `app-hosts.yml`  
3. Secrets Turso / JWT sur la VM  
4. Sync + build GHCR depuis Infra-Bangui/gestipers  
5. Route Traefik  
6. Cloudflare Tunnel `bangui-web`  
7. Monitoring  
8. (Optionnel) bascule DNS `gestipers.org`  
9. Commit `infra-bangui`

## Commandes locales (depuis une machine Tailscale)

```bash
# Infra
cd ~/infra-bangui/terraform && terraform plan && terraform apply
cd ~/infra-bangui/ansible
ansible gestipers -m ping
ansible-playbook app-hosts.yml
ansible-playbook traefik-proxy01.yml
ansible-playbook monitoring-only.yml

# Secrets sur la VM
ssh -i ~/.ssh/bangui manu@192.168.10.186
sudo install -d -o manu -g manu /opt/app
cat > /opt/app/.env.secrets <<'EOF'
TURSO_DATABASE_URL=...
TURSO_AUTH_TOKEN=...
GESTIPERS_API_SECRET=...
EOF
chmod 600 /opt/app/.env.secrets
```

## Plane.so

```bash
export PLANE_API_KEY='...'
export PLANE_WORKSPACE_SLUG='...'
npm run plane:bootstrap
```

## Smoke test local Docker

```bash
cp .env.example .env   # renseigner Turso
docker build -t gestipers:local --build-arg VITE_APP_URL=http://localhost:8080 .
IMAGE_TAG=local docker compose up
# health : curl -s http://127.0.0.1:8080/api/health
```
