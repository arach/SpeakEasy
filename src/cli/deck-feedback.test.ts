import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const html = readFileSync(new URL('../../deck/index.html', import.meta.url), 'utf8');
const levelCode = html.slice(html.indexOf('function microphoneLevel('), html.indexOf('function inputMeterHtml('));
const level = vm.runInNewContext(levelCode + '; microphoneLevel');
test('microphone meter rejects the noise floor and bounds loud input', () => {
  expect(level(new Float32Array())).toBe(0);
  expect(level(new Float32Array(32).fill(.003))).toBe(0);
  expect(level(new Float32Array([.1, -.1]))).toBeCloseTo(.864);
  expect(level(new Float32Array([1, -1]))).toBe(1);
});
const cueCode = html.slice(html.indexOf('function playCue('), html.indexOf('function microphoneLevel('));
test('feedback never sounds over recording, when muted, or in a hidden tab', () => {
  for (const overrides of [{webCapture:{}}, {S:{listening:true,vol:1}}, {cuesEnabled:false}, {document:{hidden:true}}]) {
    let oscillators = 0;
    const context = {cuesEnabled:true, cueContext:{state:'running',createOscillator(){oscillators++;throw new Error('unexpected');}},webCapture:null,S:{listening:false,vol:1},document:{hidden:false},...overrides};
    vm.runInNewContext(cueCode + "; playCue('accepted');",context);
    expect(oscillators).toBe(0);
  }
});
const markersCode = html.slice(html.indexOf('function nextReplyMarkers('), html.indexOf('function applySnapshot('));
const markers = vm.runInNewContext(markersCode + '; nextReplyMarkers');
test('reply waiting ignores history, tracks background replies, and clears on reading or rebind', () => {
  const lanes = [{sessionAlias:'a'}, {sessionAlias:'b'}];
  const reply = {role:'agent',text:'Ready'};
  let state = markers([], [[reply],[]],lanes,0,true);
  expect(state.map((x:any)=>x.unread)).toEqual([0,0]);
  state = markers(state, [[reply],[reply]],lanes,0,true);
  expect(state[1].unread).toBe(1);
  state = markers(state, [[reply],[reply]],lanes,0,true);
  expect(state[1].unread).toBe(1);
  state = markers(state, [[reply],[reply]],lanes,1,true);
  expect(state[1].unread).toBe(0);
  state = markers(state, [[reply],[reply,reply]],lanes,1,false);
  expect(state[1].unread).toBe(1);
  state = markers(state, [[reply],[reply,reply]],[lanes[0],{sessionAlias:'c'}],0,true);
  expect(state[1].unread).toBe(0);
});
const resizeCode = html.slice(html.indexOf('function clampPanelSize('), html.indexOf('function updateResizeLabels('));
const resize = vm.runInNewContext(resizeCode + '; clampPanelSize');
test('panel resizing preserves a usable conversation area and bounded controls', () => {
  expect(resize('sidebar',900,1024,768)).toBe(480);
  expect(resize('sidebar',500,700,768)).toBe(380);
  expect(resize('sidebar',-100,1024,768)).toBe(160);
  expect(resize('dock',0,1024,768)).toBe(86);
  expect(resize('dock',500,1024,600)).toBe(210);
});
