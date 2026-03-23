# 🌙 Napzinho

> Acompanhamento inteligente do sono do bebê — feito para funcionar como app no celular.

---

## O que é

Napzinho é um web app para pais acompanharem o sono, mamadas e fraldas do bebê. Ele aprende o padrão do seu filho ao longo dos dias e gera previsões cada vez mais precisas.

Não precisa instalar nada. Funciona direto no navegador e salva os dados no próprio celular.

---

## Funcionalidades

- **Janela de sono em tempo real** — barra de progresso que mostra quanto tempo o bebê está acordado e quando é hora de dormir
- **Botões rápidos** — registra sono com um toque em "Dormiu" e "Acordou"
- **Modo noturno inteligente** — detecta automaticamente sono noturno e exibe sugestões baseadas no número de despertares e tempo acordado
- **Previsões adaptativas** — sistema de 3 fases que aprende o padrão real do bebê com o tempo
- **Resumo noturno** — mostra ciclos de sono, tempo total dormido e média de tempo acordado entre despertares
- **Registro de mamadas e fraldas** — com histórico completo
- **Gráficos diários** — sono por hora e distribuição de registros
- **Sem servidor, sem conta** — tudo salvo localmente no navegador

---

## Como usar no celular

### iPhone
1. Abra a URL no **Safari**
2. Toque no botão de compartilhar ↑
3. Toque em **"Adicionar à Tela de Início"**
4. O Napzinho vira um ícone na tela inicial

### Android
1. Abra a URL no **Chrome**
2. Toque no menu (⋮)
3. Toque em **"Adicionar à tela inicial"**

---

## Sistema de previsões

As previsões melhoram automaticamente conforme você usa o app:

| Fase | Dias de dados | Como funciona |
|------|--------------|---------------|
| 🟠 Aprendendo | 1–3 dias | Tabela padrão da idade + ajustes básicos |
| 🟢 Ajustando | 4–7 dias | 60% histórico real + 40% tabela |
| 🟣 Preciso | 8+ dias | 80% padrão do bebê + faixa de horário personalizada |

---

## Sugestões noturnas

Quando o bebê acorda à noite, o app analisa o tempo acordado e o número de despertares para sugerir a melhor ação:

| Tempo acordado | Sugestão |
|---------------|----------|
| < 15 min | Tente recolocar (shush-pat, chupeta) |
| 15–30 min (3+ despertares) | Considere amamentar |
| 15–30 min | Embale até ficar sonolento |
| 30–60 min | Amamente e recoloque |
| > 1 hora | Reinicie a rotina do zero |

---

## Configurações

Acesse a aba ⚙️ para ajustar:

- **Nome do bebê**
- **Idade em meses** — calibra a janela de sono padrão
- **Horário de início da noite** — padrão 18h, ajuste conforme a rotina

---

## Tecnologia

HTML + CSS + JavaScript puro. Sem frameworks, sem dependências externas além do Chart.js para os gráficos. Dados salvos no `localStorage` do navegador.

---

## Aviso

Este app é uma ferramenta de apoio para organização e acompanhamento. Não substitui orientação médica ou de especialistas em sono infantil.
