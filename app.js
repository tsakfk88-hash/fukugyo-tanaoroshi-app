'use strict';
const {questions, KEY, fresh, restore, answerText, exportText, stepQuestions, planQuestions, valueText, exportPlanText, chatPrompt, nextClarification, situations, inventoryQuestions, firstStepQuestions, questionExamples, allQuestions} = window.Inventory;
const el = id => document.getElementById(id);
let state = fresh();
let loadProblem = false;
try { state = restore(localStorage.getItem(KEY)); } catch { loadProblem = true; }
function status(message) { el('save-status').textContent = message; }
function save() {
  if (loadProblem) { status('保存データを読み込めませんでした。元のデータを保護するため、削除するまで自動保存を停止しています。テキスト保存は利用できます。'); return; }
  try { localStorage.setItem(KEY, JSON.stringify(state)); status('✓ このブラウザに保存済み'); }
  catch { status('ブラウザに保存できません。ページを閉じる前にテキストで保存してください。'); }
}
function renderExamples(prefix,q) {
  el(prefix+'-examples').open=false;
  el(prefix+'-example-list').replaceChildren();
  for(const example of questionExamples(state,q)) {const item=document.createElement('li');item.textContent=example;el(prefix+'-example-list').append(item);}
}
function render(focus = false) {
  const view=state.situation ? state.view : 'situation';
  const panels = {situation:'situation-panel',question:'question-panel', summary:'summary-panel', clarification:'clarification-panel', step:'planning-panel', experiment:'planning-panel', sheet:'sheet-panel'};
  for (const id of new Set(Object.values(panels))) el(id).hidden = panels[view] !== id;
  el('show-summary').hidden = view === 'summary' || view === 'situation';
  el('situation-row').hidden=view==='situation';el('situation-label').textContent=state.situation ? situations[state.situation] : '';
  document.querySelectorAll('.stages span').forEach((node, i) => { node.classList.toggle('active', (view === 'question' || view === 'clarification') && i === inventoryQuestions(state)[state.index].stage); });
  let title;
  if (view === 'situation') {title='situation-title';}
  else if (view === 'summary') { renderSummary(); title = 'summary-title'; }
  else if (view === 'sheet') { renderSheet(); title = 'sheet-title'; }
  else if (view === 'step' || view === 'experiment') { renderPlanning(); title = 'planning-title'; }
  else if (view === 'clarification') {
    const c = state.clarifications.find(item => item.id === state.activeClarification);
    el('clarification-title').textContent = c.prompt;
    el('clarification-original').textContent = '元の回答：' + answerText(state,c.id);
    el('clarification-answer').value = c.answer;
    renderExamples('clarification',allQuestions.find(q=>q.id===c.id));
    title = 'clarification-title';
  } else {
    const q = inventoryQuestions(state)[state.index];
    el('stage-label').textContent = ['01 / 過去の経験', '02 / 今の生活', '03 / 次の実験'][q.stage];
    el('count').textContent = `${state.index + 1} / ${inventoryQuestions(state).length}`;
    el('progress').max=inventoryQuestions(state).length;el('progress').value = state.index + 1;
    el('question-title').textContent = q.title;
    el('question-help').textContent = q.help;
    el('answer').value = state.answers[q.id] || '';
    el('back').disabled = state.index === 0;
    el('next').textContent = state.index === inventoryQuestions(state).length - 1 ? '回答をまとめる →' : '次へ →';
    renderExamples('question',q);
    title = 'question-title';
  }
  if (focus) el(title).focus();
}
function planningFields() {
  if(state.view==='step') return firstStepQuestions(state);
  const source={undecided:'candidates',ready:'chosenBusiness',active:'currentBusiness'}[state.situation];
  return planQuestions.map(q=>q.id==='business' && source && Object.hasOwn(state.answers,source) ? {...q,source} : q);
}
function planningValues() { return state.view === 'step' ? state.step : state.plan; }
function renderPlanning() {
  const fields = planningFields(); const q = fields[state.planningIndex];
  el('planning-stage').textContent = state.view === 'step' ? '04 / 次の一歩を決める' : '05 / 実験計画を作る';
  el('planning-count').textContent = `${state.planningIndex + 1} / ${fields.length}`;
  el('planning-title').textContent = q.title; el('planning-help').textContent = q.help;
  el('planning-answer').value = planningValues()[q.id] || '';
  el('planning-next').textContent = state.planningIndex < fields.length-1 ? '次へ →' : state.view === 'step' ? 'この一歩で完了する →' : '計画シートを見る →';
  renderExamples('planning',q);el('finish-step').hidden=state.view!=='step';
  const source = q.source && state.answers[q.source];
  el('planning-reference').hidden = !source || !source.trim();
  el('reference-text').textContent = source ? '棚卸しでの回答：' + source : '';
}
function appendSheetSection(title,fields,values,edit) {
  const heading = document.createElement('h3'); heading.textContent = title; el('sheet-list').append(heading);
  fields.forEach((q,index) => {
    const article = document.createElement('article'); article.className = 'summary-item';
    const header = document.createElement('div'); header.className = 'summary-heading';
    const label = document.createElement('h3'); label.textContent = q.title;
    const button = document.createElement('button'); button.textContent = '編集'; button.className = 'text-button'; button.setAttribute('aria-label',q.title+'を編集');
    button.addEventListener('click',() => edit(index));
    const value = document.createElement('p'); value.className = 'response'; value.textContent = valueText(values,q.id);
    header.append(label,button); article.append(header,value); el('sheet-list').append(article);
  });
}
function navigate(view,index=0) { state.view = view; state.planningIndex = index; save(); render(true); }
function renderSheet() {
  el('sheet-list').replaceChildren();
  el('sheet-title').textContent=state.planEnabled ? '自分の実験計画シート' : '自分の最初の一歩シート';
  el('download-sheet').textContent='シートをテキスト保存';
  appendSheetSection('次の一歩',firstStepQuestions(state),state.step,i=>navigate('step',i));
  if(state.planEnabled) appendSheetSection('実験計画（任意）',planQuestions,state.plan,i=>{state.planEnabled=true;navigate('experiment',i);});
  else if(Object.keys(state.plan).length) appendSheetSection('以前の実験計画（今回とは別に保管）',planQuestions,state.plan,i=>{state.planEnabled=true;navigate('experiment',i);});
  appendSheetSection('今回の棚卸し',inventoryQuestions(state),state.answers,i=>{state.index=i;state.view='question';save();render(true);});
  if (state.clarifications.length) {
    const heading = document.createElement('h3'); heading.textContent = '追加の確認'; el('sheet-list').append(heading);
    state.clarifications.forEach(c=>{
      const title = document.createElement('h3'); title.textContent = c.prompt;
      const value = document.createElement('p'); value.className = 'response'; value.textContent = valueText(c,'answer');
      const edit = document.createElement('button'); edit.textContent = '編集'; edit.className='text-button';
      edit.addEventListener('click',()=>{state.index=Math.max(0,inventoryQuestions(state).findIndex(q=>q.id===c.id));state.activeClarification=c.id;navigate('clarification');});
      el('sheet-list').append(title,value,edit);
    });
  }
  appendArchived(el('sheet-list'));
  el('optional-plan').open=false;
  el('prompt-text').hidden = true; el('copy-status').textContent = '';
}
function advanceQuestion() {
  state.activeClarification = null;
  if (state.index === inventoryQuestions(state).length - 1) state.view = 'summary'; else { state.index++; state.view='question'; }
  save(); render(true);
}
function setUnknown(field,setValue) {
  if (field.value.trim() && field.value !== '分からない') { status('入力済みの回答を変える場合は、回答欄を空にしてから押してください。'); return; }
  field.value = '分からない'; setValue('分からない'); save(); field.focus();
}
function appendArchived(list) {
  const fields=allQuestions.filter(q=>!inventoryQuestions(state).some(current=>current.id===q.id) && Object.hasOwn(state.answers,q.id));
  if(!fields.length) return;
  const details=document.createElement('details');const title=document.createElement('summary');title.textContent='以前の回答（今回の質問にない項目）';details.append(title);
  fields.forEach(q=>{const label=document.createElement('h3');label.textContent=q.title;const value=document.createElement('p');value.className='response';value.textContent=answerText(state,q.id);details.append(label,value);});list.append(details);
}
function renderSummary() {
  const list = el('summary-list');
  list.replaceChildren();
  inventoryQuestions(state).forEach((q, index) => {
    const article = document.createElement('article'); article.className = 'summary-item';
    const header = document.createElement('div'); header.className = 'summary-heading';
    const title = document.createElement('h3'); title.textContent = q.title;
    const edit = document.createElement('button'); edit.className = 'text-button'; edit.textContent = '編集'; edit.setAttribute('aria-label', `${q.title}を編集`);
    edit.addEventListener('click', () => { state.index = index; state.view = 'question'; save(); render(true); });
    const body = document.createElement('p'); body.textContent = answerText(state, q.id); body.className = 'response';
    header.append(title, edit); article.append(header, body);
    const clarification = state.clarifications.find(c=>c.id===q.id);
    if (clarification) {
      const label=document.createElement('p');label.className='help';label.textContent=clarification.prompt;
      const answer=document.createElement('p');answer.className='response';answer.textContent='補足：'+valueText(clarification,'answer');
      const button=document.createElement('button');button.className='text-button';button.textContent='補足を編集';
      button.addEventListener('click',()=>{state.index=index;state.activeClarification=q.id;navigate('clarification');});
      article.append(label,answer,button);
    }
    list.append(article);
  });
  appendArchived(list);
}
for(const situation of Object.keys(situations)) {
  el('choose-'+situation).addEventListener('click',()=>{
    const oldQuestion=inventoryQuestions(state)[state.index];
    const wasChanging=state.view==='situation';
    state.situation=situation;
    state.index=Math.max(0,inventoryQuestions(state).findIndex(q=>q.id===oldQuestion.id));
    if(wasChanging) {state.index=0;state.view='question';}
    save();render(true);
  });
}
el('change-situation').addEventListener('click',()=>navigate('situation'));
el('answer').addEventListener('input', () => { state.answers[inventoryQuestions(state)[state.index].id] = el('answer').value; save(); });
el('unknown').addEventListener('click', () => {
  if (el('answer').value.trim() && el('answer').value !== '分からない') { status('入力済みの回答を「分からない」に変える場合は、回答欄を空にしてから押してください。'); return; }
  state.answers[inventoryQuestions(state)[state.index].id] = '分からない'; el('answer').value = '分からない'; save(); el('answer').focus();
});
el('back').addEventListener('click', () => { if (state.index > 0) state.index--; save(); render(true); });
el('next').addEventListener('click', () => {
  const c = nextClarification(state);
  if (c) { state.clarifications.push(c); state.activeClarification=c.id; state.view='clarification'; save(); render(true); }
  else advanceQuestion();
});
el('clarification-answer').addEventListener('input',()=>{state.clarifications.find(c=>c.id===state.activeClarification).answer=el('clarification-answer').value;save();});
el('clarification-unknown').addEventListener('click',()=>setUnknown(el('clarification-answer'),value=>{state.clarifications.find(c=>c.id===state.activeClarification).answer=value;}));
el('clarification-back').addEventListener('click',()=>navigate('question'));
el('clarification-next').addEventListener('click',advanceQuestion);
el('start-step').addEventListener('click',()=>navigate('step'));
el('planning-answer').addEventListener('input',()=>{planningValues()[planningFields()[state.planningIndex].id]=el('planning-answer').value;save();});
el('planning-unknown').addEventListener('click',()=>setUnknown(el('planning-answer'),value=>{planningValues()[planningFields()[state.planningIndex].id]=value;}));
el('use-reference').addEventListener('click',()=>{
  const q=planningFields()[state.planningIndex];
  if (!q.source || !state.answers[q.source]) return;
  if ((planningValues()[q.id] || '').trim()) { status('入力済みの計画を変える場合は、回答欄を空にしてから押してください。'); return; }
  planningValues()[q.id]=state.answers[q.source];save();render();
});
el('planning-back').addEventListener('click',()=>{
  if (state.planningIndex>0) {state.planningIndex--;save();render(true);}
  else if (state.view==='step') navigate('summary'); else navigate('step',stepQuestions.length-1);
});
el('planning-next').addEventListener('click',()=>{
  if (state.planningIndex<planningFields().length-1) {state.planningIndex++;save();render(true);}
  else {if(state.view==='step')state.planEnabled=false;navigate('sheet');}
});
el('view-sheet').addEventListener('click',()=>navigate('sheet'));
el('edit-step').addEventListener('click',()=>navigate('step'));
el('edit-plan').addEventListener('click',()=>{state.planEnabled=true;navigate('experiment');});
el('omit-plan').addEventListener('click',()=>{state.planEnabled=false;navigate('sheet');});
el('finish-step').addEventListener('click',()=>{state.planEnabled=false;navigate('sheet');});
el('sheet-summary').addEventListener('click',()=>navigate('summary'));
el('copy-prompt').addEventListener('click',async()=>{
  const text=chatPrompt(state);el('prompt-text').value=text;el('prompt-text').hidden=false;
  try {
    if (!window.navigator?.clipboard?.writeText) throw new Error('コピー機能なし');
    await window.navigator.clipboard.writeText(text);el('copy-status').textContent='コピーしました。貼り付ける前に内容をご確認ください。';
  } catch {el('prompt-text').focus();el('prompt-text').select();el('copy-status').textContent='自動コピーを利用できません。選択した文章をMacではCommand+Cでコピーしてください。';}
});
el('show-summary').addEventListener('click', () => { state.view = 'summary'; save(); render(true); });
el('return').addEventListener('click', () => { state.view = 'question'; save(); render(true); });
function downloadText(text,name) {
  const blob = new Blob(['\uFEFF', text], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
el('download').addEventListener('click',()=>downloadText(exportText(state),'副業棚卸し.txt'));
el('download-sheet').addEventListener('click',()=>downloadText(exportPlanText(state),state.planEnabled?'自分の実験計画シート.txt':'自分の最初の一歩シート.txt'));
el('reset').addEventListener('click', () => el('reset-dialog').showModal());
el('cancel-reset').addEventListener('click', () => el('reset-dialog').close());
el('confirm-reset').addEventListener('click', () => {
  try { localStorage.removeItem(KEY); state = fresh(); loadProblem = false;
    for(const id of ['answer','planning-answer','clarification-answer','prompt-text']) el(id).value='';
    el('summary-list').replaceChildren();el('sheet-list').replaceChildren();
    status('回答を削除しました。'); }
  catch { status('保存データを削除できませんでした。ブラウザの設定からサイトのデータを削除してください。'); }
  el('reset-dialog').close(); render(true);
});
render();
if (loadProblem) save();
else status(Object.keys(state.answers).length ? '✓ 保存していた回答を再開しました' : '入力すると自動で保存されます');
window.addEventListener('storage', event => {
  if (loadProblem) return;
  if (event.key === KEY || event.key === null) {
    try { if (localStorage.getItem(KEY) !== (event.key === null ? null : event.newValue)) return; } catch { return; }
    status('別のタブで保存データが変更されました。このタブの入力を続ける前に再読み込みしてください。'); loadProblem = true; }
});
