# Despliegue en Coolify

Guía para publicar el prototipo **OBRA** (bitácora visual, supervisión y construcción) en Coolify. Es un sitio estático servido por Nginx; no hay base de datos ni API.

## Requisitos

- Coolify v4.x con un servidor conectado.
- Repositorio Git con `docker-compose.coolify.yml` y `docker/Dockerfile.web`.

## Arquitectura

| Servicio | Rol | ¿Dominio? |
|----------|-----|-----------|
| `web` | Nginx + archivos estáticos | Sí |

Consumo típico en reposo: ~10–30 MiB RAM, CPU casi nula. Recomendado para demos: límite **128 MiB** y **0.25 CPU** en la UI de Coolify.

## 1. Crear recurso en Coolify

Repositorio Git → **Build Pack: Docker Compose**.

## 2. General

| Campo | Valor |
|-------|-------|
| Build Pack | Docker Compose |
| Base Directory | `/` |
| Docker Compose Location | `docker-compose.coolify.yml` |

No uses Nixpacks en este repo: la carpeta `review/` contiene Python de preparación de medios y no forma parte del runtime.

## 3. Environment Variables

No hay variables obligatorias. Referencia opcional: `docker/env.coolify.example`.

## 4. Dominio

Asigna el FQDN al servicio **`web`** (puerto interno **80**), con prefijo `https://` en el campo de dominio de Coolify.

Health check opcional: `GET /health` → `200 ok`.

## 5. Deploy

Deployments → Deploy. Tras un push a Git, puedes activar redeploy automático.

## Build local (prueba)

```bash
docker compose -f docker-compose.coolify.yml build
docker compose -f docker-compose.coolify.yml up
```

Abre `http://localhost` solo si mapeas puerto manualmente en prueba local; en Coolify usa `expose`, no `ports: "80:80"`.

## Solución de problemas

| Error | Solución |
|-------|----------|
| Nixpacks failed to detect | Usar Docker Compose y `docker-compose.coolify.yml` |
| Imagen muy grande / build lento | Verificar `.dockerignore` (excluye `review/`) |
| `port 80 already allocated` | Quitar `ports` del compose; solo `expose: ["80"]` |
| 502 / no available server | Dominio en servicio `web`; revisar logs del contenedor |

## Archivos del repositorio

| Archivo | Uso |
|---------|-----|
| `docker-compose.coolify.yml` | Compose para Coolify |
| `docker/Dockerfile.web` | Imagen Nginx Alpine |
| `docker/nginx.conf` | Gzip, caché de estáticos, `/health` |
| `.dockerignore` | Excluye `review/` del contexto de build |
| `docker/env.coolify.example` | Notas de variables (vacío) |
