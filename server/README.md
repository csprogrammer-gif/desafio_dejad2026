# Backend — A Cidade dos Iguais (multiplayer)

API Node + Express + PostgreSQL que dá suporte ao multiplayer do jogo.
O frontend (`index.html` e `painel.html`) fica no GitHub Pages e chama esta API.

## Arquitetura

```
GitHub Pages (frontend)  ->  este backend (mesma plataforma do banco)  ->  PostgreSQL
```

O backend precisa rodar na mesma plataforma/rede do banco, porque o host
`games_dejad-desafio` é interno (não é acessível pela internet).

## Rotas implementadas

Público (jogador):
- `POST /api/join` — body `{ code, name }` → `{ player }`
- `GET  /api/rooms/:code` → `{ room }`
- `GET  /api/players/:id` (Bearer token do jogador) → `{ room, player }`
- `POST /api/players/:id/stage` (Bearer token) — body `{ phase, answers, collected }` → `{ room, finished, durationMs }`

Host (painel, Bearer = HOST_KEY):
- `GET  /api/host/rooms` → `{ rooms }`
- `POST /api/host/rooms` — body `{ title }` → `{ room }`
- `POST /api/host/rooms/:code/start` → `{ room }`
- `POST /api/host/rooms/:code/end` → `{ room }`

Saúde: `GET /health`

## Variáveis de ambiente

Veja `.env.example`. As principais:

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | String de conexão do Postgres (use a "URL de Conexão Interna"). |
| `PGSSL` | `false` para rede interna; `true` em bancos gerenciados que exigem SSL. |
| `HOST_KEY` | Chave secreta que a organização usa no painel. |
| `CORS_ORIGIN` | URL exata do seu GitHub Pages, ex.: `https://usuario.github.io`. |
| `PORT` | Porta HTTP (padrão 5000). |
| `MATCH_MINUTES` | Duração da rodada (padrão 20). |
| `START_COUNTDOWN_SECONDS` | Contagem antes de iniciar (padrão 5). |

## Passo a passo no EasyPanel

Faça tudo dentro do **mesmo projeto** (`games`) onde o Postgres já está, para o
backend enxergar o banco pela rede interna.

1. **Criar o serviço**
   - No projeto `games`, clique em **+ Service → App**.
   - Dê um nome, ex.: `dejad-api`.

2. **Fonte (Source)**
   - Escolha **GitHub** (ou Git) e selecione este repositório e a branch (`main`).
   - Em **Build Path**, informe `/server` (o backend fica nessa subpasta).
   - O EasyPanel detecta o `Dockerfile` automaticamente (builder = Dockerfile).

3. **Variáveis de ambiente (Environment)**
   Cole:
   ```
   DATABASE_URL=postgres://postgres:SENHA@games_dejad-desafio:5432/dejad_desafio?sslmode=disable
   PGSSL=false
   HOST_KEY=uma-chave-forte-sua
   CORS_ORIGIN=https://SEU-USUARIO.github.io
   PORT=5000
   ```
   > Use a senha real só aqui, nas variáveis do EasyPanel. Nunca commite isso.

4. **Rede / Domínio (Domains)**
   - Em **Domains**, adicione um domínio. O EasyPanel oferece um domínio
     automático; você pode usá-lo ou apontar um subdomínio seu.
   - **Porta do container: `5000`** (o mesmo `PORT`).
   - O EasyPanel cuida do HTTPS automaticamente.

5. **Deploy**
   - Clique em **Deploy** e aguarde o build terminar.

6. **Migração do banco (uma vez)**
   - Abra o **Console/Terminal** do serviço `dejad-api` e rode:
     ```
     npm run migrate
     ```
   - Isso cria as tabelas (`rooms`, `players`) no banco.

7. **Testar**
   - Acesse `https://SEU-DOMINIO/health` → deve responder `{ "ok": true }`.

## Depois do deploy

Troque a constante `API_SERVER` no topo do `<script>` de `index.html` e
`painel.html` para a URL pública do backend. Exemplo:

```js
const API_SERVER='https://api-dejad.seudominio.com';
```

O painel da organização é acessado em:
`https://usuario.github.io/repo/painel.html#chave=SUA_HOST_KEY`

## Rodar localmente (opcional)

```bash
cd server
npm install
cp .env.example .env   # preencha os valores
npm run migrate
npm start
```
