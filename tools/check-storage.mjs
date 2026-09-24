// 端末保存の独立テスト。実際のブラウザー保存や外部サービスは使わない。
import assert from 'node:assert/strict';
import { createStore, STORAGE_KEY } from '../storage.js';
import * as E from '../engine.js';
import * as R from '../rules.js';
import { readCandidates } from '../method.js';

const memory = () => {
  const map = new Map();
  return { getItem: k => map.get(k) ?? null, setItem: (k,v) => map.set(k,String(v)), removeItem: k => map.delete(k) };
};
const blocked = { getItem(){throw Error('blocked');}, setItem(){throw Error('quota');}, removeItem(){throw Error('blocked');} };
const birth = {y:1990,m:6,d:1,country:'JP',offset:null,timeMode:'exact',time:'12:30',nick:'テスト',city:'テスト市'};
function result(input=birth, focus='self') {
  const c=E.calcChart(input),e=readCandidates(c.candidates.map(E.starsOf));
  const out={focus,createdAt:'2025-04-09T01:00:00Z',versions:{calc:E.CALC_VERSION,rules:R.RULES_VERSION,app:'app-1.2-beta'},
    consult:R.FOCUS[focus].label,summary:e.summary,uniq:[...new Map(e.summaries.filter(Boolean).map(s=>[s.source,s])).values()],
    candidates:c.candidates.map(k=>[k.year.label,k.month.label,k.day.label,k.hour?.label??'―'].join('・')),starLine:'テストの星',split:'day'};
  if(new Set(c.candidates.map(k=>k.day.stem)).size>1)return out;
  const months=E.yearPlan(2025,4,c.candidates[0].day.stem).map(x=>{
    const star=E.TEN_GODS[x.after.god],beforeStar=E.TEN_GODS[x.before.god],yearStar=E.TEN_GODS[x.after.yearGod];
    const g=R.focusGroup(star,focus);
    return {key:`${x.y}-${String(x.m).padStart(2,'0')}`,y:x.y,m:x.m,last:new Date(x.y,x.m,0).getDate(),boundary:x.boundary,star,theme:g.theme,description:g.description,action:g.action,pillar:x.after.month.label,same:false,
      before:{star:beforeStar,theme:R.focusGroup(beforeStar,focus).theme,pillar:x.before.month.label},year:{star:yearStar,theme:R.focusGroup(yearStar,focus).theme,pillar:x.after.year.label}};
  });
  return {...out,split:e.summary?null:'time',dayStem:E.STEMS[c.candidates[0].day.stem],reason:'テスト',basics:e.basics,combos:e.combos,conditional:e.conditional,
    period:{start:{y:2025,m:4},end:{y:2026,m:3},label:'2025年4月〜2026年3月'},months,years:[{...months[0].year,from:null}],yearTheme:months[0].year.theme,
    headline:'テスト結果',answer:'テスト回答'};
}
const state = {input:birth,focus:'self',reading:result(),readings:{self:result(),love:result(birth,'love')},gridView:true,
  draft:{by:'DRAFT_SECRET'},reflections:{memo:'OLD_DIARY_SECRET'},fits:{example:'OLD_FIT_SECRET'},feeling:'yes',v:'app-1.2-beta'};
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log(`ok ${name}`);};

test('persists across instances; omits incomplete drafts and old free text',()=>{
  const local=memory(),session=memory();
  assert.deepEqual(createStore(local,session).saveState(state),{persistent:true});
  const loaded=createStore(local,memory()).loadState();
  assert.deepEqual(loaded.input,birth);assert.deepEqual(loaded.reading.period,state.reading.period);
  assert.deepEqual(loaded.reading.summary,state.reading.summary);assert.equal(loaded.readings.love.focus,'love');
  assert.deepEqual(Object.keys(loaded).sort(),['focus','gridView','input','reading','readings']);
  assert(!/DRAFT_SECRET|OLD_DIARY_SECRET|OLD_FIT_SECRET/.test(local.getItem(STORAGE_KEY)));
});
test('migrates all supported session versions, without recalculating dates or IDs',()=>{
  for(const v of ['app-1.0-beta','app-1.1-beta','app-1.2-beta']){
    const local=memory(),session=memory();session.setItem('meimon',JSON.stringify({...state,v}));
    const got=createStore(local,session).loadState();assert.deepEqual(got.reading.period,state.reading.period);assert.equal(got.reading.createdAt,state.reading.createdAt);assert.equal(got.reading.summary.source,state.reading.summary.source);
    assert(local.getItem(STORAGE_KEY));assert.equal(session.getItem('meimon'),null);
  }
});
test('app version updates do not reset persisted data; persistent beats legacy',()=>{
  const local=memory(),session=memory(),store=createStore(local,session);store.saveState({...state,v:'app-9.0-beta'});
  session.setItem('meimon',JSON.stringify({...state,input:{...birth,d:2},v:'app-1.2-beta'}));
  assert.equal(createStore(local,session).loadState().input.d,1);
});
test('delete removes personal data and blocks stale legacy migration in another tab',()=>{
  const local=memory(),session=memory(),otherSession=memory(),store=createStore(local,session);
  store.saveState(state);otherSession.setItem('meimon',JSON.stringify(state));
  assert.deepEqual(store.clearState(),{cleared:true});assert.equal(store.loadState(),null);
  assert.equal(createStore(local,otherSession).loadState(),null);
  assert(!local.getItem(STORAGE_KEY).includes('input'));assert(!session.getItem(STORAGE_KEY).includes('input'));
  store.saveState(state);assert.equal(store.loadState().input.d,1);
});
test('corrupt JSON, unknown schema and invalid dates are rejected',()=>{
  const local=memory(),session=memory();
  for(const value of ['broken','null',JSON.stringify({schema:99,updatedAt:1,data:state}),JSON.stringify({schema:1,updatedAt:1,data:{...state,input:{...birth,m:2,d:30}}})]){
    local.setItem(STORAGE_KEY,value);assert.equal(createStore(local,session).loadState(),null);
  }
  session.setItem('meimon',JSON.stringify({...state,v:'unknown-version'}));assert.equal(createStore(memory(),session).loadState(),null);
});
test('invalid reading is dropped while valid birth input remains',()=>{
  const local=memory(),store=createStore(local,memory());store.saveState({...state,reading:{...state.reading,months:[]},readings:{love:{hello:'bad'}}});
  const got=store.loadState();assert.deepEqual(got.input,birth);assert.equal(got.reading,null);assert.deepEqual(got.readings,{});
});
test('quota fallback survives new instances in the same session',()=>{
  const session=memory();assert.deepEqual(createStore(blocked,session).saveState(state),{persistent:false});
  assert.deepEqual(createStore(blocked,session).loadState().input,birth);
});
test('new fallback takes precedence over older persistent copy',()=>{
  const local=memory(),session=memory();createStore(local,session).saveState(state);
  const quota={...local,setItem(){throw Error('quota');}};
  createStore(quota,session).saveState({...state,focus:'love'});
  assert.equal(createStore(quota,session).loadState().focus,'love');
});
test('both stores blocked does not throw; failed deletion is reported',()=>{
  const store=createStore(blocked,blocked);assert.equal(store.loadState(),null);assert.deepEqual(store.saveState(state),{persistent:false});assert.deepEqual(store.clearState(),{cleared:false});
});
test('failed migration write keeps original legacy source',()=>{
  const session=memory();session.setItem('meimon',JSON.stringify(state));
  const writeBlocked={...session,setItem(){throw Error('quota');}};
  assert.deepEqual(createStore(blocked,writeBlocked).loadState().input,birth);assert(session.getItem('meimon'));
});
test('day/time splits preserve candidates, selected IDs and period',()=>{
  for(const extra of [{timeMode:'range',from:'00:00',to:'23:59',toNextDay:false},{timeMode:'range',from:'23:00',to:'01:00',toNextDay:true}]){
    const input={...birth,...extra};delete input.time;const reading=result(input);
    const local=memory(),store=createStore(local,memory());store.saveState({...state,input,reading,readings:{}});
    const got=store.loadState().reading;assert(got);assert.equal(got.split,reading.split);assert.deepEqual(got.candidates,reading.candidates);assert.deepEqual(got.period,reading.period);
  }
});
test('monthly conclusion and example survive a fresh store instance',()=>{
  const local=memory(),reading=result();
  reading.months[0].conclusion='人との時間を大切に';
  reading.months[0].example='短い会話でも、相手の話を聞いてみてください。';
  createStore(local,memory()).saveState({...state,reading});
  const got=createStore(local,memory()).loadState().reading.months[0];
  assert.equal(got.conclusion,reading.months[0].conclusion);
  assert.equal(got.example,reading.months[0].example);
});
test('a stale tab cannot restore deleted data, even after another tab saves new input',()=>{
  const local=memory(),sessionA=memory(),sessionB=memory();
  const a=createStore(local,sessionA),b=createStore(local,sessionB);
  a.saveState(state);const stale=b.loadState();
  a.clearState();const deleted=local.getItem(STORAGE_KEY);
  assert.deepEqual(b.saveState(stale),{persistent:false,conflict:true});
  assert.equal(local.getItem(STORAGE_KEY),deleted);assert.equal(sessionB.getItem(STORAGE_KEY),null);
  assert.equal(a.loadState(),null);
  a.saveState({...state,input:{...birth,d:2}});
  assert.deepEqual(b.saveState(stale),{persistent:false,conflict:true});
  const fresh=b.loadState();assert.equal(fresh.input.d,2);
  assert.deepEqual(b.saveState({...fresh,focus:'love'}),{persistent:true});
  assert.equal(a.loadState().input.d,2);
});
test('deletion generation beats a stale fallback with a later clock timestamp',()=>{
  const local=memory(),sessionA=memory(),sessionB=memory();
  const a=createStore(local,sessionA);a.saveState(state);
  const old=JSON.parse(local.getItem(STORAGE_KEY));old.updatedAt+=100000;
  sessionB.setItem(STORAGE_KEY,JSON.stringify(old));
  a.clearState();assert.equal(createStore(local,sessionB).loadState(),null);
});
test('old envelopes without generation still load and old deletion marks still block migration',()=>{
  const local=memory(),session=memory();
  local.setItem(STORAGE_KEY,JSON.stringify({schema:1,updatedAt:100,data:state}));
  assert.equal(createStore(local,session).loadState().input.d,1);
  local.setItem(STORAGE_KEY,JSON.stringify({schema:1,updatedAt:101,deleted:true}));
  session.setItem('meimon',JSON.stringify(state));
  assert.equal(createStore(local,session).loadState(),null);
});
test('HTML in result text and invalid optional field types are rejected on load',()=>{
  const mutations=[
    r=>r.summary.move='<img src=x onerror=alert(1)>',
    r=>r.uniq[0].burden='<svg onload=alert(1)>',
    r=>r.reason={toString:null},
    r=>r.basics[0].detail={toString:null},
    r=>r.basics[0].ask=['not','text'],
    r=>r.months[0].description={toString:null},
    r=>r.months[0].conclusion='<script>alert(1)</script>',
    r=>r.months[0].example=12,
    r=>r.months[0].before.theme='<img src=x>',
    r=>r.months[0].year.action='<img src=x>',
    r=>r.period.label='<img src=x>',
    r=>r.versions.presentation={toString:null},
    r=>r.candidates[0]='<img src=x>',
    r=>r.years[0].theme={toString:null},
  ];
  for(const mutate of mutations){
    const local=memory(),reading=structuredClone(state.reading);mutate(reading);
    local.setItem(STORAGE_KEY,JSON.stringify({schema:1,updatedAt:1,data:{...state,reading,readings:{}}}));
    const got=createStore(local,memory()).loadState();
    assert.deepEqual(got.input,birth);assert.equal(got.reading,null);
  }
});
test('optional copy fields may be absent in an older result',()=>{
  const reading=structuredClone(state.reading);
  delete reading.reason;delete reading.yearTheme;
  reading.months.forEach(m=>{delete m.description;delete m.conclusion;delete m.example;});
  reading.basics.forEach(b=>{delete b.ask;delete b.hypothesis;delete b.detail;});
  const local=memory(),store=createStore(local,memory());store.saveState({...state,reading});
  assert.deepEqual(store.loadState().reading.period,reading.period);
});
console.log(JSON.stringify({result:'ok',checks}));
