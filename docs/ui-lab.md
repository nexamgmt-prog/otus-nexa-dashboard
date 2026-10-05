# Laboratório de interface Nexa

O laboratório em `/glass-lab.html` está disponível para administradores Nexa/Otus. O componente atual é `hero.glass`, aplicado aos cards dos dias restantes e dos relógios. A chave é semântica: classes e IDs de DOM são detalhes de renderização, não identificadores de publicação.

## Fluxo

1. Os controles atualizam a prévia imediatamente e salvam o rascunho do administrador em `public.ui_lab_drafts`, com revisão otimista. Uma cópia local protege alterações em caso de falha de rede.
2. **Publicar no sistema** lê a revisão salva e atualiza somente `hero.glass` em `src/design-system/tokens.json` no repositório GitHub configurado. O commit é a versão publicada e pode ser revertido.
3. A integração GitHub da Vercel implanta o commit em `main`. `hero-section.tsx` importa o token publicado no build; mudanças no rascunho nunca alteram o dashboard.

Os testes de imagem de fundo e troca entre relógio digital/analógico servem apenas para avaliar a prévia. Não são parâmetros do vidro.

## Configuração única

- Aplicar `supabase/ui-lab-drafts.sql` ao banco usado pelo app. A tabela tem RLS sem políticas para `anon` ou `authenticated`; apenas a rota autenticada usa `service_role`.
- Configurar `UI_LAB_GITHUB_TOKEN` como **Secret** na Vercel (Production) e em `.env.local` para testar publicação local. Usar um token fine-grained restrito ao repositório `nexamgmt-prog/otus-nexa-dashboard`, com `Contents: Read and write`, data de expiração e sem permissões adicionais. Nunca colocar o token no HTML, no Git ou em `NEXT_PUBLIC_*`.
- Opcional: `UI_LAB_GITHUB_REPOSITORY` e `UI_LAB_GITHUB_BRANCH`. Defaults: `nexamgmt-prog/otus-nexa-dashboard` e `main`.
- O deploy inicial deve conter o laboratório, a API e `src/design-system/tokens.json`. Depois disso, os próximos cliques em Publicar alteram apenas o token e acionam o deploy normal da Vercel.

A publicação fica desabilitada quando a credencial GitHub não existe; o rascunho continua salvando. O modo WebGL usa a imagem da hero como textura e mantém `backdrop-filter` como base/fallback quando a imagem não puder ser carregada com CORS ou WebGL estiver indisponível.

## Próximos componentes

Para botões, criar uma chave semântica como `button.primary` no mesmo arquivo de tokens, um editor próprio no laboratório e consumo pelo componente compartilhado do sistema. Preservar rascunho e publicação separados, validar valores no servidor e versionar por commit.
