export type SlideElementType = 'text' | 'shape' | 'image' | 'line';
export type SlideShapeKind = 'rectangle' | 'rounded' | 'circle' | 'pill' | 'callout' | 'badge';
export type SlideTransitionType = 'none' | 'fade' | 'slide' | 'zoom';
export type SlideLayoutId =
  | 'title'
  | 'title_body'
  | 'section_header'
  | 'two_columns'
  | 'big_number'
  | 'caption_only'
  | 'blank';

export interface SlideElementStyle {
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
  zIndex?: number;
  padding?: number;
  shapeKind?: SlideShapeKind;
}

export interface SlideElement {
  id: string;
  type: SlideElementType;
  content: string;
  imageUrl?: string;
  /** Normalized percentages on a 960x540 (16:9) logical canvas */
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  style: SlideElementStyle;
}

export interface SlidePage {
  id: string;
  layout: SlideLayoutId;
  background: string;
  transition: SlideTransitionType;
  notes: string;
  skipped?: boolean;
  elements: SlideElement[];
}

export interface SlideTheme {
  id: string;
  name: string;
  background: string;
  surfaceColor: string;
  titleColor: string;
  bodyColor: string;
  accentColor: string;
  fontFamily: string;
}

export interface SlideCommentReply {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface SlideComment {
  id: string;
  slideId: string;
  author: string;
  createdAt: string;
  text: string;
  resolved: boolean;
  replies?: SlideCommentReply[];
}

export interface SlideVersion {
  id: string;
  name: string;
  createdAt: string;
  author: string;
  slides: SlidePage[];
}

export interface SlideDeckBundle {
  themeId: string;
  slides: SlidePage[];
  comments: SlideComment[];
  versions: SlideVersion[];
  showGrid?: boolean;
  showNotes?: boolean;
}

export const SLIDE_CANVAS_WIDTH = 960;
export const SLIDE_CANVAS_HEIGHT = 540;

export const SLIDE_THEMES: SlideTheme[] = [
  {
    id: 'claro-executivo',
    name: 'Claro Executivo',
    background: '#FFFFFF',
    surfaceColor: '#F1F5F9',
    titleColor: '#0F172A',
    bodyColor: '#334155',
    accentColor: '#1A73E8',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  {
    id: 'escuro-minimalista',
    name: 'Escuro Minimalista',
    background: '#0F172A',
    surfaceColor: '#1E293B',
    titleColor: '#F8FAFC',
    bodyColor: '#CBD5E1',
    accentColor: '#38BDF8',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  {
    id: 'azul-workspace',
    name: 'Azul Workspace',
    background: 'linear-gradient(135deg, #0F294A 0%, #1A73E8 100%)',
    surfaceColor: 'rgba(255,255,255,0.12)',
    titleColor: '#FFFFFF',
    bodyColor: '#E0F2FE',
    accentColor: '#FACC15',
    fontFamily: "'Outfit', sans-serif",
  },
  {
    id: 'verde-crescimento',
    name: 'Verde Crescimento',
    background: 'linear-gradient(135deg, #064E3B 0%, #059669 100%)',
    surfaceColor: 'rgba(255,255,255,0.12)',
    titleColor: '#FFFFFF',
    bodyColor: '#D1FAE5',
    accentColor: '#FDE047',
    fontFamily: "'DM Sans', sans-serif",
  },
  {
    id: 'papel-editorial',
    name: 'Editorial Suave',
    background: '#F8FAFC',
    surfaceColor: '#E2E8F0',
    titleColor: '#1E293B',
    bodyColor: '#475569',
    accentColor: '#D97706',
    fontFamily: "'Georgia', serif",
  },
  {
    id: 'dusk-slate',
    name: 'Ardósia Profunda',
    background: 'linear-gradient(135deg, #18181B 0%, #27272A 100%)',
    surfaceColor: 'rgba(255,255,255,0.08)',
    titleColor: '#FAFAFA',
    bodyColor: '#D4D4D8',
    accentColor: '#10B981',
    fontFamily: "'Manrope', sans-serif",
  },
];

export const SLIDE_LAYOUT_META: Array<{ id: SlideLayoutId; label: string; desc: string }> = [
  { id: 'title', label: 'Slide de título', desc: 'Título centralizado e subtítulo' },
  { id: 'title_body', label: 'Título e corpo', desc: 'Cabeçalho com área ampla de conteúdo' },
  { id: 'two_columns', label: 'Duas colunas', desc: 'Título superior + dois blocos lado a lado' },
  { id: 'section_header', label: 'Cabeçalho da seção', desc: 'Transição visual entre tópicos' },
  { id: 'big_number', label: 'Número em destaque', desc: 'Métrica KPI principal e contexto' },
  { id: 'caption_only', label: 'Apenas legenda', desc: 'Rodapé descritivo para mídia ou gráfico' },
  { id: 'blank', label: 'Em branco', desc: 'Tela limpa para criação livre' },
];

export const getThemeById = (themeId: string): SlideTheme =>
  SLIDE_THEMES.find((t) => t.id === themeId) || SLIDE_THEMES[0];

const uid = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export function createSlideFromLayout(
  layout: SlideLayoutId,
  themeId = 'claro-executivo',
  overrides?: { title?: string; body?: string; subtitle?: string }
): SlidePage {
  const theme = getThemeById(themeId);
  const id = uid('slide');
  const elements: SlideElement[] = [];

  if (layout === 'title') {
    elements.push(
      {
        id: uid('el'),
        type: 'text',
        content: overrides?.title || 'Clique para adicionar um título',
        x: 90,
        y: 155,
        w: 780,
        h: 110,
        style: {
          color: theme.titleColor,
          fontSize: 38,
          fontFamily: theme.fontFamily,
          fontWeight: 'bold',
          textAlign: 'center',
          zIndex: 1,
        },
      },
      {
        id: uid('el'),
        type: 'text',
        content: overrides?.subtitle || 'Clique para adicionar um subtítulo ou data',
        x: 160,
        y: 280,
        w: 640,
        h: 70,
        style: {
          color: theme.bodyColor,
          fontSize: 20,
          fontFamily: theme.fontFamily,
          fontWeight: 'normal',
          textAlign: 'center',
          zIndex: 2,
        },
      }
    );
  } else if (layout === 'title_body') {
    elements.push(
      {
        id: uid('el'),
        type: 'text',
        content: overrides?.title || 'Título do tópico',
        x: 64,
        y: 48,
        w: 832,
        h: 64,
        style: {
          color: theme.titleColor,
          fontSize: 30,
          fontFamily: theme.fontFamily,
          fontWeight: 'bold',
          textAlign: 'left',
          zIndex: 1,
        },
      },
      {
        id: uid('el'),
        type: 'line',
        content: '',
        x: 64,
        y: 118,
        w: 140,
        h: 4,
        style: {
          backgroundColor: theme.accentColor,
          borderRadius: 2,
          zIndex: 2,
        },
      },
      {
        id: uid('el'),
        type: 'text',
        content:
          overrides?.body ||
          '• Primeiro ponto estratégico de alto impacto\n• Segundo argumento apoiado por dados reais\n• Próximo passo e responsável definido',
        x: 64,
        y: 146,
        w: 832,
        h: 320,
        style: {
          color: theme.bodyColor,
          fontSize: 19,
          fontFamily: theme.fontFamily,
          fontWeight: 'normal',
          textAlign: 'left',
          zIndex: 3,
        },
      }
    );
  } else if (layout === 'two_columns') {
    elements.push(
      {
        id: uid('el'),
        type: 'text',
        content: overrides?.title || 'Comparativo de Iniciativas',
        x: 64,
        y: 44,
        w: 832,
        h: 60,
        style: {
          color: theme.titleColor,
          fontSize: 28,
          fontFamily: theme.fontFamily,
          fontWeight: 'bold',
          textAlign: 'left',
          zIndex: 1,
        },
      },
      {
        id: uid('el'),
        type: 'shape',
        content: 'Coluna A · Cenário Atual\n\n• Custo operacional elevado\n• Processos manuais em silos\n• SLA médio de 48 horas',
        x: 64,
        y: 132,
        w: 400,
        h: 340,
        style: {
          backgroundColor: theme.surfaceColor,
          color: theme.bodyColor,
          fontSize: 17,
          fontFamily: theme.fontFamily,
          textAlign: 'left',
          borderRadius: 14,
          padding: 22,
          shapeKind: 'rounded',
          zIndex: 2,
        },
      },
      {
        id: uid('el'),
        type: 'shape',
        content: 'Coluna B · Cenário Proposto\n\n• Automação ponta a ponta\n• Painel único em tempo real\n• SLA reduzido para 4 horas',
        x: 496,
        y: 132,
        w: 400,
        h: 340,
        style: {
          backgroundColor: theme.surfaceColor,
          color: theme.bodyColor,
          fontSize: 17,
          fontFamily: theme.fontFamily,
          textAlign: 'left',
          borderColor: theme.accentColor,
          borderWidth: 2,
          borderRadius: 14,
          padding: 22,
          shapeKind: 'rounded',
          zIndex: 3,
        },
      }
    );
  } else if (layout === 'section_header') {
    elements.push(
      {
        id: uid('el'),
        type: 'shape',
        content: '',
        x: 64,
        y: 218,
        w: 76,
        h: 6,
        style: {
          backgroundColor: theme.accentColor,
          borderRadius: 3,
          shapeKind: 'rectangle',
          zIndex: 1,
        },
      },
      {
        id: uid('el'),
        type: 'text',
        content: overrides?.title || '02. Expansão & Roadmap Q2',
        x: 64,
        y: 242,
        w: 800,
        h: 84,
        style: {
          color: theme.titleColor,
          fontSize: 38,
          fontFamily: theme.fontFamily,
          fontWeight: 'bold',
          textAlign: 'left',
          zIndex: 2,
        },
      },
      {
        id: uid('el'),
        type: 'text',
        content: overrides?.subtitle || 'Principais marcos de engenharia e produto para os próximos 90 dias',
        x: 64,
        y: 332,
        w: 760,
        h: 50,
        style: {
          color: theme.bodyColor,
          fontSize: 18,
          fontFamily: theme.fontFamily,
          textAlign: 'left',
          zIndex: 3,
        },
      }
    );
  } else if (layout === 'big_number') {
    elements.push(
      {
        id: uid('el'),
        type: 'text',
        content: overrides?.title || '+142%',
        x: 80,
        y: 120,
        w: 800,
        h: 130,
        style: {
          color: theme.accentColor,
          fontSize: 84,
          fontFamily: theme.fontFamily,
          fontWeight: 'bold',
          textAlign: 'center',
          zIndex: 1,
        },
      },
      {
        id: uid('el'),
        type: 'text',
        content: overrides?.subtitle || 'Crescimento em Receita Recorrente Anual (ARR) nos últimos 12 meses',
        x: 140,
        y: 270,
        w: 680,
        h: 90,
        style: {
          color: theme.titleColor,
          fontSize: 22,
          fontFamily: theme.fontFamily,
          fontWeight: 'semibold',
          textAlign: 'center',
          zIndex: 2,
        },
      }
    );
  } else if (layout === 'caption_only') {
    elements.push({
      id: uid('el'),
      type: 'text',
      content: overrides?.title || 'Legenda da seção — insira imagem ou destaque acima desta linha',
      x: 64,
      y: 424,
      w: 832,
      h: 64,
      style: {
        color: theme.bodyColor,
        fontSize: 18,
        fontFamily: theme.fontFamily,
        textAlign: 'left',
        zIndex: 1,
      },
    });
  }

  return {
    id,
    layout,
    background: theme.background,
    transition: 'fade',
    notes: '',
    elements,
  };
}

export function createBlankDeck(deckTitle = 'Apresentação sem título'): SlideDeckBundle {
  const s1 = createSlideFromLayout('title', 'azul-workspace', {
    title: deckTitle,
    subtitle: 'Clique para adicionar subtítulo',
  });
  return {
    themeId: 'azul-workspace',
    slides: [s1],
    comments: [],
    versions: [],
    showGrid: false,
    showNotes: true,
  };
}

export function createDefaultInvestorDeck(deckTitle = 'Apresentação Investidores — Série B'): SlideDeckBundle {
  const s1 = createSlideFromLayout('title', 'azul-workspace', {
    title: deckTitle,
    subtitle: 'Resultados Q1 2026 · Tração Enterprise & Roadmap Série B',
  });
  s1.notes = 'Abrir agradecendo a presença do conselho. Destacar o crescimento líquido de clientes enterprise no Q1.';

  const s2 = createSlideFromLayout('big_number', 'azul-workspace', {
    title: 'R$ 18,4M',
    subtitle: 'ARR consolidado no fechamento de Março/2026 com Net Revenue Retention de 128%',
  });
  s2.notes = 'Reforçar que 74% do crescimento veio de expansão orgânica dentro da base ativa.';

  const s3 = createSlideFromLayout('two_columns', 'azul-workspace', {
    title: 'Eficiência de Aquisição e Retenção',
  });
  s3.elements[1].content =
    'Métricas de Produto (Q1)\n\n• 42.800 usuários ativos semanais\n• Payback de CAC reduzido para 5,4 meses\n• Churn mensal abaixo de 0,9%';
  s3.elements[2].content =
    'Prioridades Q2 2026\n\n• Lançamento da Suíte Colaborativa Offline\n• Expansão Latam (México e Colômbia)\n• Certificação SOC 2 Type II completa';
  s3.notes = 'Comparar a queda de churn em relação ao trimestre anterior e detalhar os investimentos em SOC 2.';

  const s4 = createSlideFromLayout('title_body', 'azul-workspace', {
    title: 'Alocação de Capital da Rodada',
    body: '• 45% Engenharia de Plataforma, Segurança e Infraestrutura Real-Time\n• 30% Expansão Comercial Enterprise & Customer Success\n• 15% Parcerias Estratégicas & Ecossistema de Integrações\n• 10% Reserva Operacional e Capital de Giro',
  });
  s4.notes = 'Fechar com runway projetado de 26 meses após fechamento da Série B.';

  return {
    themeId: 'azul-workspace',
    slides: [s1, s2, s3, s4],
    comments: [
      {
        id: 'sc1',
        slideId: s2.id,
        author: 'Gabriel Silva',
        createdAt: 'Hoje às 10:15',
        text: 'Confirmado com o Financeiro: NRR fechou exatamente em 128,4%.',
        resolved: false,
      },
    ],
    versions: [
      {
        id: 'sv1',
        name: 'Versão Inicial — Conselho Q1',
        createdAt: 'Ontem às 18:20',
        author: 'Chrisllan Franco',
        slides: [s1, s2, s3, s4],
      },
    ],
    showGrid: false,
    showNotes: true,
  };
}

export const DECK_TEMPLATES: Array<{ id: string; title: string; subtitle: string; themeId: string; build: () => SlideDeckBundle }> = [
  {
    id: 'investor-pitch',
    title: 'Pitch de Investidores (Série B)',
    subtitle: 'Capa executiva, KPIs financeiros, comparativo e alocação de capital',
    themeId: 'azul-workspace',
    build: () => createDefaultInvestorDeck('Pitch Executivo — Série B'),
  },
  {
    id: 'product-roadmap',
    title: 'Roadmap de Produto Q2',
    subtitle: 'Estrutura clara para alinhamento de engenharia e design',
    themeId: 'escuro-minimalista',
    build: () => {
      const a = createSlideFromLayout('title', 'escuro-minimalista', {
        title: 'Roadmap de Produto Q2 2026',
        subtitle: 'Arquitetura, Experiência do Usuário & Metas Trimestrais',
      });
      const b = createSlideFromLayout('section_header', 'escuro-minimalista', {
        title: '01. Fundações Técnicas',
        subtitle: 'Desacoplamento de regras de negócio e testes automatizados ponta a ponta',
      });
      const c = createSlideFromLayout('two_columns', 'escuro-minimalista', {
        title: 'Entregas Principais do Trimestre',
      });
      return {
        themeId: 'escuro-minimalista',
        slides: [a, b, c],
        comments: [],
        versions: [],
        showGrid: false,
        showNotes: true,
      };
    },
  },
  {
    id: 'qbr-executivo',
    title: 'Revisão Trimestral (QBR)',
    subtitle: 'Visual claro corporativo para resultados de equipe e metas',
    themeId: 'claro-executivo',
    build: () => {
      const a = createSlideFromLayout('title', 'claro-executivo', {
        title: 'Quarterly Business Review — Q1',
        subtitle: 'Resultados Consolidados & Plano de Ação',
      });
      const b = createSlideFromLayout('big_number', 'claro-executivo', {
        title: '99,97%',
        subtitle: 'Disponibilidade média da plataforma em produção no trimestre',
      });
      const c = createSlideFromLayout('title_body', 'claro-executivo', {
        title: 'Principais Lições Aprendidas',
      });
      return {
        themeId: 'claro-executivo',
        slides: [a, b, c],
        comments: [],
        versions: [],
        showGrid: false,
        showNotes: true,
      };
    },
  },
];

export function insertSlideAfter(
  slides: SlidePage[],
  afterIndex: number,
  newSlide: SlidePage
): { slides: SlidePage[]; insertedIndex: number } {
  const safeIndex = Math.max(-1, Math.min(slides.length - 1, afterIndex));
  const next = [...slides];
  next.splice(safeIndex + 1, 0, newSlide);
  return { slides: next, insertedIndex: safeIndex + 1 };
}

export function duplicateSlideAt(
  slides: SlidePage[],
  index: number
): { slides: SlidePage[]; duplicatedIndex: number } {
  const source = slides[index];
  if (!source) return { slides, duplicatedIndex: Math.max(0, index) };
  const clone: SlidePage = {
    ...source,
    id: uid('slide'),
    elements: source.elements.map((el) => ({
      ...el,
      id: uid('el'),
      style: { ...el.style },
    })),
  };
  const res = insertSlideAfter(slides, index, clone);
  return { slides: res.slides, duplicatedIndex: res.insertedIndex };
}

export function deleteSlideAt(
  slides: SlidePage[],
  index: number,
  themeId = 'claro-executivo'
): { slides: SlidePage[]; nextIndex: number } {
  if (slides.length <= 1) {
    const replacement = createSlideFromLayout('title_body', themeId);
    return { slides: [replacement], nextIndex: 0 };
  }
  const next = slides.filter((_, i) => i !== index);
  const nextIndex = Math.max(0, Math.min(index, next.length - 1));
  return { slides: next, nextIndex };
}

export function reorderSlides(slides: SlidePage[], fromIndex: number, toIndex: number): SlidePage[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= slides.length ||
    toIndex >= slides.length
  ) {
    return slides;
  }
  const next = [...slides];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function applyThemeToSlides(slides: SlidePage[], themeId: string): SlidePage[] {
  const theme = getThemeById(themeId);
  return slides.map((slide) => ({
    ...slide,
    background: theme.background,
    elements: slide.elements.map((el, idx) => {
      const nextStyle: SlideElementStyle = {
        ...el.style,
        fontFamily: theme.fontFamily,
      };
      if (el.type === 'text') {
        const isHeadline = (el.style.fontSize || 18) >= 28 || idx === 0;
        nextStyle.color = isHeadline && (el.style.fontSize || 18) < 64 ? theme.titleColor : (el.style.fontSize || 18) >= 64 ? theme.accentColor : theme.bodyColor;
      } else if (el.type === 'shape') {
        nextStyle.backgroundColor = theme.surfaceColor;
        nextStyle.color = theme.bodyColor;
        if (nextStyle.borderWidth) {
          nextStyle.borderColor = theme.accentColor;
        }
      } else if (el.type === 'line') {
        nextStyle.backgroundColor = theme.accentColor;
      }
      return { ...el, style: nextStyle };
    }),
  }));
}

export function applyLayoutToSlide(
  slide: SlidePage,
  layout: SlideLayoutId,
  themeId: string
): SlidePage {
  const existingTexts = slide.elements
    .filter((e) => e.type === 'text' && e.content.trim())
    .map((e) => e.content.trim());
  const generated = createSlideFromLayout(layout, themeId, {
    title: existingTexts[0],
    subtitle: existingTexts[1],
    body: existingTexts[1],
  });
  return {
    ...generated,
    id: slide.id,
    background: slide.background,
    transition: slide.transition,
    notes: slide.notes,
  };
}

export function createElementForSlide(
  kind: 'text' | 'rectangle' | 'rounded' | 'circle' | 'pill' | 'callout' | 'line' | 'image',
  themeId: string,
  extra?: { imageUrl?: string; content?: string; zIndex?: number }
): SlideElement {
  const theme = getThemeById(themeId);
  const zIndex = extra?.zIndex ?? 10;

  if (kind === 'text') {
    return {
      id: uid('el'),
      type: 'text',
      content: extra?.content || 'Novo bloco de texto',
      x: 180,
      y: 200,
      w: 360,
      h: 72,
      style: {
        color: theme.titleColor,
        fontSize: 22,
        fontFamily: theme.fontFamily,
        fontWeight: 'medium',
        textAlign: 'left',
        zIndex,
      },
    };
  }

  if (kind === 'line') {
    return {
      id: uid('el'),
      type: 'line',
      content: '',
      x: 200,
      y: 268,
      w: 340,
      h: 4,
      style: {
        backgroundColor: theme.accentColor,
        borderRadius: 2,
        zIndex,
      },
    };
  }

  if (kind === 'image') {
    return {
      id: uid('el'),
      type: 'image',
      content: extra?.content || 'Imagem ilustrativa',
      imageUrl: extra?.imageUrl || '',
      x: 240,
      y: 120,
      w: 440,
      h: 280,
      style: {
        borderRadius: 12,
        opacity: 1,
        zIndex,
      },
    };
  }

  const radius =
    kind === 'circle' ? 999 : kind === 'pill' ? 999 : kind === 'rounded' || kind === 'callout' ? 16 : 2;
  return {
    id: uid('el'),
    type: 'shape',
    content: extra?.content ?? (kind === 'callout' ? 'Destaque importante' : ''),
    x: kind === 'circle' ? 380 : 280,
    y: kind === 'circle' ? 170 : 180,
    w: kind === 'circle' ? 180 : 320,
    h: kind === 'circle' ? 180 : 140,
    style: {
      backgroundColor: theme.accentColor,
      color: '#FFFFFF',
      fontSize: 18,
      fontFamily: theme.fontFamily,
      fontWeight: 'semibold',
      textAlign: 'center',
      borderRadius: radius,
      padding: 16,
      shapeKind: kind,
      zIndex,
    },
  };
}

export function alignElementInBounds(
  element: SlideElement,
  alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
): SlideElement {
  const margin = 48;
  switch (alignment) {
    case 'left':
      return { ...element, x: margin };
    case 'center':
      return { ...element, x: Math.round((SLIDE_CANVAS_WIDTH - element.w) / 2) };
    case 'right':
      return { ...element, x: Math.round(SLIDE_CANVAS_WIDTH - element.w - margin) };
    case 'top':
      return { ...element, y: margin };
    case 'middle':
      return { ...element, y: Math.round((SLIDE_CANVAS_HEIGHT - element.h) / 2) };
    case 'bottom':
      return { ...element, y: Math.round(SLIDE_CANVAS_HEIGHT - element.h - margin) };
  }
}

export function bringElementLayer(
  elements: SlideElement[],
  elementId: string,
  direction: 'front' | 'back'
): SlideElement[] {
  const target = elements.find((e) => e.id === elementId);
  if (!target) return elements;
  const others = elements.filter((e) => e.id !== elementId);
  const ordered = direction === 'front' ? [...others, target] : [target, ...others];
  return ordered.map((el, idx) => ({
    ...el,
    style: { ...el.style, zIndex: idx + 1 },
  }));
}

export function findAndReplaceInDeck(
  slides: SlidePage[],
  findText: string,
  replaceText: string,
  matchCase = false
): { slides: SlidePage[]; replacements: number } {
  if (!findText) return { slides, replacements: 0 };
  const flags = matchCase ? 'g' : 'gi';
  const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, flags);
  let replacements = 0;

  const updated = slides.map((slide) => {
    const nextNotes = slide.notes.replace(regex, () => {
      replacements += 1;
      return replaceText;
    });
    const nextElements = slide.elements.map((el) => {
      if (!el.content) return el;
      const nextContent = el.content.replace(regex, () => {
        replacements += 1;
        return replaceText;
      });
      return nextContent === el.content ? el : { ...el, content: nextContent };
    });
    return { ...slide, notes: nextNotes, elements: nextElements };
  });

  return { slides: updated, replacements };
}

export function computeDeckStats(slides: SlidePage[]): {
  slideCount: number;
  elementCount: number;
  wordCount: number;
  estimatedMinutes: number;
} {
  let elementCount = 0;
  let wordCount = 0;

  for (const slide of slides) {
    elementCount += slide.elements.length;
    const textChunks = [
      slide.notes,
      ...slide.elements.map((e) => e.content || ''),
    ]
      .join(' ')
      .trim();
    if (textChunks) {
      wordCount += textChunks.split(/\s+/).filter(Boolean).length;
    }
  }

  return {
    slideCount: slides.length,
    elementCount,
    wordCount,
    estimatedMinutes: Math.max(1, Math.ceil(slides.length * 1.5)),
  };
}

export function exportDeckToMarkdown(title: string, slides: SlidePage[]): string {
  const lines: string[] = [`# ${title}`, ''];
  slides.forEach((slide, idx) => {
    lines.push(`## Slide ${idx + 1} (${slide.layout})`);
    slide.elements.forEach((el) => {
      if (el.content && el.content.trim()) {
        lines.push(el.content.trim());
        lines.push('');
      }
    });
    if (slide.notes && slide.notes.trim()) {
      lines.push(`> **Notas do apresentador:** ${slide.notes.trim()}`);
      lines.push('');
    }
    lines.push('---', '');
  });
  return lines.join('\n');
}

export function isSafeSlideImageUrl(url: string): boolean {
  const trimmed = (url || '').trim();
  if (!trimmed) return false;
  if (/^https?:\/\/\S+$/i.test(trimmed)) return true;
  if (/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml)(;|,)/i.test(trimmed)) {
    // Reject embedded script tags inside SVG data URIs
    if (/svg\+xml/i.test(trimmed)) {
      try {
        const decoded = decodeURIComponent(trimmed);
        if (/<script\b|on\w+\s*=|javascript:/i.test(decoded)) return false;
      } catch {
        return false;
      }
    }
    return true;
  }
  return false;
}

export function toggleSkipSlide(slides: SlidePage[], index: number): SlidePage[] {
  if (index < 0 || index >= slides.length) return slides;
  return slides.map((s, idx) => (idx === index ? { ...s, skipped: !s.skipped } : s));
}

export function getPresentableSlideIndices(slides: SlidePage[]): number[] {
  const active = slides
    .map((s, idx) => (!s.skipped ? idx : -1))
    .filter((idx) => idx >= 0);
  if (active.length === 0 && slides.length > 0) {
    return slides.map((_, idx) => idx);
  }
  return active;
}

export function filterSlideComments(
  comments: SlideComment[],
  filter: 'open' | 'resolved' | 'all' = 'open'
): SlideComment[] {
  if (filter === 'all') return comments;
  if (filter === 'resolved') return comments.filter((c) => Boolean(c.resolved));
  return comments.filter((c) => !c.resolved);
}

export function toggleResolveSlideComment(
  comments: SlideComment[],
  commentId: string
): SlideComment[] {
  return comments.map((c) => (c.id === commentId ? { ...c, resolved: !c.resolved } : c));
}

export function addSlideCommentReply(
  comments: SlideComment[],
  commentId: string,
  author: string,
  text: string,
  createdAt = 'Agora'
): SlideComment[] {
  const clean = text.trim();
  if (!clean) return comments;
  return comments.map((c) => {
    if (c.id !== commentId) return c;
    const reply: SlideCommentReply = {
      id: `srep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      author,
      text: clean,
      createdAt,
    };
    return {
      ...c,
      replies: [...(c.replies || []), reply],
    };
  });
}

export function deleteSlideComment(
  comments: SlideComment[],
  commentId: string
): SlideComment[] {
  return comments.filter((c) => c.id !== commentId);
}

export function exportDeckToHtml(title: string, slides: SlidePage[]): string {
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const safeCssValue = (val: string, fallback: string) => {
    const clean = (val || '').trim();
    if (!clean || /[;"<>]|expression\s*\(|url\s*\(/i.test(clean)) return fallback;
    return clean;
  };

  const slideBlocks = slides
    .map((slide, i) => {
      const els = [...slide.elements]
        .sort((a, b) => (a.style.zIndex || 1) - (b.style.zIndex || 1))
        .map((el) => {
          const base = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;box-sizing:border-box;z-index:${el.style.zIndex || 1};opacity:${el.style.opacity ?? 1};`;
          if (el.type === 'image' && el.imageUrl && isSafeSlideImageUrl(el.imageUrl)) {
            return `<img src="${escapeHtml(el.imageUrl)}" alt="${escapeHtml(el.content || 'Slide image')}" style="${base}object-fit:cover;border-radius:${el.style.borderRadius || 0}px;" />`;
          }
          const borderCss = el.style.borderWidth
            ? `border:${el.style.borderWidth}px solid ${safeCssValue(el.style.borderColor || '#1A73E8', '#1A73E8')};`
            : '';
          const styleStr = `${base}${borderCss}background:${safeCssValue(el.style.backgroundColor || 'transparent', 'transparent')};color:${safeCssValue(el.style.color || '#111', '#111')};font-size:${el.style.fontSize || 18}px;font-family:${safeCssValue(el.style.fontFamily || 'sans-serif', 'sans-serif')};font-weight:${el.style.fontWeight || 'normal'};font-style:${el.style.fontStyle || 'normal'};text-decoration:${el.style.textDecoration || 'none'};text-align:${el.style.textAlign || 'left'};border-radius:${el.style.borderRadius || 0}px;padding:${el.style.padding || 0}px;white-space:pre-wrap;`;
          return `<div style="${styleStr}">${escapeHtml(el.content || '')}</div>`;
        })
        .join('');
      const safeBg = safeCssValue(slide.background, '#FFFFFF');
      return `<section style="position:relative;width:${SLIDE_CANVAS_WIDTH}px;height:${SLIDE_CANVAS_HEIGHT}px;background:${safeBg};margin:24px auto;overflow:hidden;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,0.16);" aria-label="Slide ${i + 1}">${els}</section>`;
    })
    .join('\n');

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title></head><body style="background:#f1f5f9;font-family:sans-serif;padding:24px;">${slideBlocks}</body></html>`;
}
