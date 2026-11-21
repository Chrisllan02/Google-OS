import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultInvestorDeck,
  createSlideFromLayout,
  insertSlideAfter,
  duplicateSlideAt,
  deleteSlideAt,
  reorderSlides,
  applyThemeToSlides,
  applyLayoutToSlide,
  createElementForSlide,
  alignElementInBounds,
  bringElementLayer,
  findAndReplaceInDeck,
  computeDeckStats,
  exportDeckToMarkdown,
  exportDeckToHtml,
  isSafeSlideImageUrl,
  toggleSkipSlide,
  getPresentableSlideIndices,
  filterSlideComments,
  toggleResolveSlideComment,
  addSlideCommentReply,
  deleteSlideComment,
  SLIDE_CANVAS_WIDTH,
  SLIDE_CANVAS_HEIGHT,
} from './slidesLogic';

test('createDefaultInvestorDeck seeds valid 16:9 presentation slides with notes and elements', () => {
  const deck = createDefaultInvestorDeck('Apresentação Série B');
  assert.equal(deck.slides.length, 4);
  assert.equal(deck.slides[0].elements[0].content, 'Apresentação Série B');
  assert.ok(deck.slides[0].notes.length > 0);
  assert.equal(deck.comments.length, 1);
});

test('slide insertion, duplication, reordering, and deletion preserve deck integrity', () => {
  const deck = createDefaultInvestorDeck('Deck Teste');
  const sNew = createSlideFromLayout('two_columns', deck.themeId, { title: 'Novo Comparativo' });

  const inserted = insertSlideAfter(deck.slides, 0, sNew);
  assert.equal(inserted.slides.length, 5);
  assert.equal(inserted.insertedIndex, 1);
  assert.equal(inserted.slides[1].elements[0].content, 'Novo Comparativo');

  const duplicated = duplicateSlideAt(inserted.slides, 1);
  assert.equal(duplicated.slides.length, 6);
  assert.equal(duplicated.slides[2].elements[0].content, 'Novo Comparativo');
  assert.notEqual(duplicated.slides[1].id, duplicated.slides[2].id);

  const reordered = reorderSlides(duplicated.slides, 2, 0);
  assert.equal(reordered[0].elements[0].content, 'Novo Comparativo');

  const deleted = deleteSlideAt(reordered, 0, deck.themeId);
  assert.equal(deleted.slides.length, 5);

  // Deleting the last remaining slide generates a clean fallback slide instead of empty deck
  const single = deleteSlideAt([reordered[0]], 0, deck.themeId);
  assert.equal(single.slides.length, 1);
});

test('applyThemeToSlides and applyLayoutToSlide preserve existing slide text and update styling', () => {
  const slide = createSlideFromLayout('title', 'claro-executivo', {
    title: 'Plano Anual',
    subtitle: 'Engenharia e Produto',
  });

  const relaid = applyLayoutToSlide(slide, 'title_body', 'claro-executivo');
  assert.equal(relaid.layout, 'title_body');
  assert.equal(relaid.elements[0].content, 'Plano Anual');

  const themed = applyThemeToSlides([relaid], 'escuro-minimalista');
  assert.equal(themed[0].background, '#0F172A');
  assert.equal(themed[0].elements[0].style.color, '#F8FAFC');
});

test('element creation, alignment, z-index layering, findAndReplaceInDeck, stats, and export work cleanly', () => {
  const el = createElementForSlide('rectangle', 'claro-executivo', { content: 'Card KPI Q1' });
  const centered = alignElementInBounds(el, 'center');
  assert.equal(centered.x, Math.round((SLIDE_CANVAS_WIDTH - el.w) / 2));

  const middle = alignElementInBounds(centered, 'middle');
  assert.equal(middle.y, Math.round((SLIDE_CANVAS_HEIGHT - el.h) / 2));

  const el2 = createElementForSlide('text', 'claro-executivo', { content: 'Texto Q1' });
  const layered = bringElementLayer([el, el2], el.id, 'front');
  assert.equal(layered[1].id, el.id);
  assert.equal(layered[1].style.zIndex, 2);

  const slide = {
    ...createSlideFromLayout('blank', 'claro-executivo'),
    notes: 'Revisar meta Q1',
    elements: layered,
  };

  const replaced = findAndReplaceInDeck([slide], 'Q1', 'Q2', true);
  assert.equal(replaced.replacements, 3);
  assert.equal(replaced.slides[0].notes, 'Revisar meta Q2');

  const stats = computeDeckStats(replaced.slides);
  assert.equal(stats.slideCount, 1);
  assert.equal(stats.elementCount, 2);
  assert.ok(stats.wordCount >= 8);

  const md = exportDeckToMarkdown('Deck Export', replaced.slides);
  assert.ok(md.includes('# Deck Export'));
  assert.ok(md.includes('Notas do apresentador'));

  const html = exportDeckToHtml('Deck Export', replaced.slides);
  assert.ok(html.includes('Card KPI Q2'));
});

test('isSafeSlideImageUrl validates URLs and exportDeckToHtml strips unsafe image protocols', () => {
  assert.equal(isSafeSlideImageUrl('https://images.example.com/chart.png'), true);
  assert.equal(isSafeSlideImageUrl('data:image/png;base64,iVBORw0KGgo='), true);
  assert.equal(isSafeSlideImageUrl('data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E'), true);
  assert.equal(isSafeSlideImageUrl('javascript:alert(1)'), false);
  assert.equal(isSafeSlideImageUrl('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(
    isSafeSlideImageUrl('data:image/svg+xml;utf8,%3Csvg%3E%3Cscript%3Ealert(1)%3C/script%3E%3C/svg%3E'),
    false
  );

  const slide = createSlideFromLayout('blank', 'claro-executivo');
  slide.elements.push(
    createElementForSlide('image', 'claro-executivo', {
      imageUrl: 'javascript:alert(1)',
      content: 'Malicioso',
    })
  );
  const html = exportDeckToHtml('Safe Deck', [slide]);
  assert.equal(html.includes('javascript:'), false);
});

test('toggleSkipSlide and getPresentableSlideIndices manage skipped slides during presentation', () => {
  const deck = createDefaultInvestorDeck('Skip Test');
  assert.deepEqual(getPresentableSlideIndices(deck.slides), [0, 1, 2, 3]);

  const skipped1 = toggleSkipSlide(deck.slides, 1);
  assert.equal(skipped1[1].skipped, true);
  assert.deepEqual(getPresentableSlideIndices(skipped1), [0, 2, 3]);

  // If all slides are skipped, fallback returns all indices so presentation never crashes
  const allSkipped = skipped1.map((s) => ({ ...s, skipped: true }));
  assert.deepEqual(getPresentableSlideIndices(allSkipped), [0, 1, 2, 3]);
});

test('slide comment lifecycle helpers filter, resolve/reopen, reply, and delete cleanly', () => {
  const deck = createDefaultInvestorDeck('Comments Test');
  const initial = deck.comments;
  assert.equal(filterSlideComments(initial, 'open').length, 1);
  assert.equal(filterSlideComments(initial, 'resolved').length, 0);

  const withReply = addSlideCommentReply(initial, 'sc1', 'Chrisllan', 'Aprovado!', 'Agora');
  assert.equal(withReply[0].replies?.length, 1);
  assert.equal(withReply[0].replies?.[0].text, 'Aprovado!');

  const resolved = toggleResolveSlideComment(withReply, 'sc1');
  assert.equal(filterSlideComments(resolved, 'open').length, 0);
  assert.equal(filterSlideComments(resolved, 'resolved').length, 1);

  const reopened = toggleResolveSlideComment(resolved, 'sc1');
  assert.equal(filterSlideComments(reopened, 'open').length, 1);

  const deleted = deleteSlideComment(reopened, 'sc1');
  assert.equal(deleted.length, 0);
});
