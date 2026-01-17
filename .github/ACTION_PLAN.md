# 🎯 PLANO DE AÇÃO - Roadmap Priorizado

## 📌 VISÃO GERAL

**Objetivo**: Transformar Google-OS de 37.5% para 80%+ funcional em 4 semanas

**Status Atual**: 
- Gmail: 45% funcional
- Calendário: 30% funcional
- Overall: 37.5% funcional

---

## 🚀 FASES DO DESENVOLVIMENTO

### FASE 1: FUNDAMENTALS (Semana 1)
**Objetivo**: Tornar as funcionalidades críticas realmente uteis
**Tempo**: 5 dias de dev

#### Sprint 1A: Gmail Threading (2 dias)
```
❌ Atualmente: Reply abre campo vazio
✅ Objetivo: Conversa completa com histórico

Tarefas:
1. [ ] Estrutura de dados para threading
   - Email + replies array
   - Timestamp para ordenar
   - Unread status por reply

2. [ ] UI para mostrar thread
   - Expandir conversa completa
   - Mostrar todos os replies
   - Highlight reply atual

3. [ ] Handlers de reply
   - Reply add ao array
   - Mark as read
   - Mostrar notificação

Estimativa: 16h dev
Impacto: CRÍTICO (50% uso Gmail)
```

#### Sprint 1B: Calendário - Edit/Delete (2 dias)
```
❌ Atualmente: Apenas criar evento
✅ Objetivo: Gerenciar eventos completo

Tarefas:
1. [ ] Modal de edição evento
   - Reutilizar form do novo evento
   - Pré-populate campos
   - Save changes

2. [ ] Delete evento
   - Botão delete no modal
   - Confirmação
   - Remove do array

3. [ ] Update UI
   - Mostrar opções no evento
   - Right-click context menu
   - Inline edit

Estimativa: 12h dev
Impacto: CRÍTICO (40% uso Calendário)
```

#### Sprint 1C: Search Funcional (1 dia)
```
❌ Atualmente: UI sem função
✅ Objetivo: Filtrar realmente

Tarefas:
1. [ ] Apply filters
   - From: filter por sender
   - To: filter por recipient
   - Subject: filter por assunto
   - Has attachment: filter anexo

2. [ ] Date range
   - From date: filter data inicial
   - To date: filter data final

3. [ ] Aplicar em tempo real

Estimativa: 8h dev
Impacto: ALTO (30% uso Gmail)
```

**Total Fase 1**: 5 dias, **Completude +25%** (62.5%)

---

### FASE 2: CORPORATIVO (Semana 2)
**Objetivo**: Features essenciais para empresa
**Tempo**: 5 dias de dev

#### Sprint 2A: Calendário - Participantes (2 dias)
```
❌ Atualmente: Sem participantes
✅ Objetivo: Adicionar pessoas à reunião

Tarefas:
1. [ ] Campo de participantes
   - Input para email
   - Autocomplete com contatos
   - Add multiple

2. [ ] Mostrar participants
   - Lista de avatares
   - Status (accepted/pending/declined)
   - Remove participant

3. [ ] Email integrado
   - Enviar convite automático
   - Simular resposta

Estimativa: 16h dev
Impacto: CRÍTICO (70% reuniões)
```

#### Sprint 2B: Gmail - Etiquetas/Labels (2 dias)
```
❌ Atualmente: Sem etiquetas
✅ Objetivo: Organizar e-mails por tag

Tarefas:
1. [ ] Sistema de etiquetas
   - Criar/editar/deletar labels
   - Atribuir cor por label
   - Default labels

2. [ ] UI para aplicar
   - Dropdown com labels
   - Atribuir ao e-mail
   - Filtrar por label

3. [ ] Persistência
   - Salvar labels no email
   - Mostrar na lista

Estimativa: 14h dev
Impacto: ALTO (40% organização)
```

#### Sprint 2C: Calendário - Notificações (1 dia)
```
❌ Atualmente: Sem notificações
✅ Objetivo: Alertas antes do evento

Tarefas:
1. [ ] Modal de notificação
   - 15 min antes
   - 30 min antes
   - 1 hora antes

2. [ ] Sistema de trigger
   - Verificar eventos próximos
   - Toast alert
   - Browser notification

Estimativa: 8h dev
Impacto: MÉDIO (60% lembrança)
```

**Total Fase 2**: 5 dias, **Completude +22%** (84.5%)

---

### FASE 3: POLISH (Semana 3)
**Objetivo**: Features importantes para experiência
**Tempo**: 4 dias de dev

#### Sprint 3A: Calendário - Recorrência (2 dias)
```
❌ Atualmente: Sem recorrência
✅ Objetivo: Eventos repetidos

Tarefas:
1. [ ] Padrões de recorrência
   - Diário
   - Semanal (com dias seleção)
   - Mensal
   - Anual

2. [ ] UI para configurar
   - Dropdown recurrence
   - End date ou num occurrences

3. [ ] Gerar eventos
   - Loop para criar instances

Estimativa: 14h dev
Impacto: ALTO (50% eventos)
```

#### Sprint 3B: Gmail - Draft Auto-save (1 dia)
```
❌ Atualmente: Sem auto-save
✅ Objetivo: Salvar automaticamente

Tarefas:
1. [ ] Interval auto-save
   - 30s check
   - Save compose state
   - Restore on reload

2. [ ] UI Indicator
   - Mostrar "Saving..."
   - Mostrar "Saved"

Estimativa: 6h dev
Impacto: MÉDIO (70% tranquilidade)
```

#### Sprint 3C: Calendário - Múltiplos Calendários (1 dia)
```
❌ Atualmente: Um calendário
✅ Objetivo: Trabalho + Pessoal

Tarefas:
1. [ ] Estrutura calendários
   - Array de calendários
   - Cada um com cor
   - Visibility toggle

2. [ ] UI sidebar
   - Listar calendários
   - Checkbox para mostrar/ocultar

3. [ ] Filter eventos
   - Mostrar por calendar seleção

Estimativa: 8h dev
Impacto: MÉDIO (40% organização)
```

**Total Fase 3**: 4 dias, **Completude +15%** (99.5%)

---

### FASE 4: MOBILE & POLISH (Semana 4)
**Objetivo**: Otimizar e fechar
**Tempo**: 3 dias de dev

#### Sprint 4A: Mobile Responsiveness (1.5 dias)
```
Tasks:
1. [ ] Gmail mobile layout
   - Stack vertical em <640px
   - Buttons menores
   - Swipe gestures

2. [ ] Calendário mobile
   - Adaptar vistas
   - Toque para criar evento
   - Mini calendário

3. [ ] Teste em devices
   - iPhone 12/14
   - Android
   - iPad

Estimativa: 12h dev
Impacto: CRÍTICO (60% acesso mobile)
```

#### Sprint 4B: Apps Script Replication (1.5 dias)
```
Tasks:
1. [ ] Converter React → Vanilla JS
   - Core funcionalidades
   - Sem dependências npm
   - HTML/CSS/JS puro

2. [ ] Deploy
   - Upload Code.gs
   - Upload index.html
   - Testar em produção

Estimativa: 12h dev
Impacto: CRÍTICO (Deploy)
```

**Total Fase 4**: 3 dias, **Completude +0.5%** (100%)

---

## 📊 TIMELINE RESUMIDO

```
SEMANA 1 (5 dias)
├── Day 1-2: Gmail Threading
├── Day 3-4: Calendário Edit/Delete
└── Day 5: Search Funcional
Result: 62.5% → Ganho +25%

SEMANA 2 (5 dias)
├── Day 1-2: Calendário Participants
├── Day 3-4: Gmail Labels
└── Day 5: Calendário Notifications
Result: 84.5% → Ganho +22%

SEMANA 3 (4 dias)
├── Day 1-2: Calendário Recurrence
├── Day 3: Gmail Draft Auto-save
└── Day 4: Múltiplos Calendários
Result: 99.5% → Ganho +15%

SEMANA 4 (3 dias)
├── Day 1-2: Mobile Responsiveness
└── Day 3: Apps Script Deploy
Result: 100% → Ganho +0.5%
```

**Total**: 17 dias = ~3.4 semanas de dev
**Resultado Final**: 100% funcional para corporativo

---

## 🎯 PRIORIZAÇÃO

### Tier 1: CRÍTICO (Fazer este mês)
1. **Gmail Threading** - Sem isso, Gmail é inútil
2. **Calendário Edit/Delete** - Sem isso, Calendar é inútil
3. **Calendário Participants** - Reuniões precisam de pessoas
4. **Mobile Responsiveness** - Usuários acessam do phone

### Tier 2: IMPORTANTE (Próximo mês)
1. Gmail Labels - Organização essencial
2. Calendário Notificações - Lembrete de reunião
3. Calendário Recurrence - Eventos recorrentes
4. Search Funcional - Encontrar e-mails

### Tier 3: NICE-TO-HAVE (Depois)
1. Gmail Draft Auto-save
2. Múltiplos Calendários
3. Confidential Mode
4. Smart Compose

---

## 💻 IMPLEMENTAÇÃO TÉCNICA

### Tecnologias Usadas
- React 19.2.3 + TypeScript
- Tailwind CSS
- Lucide icons
- No external state management

### Patterns Reutilizar
- useState para state management
- useEffect para side effects
- useRef para refs
- Drag/drop handlers
- Toast notifications
- Modal dialogs

### Estrutura de Dados Modelo

#### Email com Threading
```typescript
type Email = {
  id: number;
  sender: string;
  subject: string;
  preview: string;
  body: string; // Novo
  timestamp: Date;
  folder: string;
  read: boolean;
  isStarred: boolean;
  labels: string[]; // Novo
  replies: Reply[]; // Novo threading
  attachments: Attachment[];
}

type Reply = {
  id: number;
  from: string;
  body: string;
  timestamp: Date;
  read: boolean;
}
```

#### Calendário com Participants
```typescript
type CalendarEvent = {
  id: number;
  title: string;
  start: Date;
  end: Date;
  location: string;
  description: string;
  calendar: string; // Novo
  participants: Participant[]; // Novo
  recurrence: RecurrenceRule; // Novo
  notifications: Notification[]; // Novo
  color: string;
}

type Participant = {
  email: string;
  name: string;
  avatar: string;
  status: 'accepted' | 'pending' | 'declined';
}

type RecurrenceRule = {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, etc
  endDate?: Date;
  occurrences?: number;
}
```

---

## 🔧 COMO COMEÇAR

### Passo 1: Setup
```bash
# Dev branch
git checkout -b feature/improve-gmail-calendar

# Instalar deps (se necessário)
npm install

# Start dev
npm run dev
```

### Passo 2: Implementar Fase 1
```bash
# Começar com Gmail Threading
# Edit: components/apps/MailApp.tsx
# Add: replies array to email structure
# Add: UI para mostrar thread
# Add: Reply handler
```

### Passo 3: Testar
```bash
# Local test
npm run dev
# Testar threading, edit/delete, search

# Build test
npm run build
# Verificar sem erros
```

### Passo 4: Commit
```bash
git commit -m "feat: add gmail threading, calendar edit/delete, search

- Implement email threading with reply history
- Add calendar event edit/delete functionality  
- Make advanced search actually work
- Add toast notifications for actions
- Tests pass, 0 regressions"
```

---

## 📈 MÉTRICAS DE SUCESSO

| Fase | Gmail | Calendário | Overall |
|---|---|---|---|
| Inicial | 45% | 30% | 37.5% |
| Fase 1 | 60% | 55% | 57.5% |
| Fase 2 | 75% | 75% | 75% |
| Fase 3 | 90% | 95% | 92.5% |
| Fase 4 | 100% | 100% | 100% |

---

## ⏰ CRONOGRAMA

```
SEG   TER   QUA   QUI   SEX
FASE 1 - Week 1
[Threading    ][ Edit/Delete][Search]

FASE 2 - Week 2
[Participants ][ Labels    ][Notif]

FASE 3 - Week 3
[Recurrence   ][ Auto-save ][Multi-cal]

FASE 4 - Week 4
[Mobile Responsive        ][Apps Script]
```

---

## 🚨 RISCOS & MITIGAÇÃO

| Risco | Impacto | Mitigação |
|---|---|---|
| Dados complexos | Alto | Estrutura antes de código |
| Performance com muitos e-mails | Alto | Virtualização lista |
| Threading bug | Médio | Testes unitários |
| Mobile layout | Médio | Design-first |
| Apps Script compat | Alto | Vanilla JS patterns |

---

## ✅ PRÓXIMOS PASSOS AGORA

1. ✅ [Commit feito] Código atual no GitHub
2. ⏳ [Próximo] Começar Fase 1 (Sprint 1A - Gmail Threading)
3. ⏳ [Próximo] Paralelizar com Sprint 1B (Calendário Edit/Delete)
4. ⏳ [Próximo] Finalizar Fase 1 com Sprint 1C (Search)

**Hora de começar a implementar? 🚀**

