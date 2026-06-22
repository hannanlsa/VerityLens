const fs = require('fs');
const path = require('path');

const coreCode = fs.readFileSync(path.join(__dirname, '..', 'common', 'verity-core.js'), 'utf8');
const cmCode = fs.readFileSync(path.join(__dirname, '..', 'common', 'modules', 'cross-modal.js'), 'utf8');

const wrappedCore = '(function() { ' + coreCode + '\nreturn { VerityCore, MODEL_REGISTRY, SmartRouter, Channel }; })()';
const { VerityCore, MODEL_REGISTRY, SmartRouter, Channel } = eval(wrappedCore);

const wrappedCM = '(function() { var VerityCore = arguments[0]; ' + cmCode + '\nreturn CrossModalVerifier; })';
const CrossModalVerifier = eval(wrappedCM)(VerityCore);

const results = { pass: 0, fail: 0, total: 0 };
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message || ''} Expected "${expected}", got "${actual}"`);
}

function assertApprox(actual, expected, delta, message) {
  if (Math.abs(actual - expected) > delta) throw new Error(`${message || ''} Expected ~${expected}±${delta}, got ${actual}`);
}

function test(name, fn) {
  results.total++;
  try {
    fn();
    results.pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    results.fail++;
    failures.push({ name, error: err.message });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    \x1b[31m${err.message}\x1b[0m`);
  }
}

async function testAsync(name, fn) {
  results.total++;
  try {
    await fn();
    results.pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    results.fail++;
    failures.push({ name, error: err.message });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    \x1b[31m${err.message}\x1b[0m`);
  }
}

function suite(name) {
  console.log(`\n\x1b[36m${name}\x1b[0m`);
}

(async () => {
  console.log('\x1b[1mVerityLens Test Suite v0.5.0 (Node.js)\x1b[0m\n');

  suite('VerityCore · 基础属性');
  test('VERSION 应为 0.5.0', () => assertEqual(VerityCore.VERSION, '0.5.0'));
  test('5 级置信度常量完整', () => {
    assertEqual(VerityCore.CONFIDENCE.HIGH, 'high');
    assertEqual(VerityCore.CONFIDENCE.MEDIUM, 'medium');
    assertEqual(VerityCore.CONFIDENCE.ABNORMAL, 'abnormal');
    assertEqual(VerityCore.CONFIDENCE.PARTIAL, 'partial_X');
    assertEqual(VerityCore.CONFIDENCE.UNVERIFIED, 'unverified');
  });
  test('4 种通道模式完整', () => {
    assertEqual(VerityCore.MODE.LOCAL, 'local');
    assertEqual(VerityCore.MODE.SMART, 'smart');
    assertEqual(VerityCore.MODE.CLOUD, 'cloud');
    assertEqual(VerityCore.MODE.DOCKER, 'docker');
  });

  suite('VerityCore · textHeuristic');
  test('空文本返回 0', () => assertEqual(VerityCore.textHeuristic(''), 0));
  test('政府/教育域名加分', () => {
    assert(VerityCore.textHeuristic('参考 https://www.gov.cn/article') > 0.5);
  });
  test('广告关键词减分', () => {
    assert(VerityCore.textHeuristic('限时特惠秒杀，立即购买，点击下载app') < 0.3);
  });
  test('推广/赞助减分', () => {
    assert(VerityCore.textHeuristic('赞助内容推广广告，限时优惠打折') < 0.1);
  });

  suite('VerityCore · fuzzyMatch');
  test('完全相同返回 1', () => assertEqual(VerityCore.fuzzyMatch('hello world', 'hello world'), 1));
  test('完全不同返回 0', () => assertEqual(VerityCore.fuzzyMatch('abc', 'xyz'), 0));
  test('空输入返回 0', () => {
    assertEqual(VerityCore.fuzzyMatch('', 'hello'), 0);
    assertEqual(VerityCore.fuzzyMatch('hello', ''), 0);
  });
  test('大小写不敏感', () => assertEqual(VerityCore.fuzzyMatch('Hello World', 'hello world'), 1));

  suite('VerityCore · scoreToConfidence');
  test('≥0.85 → high', () => assertEqual(VerityCore.scoreToConfidence(0.85), 'high'));
  test('0.65-0.84 → medium', () => assertEqual(VerityCore.scoreToConfidence(0.65), 'medium'));
  test('0.4-0.64 → partial_X', () => assertEqual(VerityCore.scoreToConfidence(0.4), 'partial_X'));
  test('0.2-0.39 → abnormal', () => assertEqual(VerityCore.scoreToConfidence(0.2), 'abnormal'));
  test('<0.2 → unverified', () => assertEqual(VerityCore.scoreToConfidence(0.1), 'unverified'));

  suite('VerityCore · crossValidate');
  await testAsync('纯文本返回本地结果', async () => {
    const r = await VerityCore.crossValidate(null, null, '参考 Wikipedia 的技术文档');
    assertEqual(r.channel, 'local');
    assert(r.score > 0);
  });
  await testAsync('ASR 高匹配加分', async () => {
    const r = await VerityCore.crossValidate({ text: 'Python 编程教程', confidence: 0.9 }, null, 'Python 编程教程');
    assert(r.score > 0.5);
  });

  suite('MODEL_REGISTRY');
  test('15 家提供商', () => assertEqual(MODEL_REGISTRY.getAllProviders().length, 15));
  test('所有免费提供商有免费模型', () => assert(MODEL_REGISTRY.getFreeProviders().length >= 9));
  test('付费提供商', () => assert(MODEL_REGISTRY.getPaidProviders().length >= 5));
  test('getProvider 返回正确', () => {
    const ds = MODEL_REGISTRY.getProvider('deepseek');
    assertEqual(ds.name, 'DeepSeek');
  });
  test('custom 不在 getAllProviders', () => {
    assert(!MODEL_REGISTRY.getAllProviders().some(p => p.id === 'custom'));
  });

  suite('SmartRouter · 复杂度评估');
  test('短文本 → light', () => assertEqual(SmartRouter.assessComplexity('短文本').level, 'light'));
  test('含媒体 → medium+', () => {
    const r = SmartRouter.assessComplexity('文本', { hasMedia: true });
    assert(r.level === 'medium' || r.level === 'heavy', '含媒体应为 medium 或 heavy');
  });
  test('跨模态加分', () => {
    const n = SmartRouter.assessComplexity('文本');
    const c = SmartRouter.assessComplexity('文本', { crossModal: true });
    assert(c.score > n.score);
  });

  suite('CrossModalVerifier · 实体提取');
  test('提取 URL', () => {
    const e = CrossModalVerifier.extractEntities('访问 https://example.com');
    assert(e.filter(x => x.type === 'url').length >= 1);
  });
  test('提取邮箱', () => {
    const e = CrossModalVerifier.extractEntities('联系 admin@example.com');
    assert(e.filter(x => x.type === 'email').length >= 1);
  });
  test('提取手机号', () => {
    const e = CrossModalVerifier.extractEntities('致电 13800138000');
    assert(e.filter(x => x.type === 'phone').length >= 1);
  });
  test('提取日期', () => {
    const e = CrossModalVerifier.extractEntities('2024年12月25日发布');
    assert(e.filter(x => x.type === 'date').length >= 1);
  });
  test('提取组织', () => {
    const e = CrossModalVerifier.extractEntities('华为公司和中国科学院大学合作');
    assert(e.filter(x => x.type === 'org').length >= 1);
  });
  test('提取人物', () => {
    const e = CrossModalVerifier.extractEntities('张教授和李博士发表了论文');
    assert(e.filter(x => x.type === 'person').length >= 1);
  });
  test('空文本返回空', () => assertEqual(CrossModalVerifier.extractEntities('').length, 0));

  suite('CrossModalVerifier · 实体链接');
  test('相同实体精确链接', () => {
    const a = CrossModalVerifier.extractEntities('联系 admin@example.com');
    const b = CrossModalVerifier.extractEntities('邮箱 admin@example.com');
    assert(CrossModalVerifier.linkEntities(a, b).length >= 1);
  });
  test('无共同实体返回空', () => {
    const a = [{ type: 'url', value: 'https://a.com', position: 0 }];
    const b = [{ type: 'url', value: 'https://b.com', position: 0 }];
    assertEqual(CrossModalVerifier.linkEntities(a, b).length, 0);
  });

  suite('CrossModalVerifier · verify');
  await testAsync('纯文本启发式', async () => {
    const r = await CrossModalVerifier.verify('参考 Wikipedia 的技术文档', null, null);
    assert(r.score > 0);
    assertEqual(r.channel, 'cross-modal');
  });
  await testAsync('ASR+OCR+文本 三元组', async () => {
    const r = await CrossModalVerifier.verify('Python 编程教程 入门指南',
      { text: 'Python 编程教程 入门', confidence: 0.9 },
      { text: 'Python 编程教程 入门', confidence: 0.85 });
    assertEqual(r.modalityCount, 3);
  });
  await testAsync('ASR-OCR 跨模态一致性', async () => {
    const r = await CrossModalVerifier.verify('官方公告 2024年1月1日',
      { text: '官方公告 2024年1月1日', confidence: 0.9 },
      { text: '官方公告 2024年1月1日', confidence: 0.85 });
    assert(r.reasons.some(x => x.includes('ASR-OCR')));
  });

  suite('Channel · parseLLMResponse');
  test('标准 JSON', () => {
    const r = Channel.parseLLMResponse('{"confidence":"high","score":0.9,"reasons":["test"]}', 'm');
    assertEqual(r.confidence, 'high');
    assertEqual(r.model, 'm');
  });
  test('无效 JSON → unverified', () => {
    assertEqual(Channel.parseLLMResponse('not json').confidence, 'unverified');
  });
  test('score 超范围截断', () => {
    const r = Channel.parseLLMResponse('{"confidence":"high","score":1.5,"reasons":["t"]}');
    assert(r.score <= 1);
  });

  console.log(`\n\x1b[1m─── Results ───\x1b[0m`);
  console.log(`Total: ${results.total} | \x1b[32mPass: ${results.pass}\x1b[0m | \x1b[31mFail: ${results.fail}\x1b[0m`);

  if (failures.length > 0) {
    console.log(`\n\x1b[31mFailed tests:\x1b[0m`);
    failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
    process.exit(1);
  }
})();
