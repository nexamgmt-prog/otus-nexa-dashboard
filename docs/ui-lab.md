# Laboratório de interface Nexa

O laboratório em `/glass-lab.html` está disponível para administradores Nexa/Otus. O componente atual é `hero.glass`, aplicado aos cards dos dias restantes e dos relógios. A chave é semântica: classes e IDs de DOM não são identificadores de publicação.

Os controles atualizam a prévia imediatamente e salvam o rascunho do administrador em `public.ui_lab_drafts`, com revisão otimista. Uma cópia local protege alterações em caso de falha de rede. **Publicar no sistema** grava o preset ativo na mesma tabela sob o usuário reservado `__published__`. O dashboard lê esse preset ao abrir e ao voltar para a aba, sem esperar um build. Se a leitura falhar, usa os valores versionados em `src/design-system/tokens.json`.

O modo WebGL usa a imagem da hero como textura e mantém `backdrop-filter` como base quando a imagem não puder ser carregada com CORS ou WebGL estiver indisponível. A troca de fundo e de relógio no laboratório serve apenas para avaliar o efeito; não é publicada.

Aplicar `supabase/ui-lab-drafts.sql` ao banco usado pelo app. A tabela tem RLS sem políticas para `anon` ou `authenticated`; apenas as rotas no servidor usam `service_role`. A API de alteração exige sessão de administrador da agência, confere a revisão do rascunho e restringe mutações à mesma origem. O preset ativo contém apenas números e o modo do vidro, então sua leitura pode ser pública.

O GitHub `main` está atrás da versão do sistema implantada pela CLI. Sincronizar a fonte antes de voltar a automatizar commits e deploys pelo laboratório; um commit de tokens hoje acionaria um deploy de código antigo. A aplicação imediata via banco mantém o laboratório utilizável sem esse risco. O PR de implementação deve ser reconciliado com a fonte atual antes do merge.

Para botões, criar uma chave semântica como `button.primary`, um editor próprio no laboratório e consumo pelo componente compartilhado do sistema. Preservar rascunho e publicação separados, validar valores no servidor e registrar versões publicadas.
