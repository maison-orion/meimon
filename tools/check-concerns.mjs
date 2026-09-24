// 悩みによる表示の切り替え。暦・本質の分類とは独立した表であることを確認する。
import assert from 'node:assert/strict';
import { FOCUS, GROUPS, focusGroup, groupOf } from '../rules.js';
import { TEN_GODS } from '../engine.js';
assert.equal(new Set(Object.values(FOCUS).map(x=>x.category)).size,5);
for(const [key,f] of Object.entries(FOCUS)) {
  assert.ok(f.category && f.label && f.headline && f.question);
  for(const star of TEN_GODS){
    const base=groupOf(star), got=focusGroup(star,key);
    assert.equal(got.id,base.id);assert.deepEqual(got.stars,base.stars);
    assert.ok(got.theme && got.action);
    assert.ok(!/undefined|NaN/.test(f.link(got.theme)+f.answer({env:'会話の後に休める場所',burden:'予定が急に変わること',move:'自分のペースで進める'},got.theme)));
  }
}
for(const key of ['love','relations','money','self']) {
  const results=Object.values(GROUPS).map(g=>focusGroup(g.stars[0],key));
  assert.equal(new Set(results.map(g=>g.theme)).size,5);
  assert.ok(results.every(g=>!/(今の仕事|職場|本業|成果物|仕様)/.test(g.action)));
}
for(const g of Object.values(GROUPS)) assert.equal(focusGroup(g.stars[0],'fit').action,g.action);
console.log(JSON.stringify({result:'ok',focuses:Object.keys(FOCUS).length,categories:5}));
