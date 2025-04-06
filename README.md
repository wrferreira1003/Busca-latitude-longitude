# Busca de Latitude e Longitude por CEP

Aplicação Next.js para buscar coordenadas geográficas (latitude e longitude) de franquias com base no CEP.

## Funcionalidades

- Consulta individual de CEP diretamente na interface
- Upload de arquivo CSV contendo dados de franquias (id, nome, cep)
- Validação e padronização automática de CEPs em diferentes formatos
- Conversão de CEP para latitude e longitude usando API ViaCEP e Nominatim OpenStreetMap
- Coordenadas no formato padrão com ponto decimal (ex: 41.40338, 2.17403)
- Exibição dos resultados em tabela com status de processamento
- Exportação dos resultados para CSV

## Tecnologias Utilizadas

- Next.js 14
- TypeScript
- Tailwind CSS
- Papa Parse (para parsing de CSV)
- React-CSV (para exportação de CSV)
- Axios (para requisições HTTP)
- APIs: ViaCEP e Nominatim OpenStreetMap

## Validação de CEP

A aplicação suporta CEPs em diferentes formatos:
- Com ou sem hífen (01310-100 ou 01310100)
- Com ou sem pontos (01310.100 ou 01310100)

O sistema:
- Valida se o CEP possui 8 dígitos
- Padroniza para o formato XXXXX-XXX
- Informa na tabela de resultados o status do processamento, incluindo erros específicos de validação

### Tratamento Especial para CEPs de Cidades

Para CEPs genéricos de cidades (terminados em 000), o sistema implementa uma busca alternativa:
- Caso o CEP não seja encontrado na API ViaCEP (como 44900-000)
- Tenta localizar um CEP próximo na mesma cidade (ex: 44900-010)
- Se encontrado, utiliza apenas a cidade e estado para geolocalização
- Retorna as coordenadas com o status "Sucesso (aproximado por cidade)"

Isso permite que mesmo CEPs não cadastrados na base da ViaCEP possam ter suas coordenadas aproximadas pela localização da cidade.

## Como executar

1. Clone o repositório
2. Instale as dependências:
```bash
npm install
```
3. Execute o servidor de desenvolvimento:
```bash
npm run dev
```
4. Acesse a aplicação em [http://localhost:3000](http://localhost:3000)

## Utilização

### Consulta Individual
1. Digite o nome (opcional) e o CEP que deseja consultar
2. Clique em "Buscar" para obter as coordenadas
3. O resultado será exibido na tabela

### Processamento em Massa via CSV
1. Faça upload de um arquivo CSV contendo as colunas: id, nome, cep
   - Você pode baixar um arquivo de exemplo diretamente na aplicação
2. Clique em "Buscar Coordenadas" para iniciar o processamento
3. Aguarde o processamento (a barra de progresso indicará o status)
4. Visualize os resultados na tabela
5. Utilize o botão "Exportar CSV" para baixar os resultados com as coordenadas
6. Utilize os botões de limpeza quando precisar:
   - "Limpar Arquivo" para remover o arquivo CSV carregado e começar do zero
   - "Limpar Resultados" para manter o arquivo carregado, mas remover os resultados processados

## Limitações

- A aplicação usa APIs gratuitas que podem ter limites de requisição
- Foi implementado um delay de 1 segundo entre requisições para evitar sobrecarregar as APIs
- Para grandes volumes de dados, o processamento pode levar algum tempo

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
