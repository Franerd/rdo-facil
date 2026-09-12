# Backend do RDO Fácil

API privada para sincronizar RDOs, cadastros e fotos entre celular e computador.

## Dados no servidor

- `data/database.json`: metadados, gravados de forma atômica.
- `photos/`: arquivos originais das fotos, fora do PDF.
- `backup/`: reservado para as cópias de segurança automáticas.
- `logs/`: reservado para os registros do serviço.

## Configuração

Defina as variáveis mostradas em `.env.example`. A API escuta apenas no próprio servidor por padrão; o acesso HTTPS externo será configurado por um túnel na etapa de publicação.

Execute `npm run server:check` para validar a API e `npm run server` para iniciá-la.
